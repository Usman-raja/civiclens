import json
import os

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.redlist_person import RedListPerson
from app.models.redlist_embedding import RedListEmbedding
from app.models.alert import Alert
from app.services.face_engine import extract_embedding, find_top_matches
from app.services.url_helper import to_image_url
from app.config import REGISTERED_DIR
from app.services.security import require_admin, get_current_user

router = APIRouter()

VALID_RISK_LEVELS = {"Low", "Medium", "High", "Critical"}
DUPLICATE_REVIEW_THRESHOLD = 0.45


def _next_redlist_id(db: Session) -> str:
    count = db.query(RedListPerson).count()
    return f"R{count + 1:03d}"


def _load_redlist_embeddings(db: Session, active_only: bool = True):
    query = db.query(RedListEmbedding).join(RedListPerson, RedListEmbedding.redlist_id == RedListPerson.redlist_id)
    if active_only:
        query = query.filter(RedListPerson.active == 1)
    rows = query.all()
    return [(row.redlist_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _decode_image(contents: bytes):
    np_arr = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def _recommended_action(risk_level: str) -> str:
    return {
        "Low": "Monitor and log only.",
        "Medium": "Notify on-site personnel and verify identity before approaching.",
        "High": "Alert admin immediately. Do not approach alone.",
        "Critical": "Immediate alert to admin and relevant authorities. Restrict entry if possible.",
    }.get(risk_level, "Monitor and log only.")


@router.post("/api/redlist/check-similar")
async def check_similar(face_image: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    embeddings = _load_redlist_embeddings(db, active_only=False)
    matches = find_top_matches(embedding, embeddings, top_n=3)

    candidates = []
    for redlist_id, score in matches:
        if score < DUPLICATE_REVIEW_THRESHOLD:
            continue
        person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
        if person:
            candidates.append({
                "redlist_id": person.redlist_id,
                "name": person.name,
                "risk_level": person.risk_level,
                "similarity": round(float(score), 3),
            })
    return {"possible_duplicates": candidates}


@router.post("/api/redlist")
async def create_redlist_person(
    name: str = Form(...),
    risk_level: str = Form(...),
    category: str = Form(""),
    notes: str = Form(""),
    face_image: UploadFile = File(...),
    force: bool = Form(False),
    db: Session = Depends(get_db), _auth = Depends(require_admin)):
    if risk_level not in VALID_RISK_LEVELS:
        raise HTTPException(status_code=400, detail=f"risk_level must be one of {sorted(VALID_RISK_LEVELS)}")

    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    if not force:
        embeddings = _load_redlist_embeddings(db, active_only=False)
        matches = find_top_matches(embedding, embeddings, top_n=1)
        if matches and matches[0][1] >= DUPLICATE_REVIEW_THRESHOLD:
            existing_id, score = matches[0]
            existing = db.query(RedListPerson).filter(RedListPerson.redlist_id == existing_id).first()
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "A similar Red List profile already exists",
                    "existing_redlist_id": existing_id,
                    "existing_name": existing.name if existing else None,
                    "similarity": round(float(score), 3),
                    "options": [
                        f"merge: POST /api/redlist/{existing_id}/merge-image",
                        f"update: PUT /api/redlist/{existing_id}",
                        "cancel: do nothing",
                        "force create: resend this request with force=true",
                    ],
                },
            )

    redlist_id = _next_redlist_id(db)
    os.makedirs(REGISTERED_DIR, exist_ok=True)
    image_path = os.path.join(REGISTERED_DIR, f"{redlist_id}.jpg")
    cv2.imwrite(image_path, image_bgr)

    person = RedListPerson(
        redlist_id=redlist_id,
        name=name,
        risk_level=risk_level,
        category=category,
        notes=notes,
        representative_image_path=image_path,
        active=1,
        detection_count=0,
    )
    db.add(person)
    db.add(RedListEmbedding(redlist_id=redlist_id, embedding=json.dumps(embedding.tolist())))
    db.commit()

    return {
        "redlist_id": redlist_id,
        "name": name,
        "risk_level": risk_level,
        "category": category,
        "active": True,
    }


@router.post("/api/redlist/{redlist_id}/merge-image")
async def merge_image(redlist_id: str, face_image: UploadFile = File(...), db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")

    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    db.add(RedListEmbedding(redlist_id=redlist_id, embedding=json.dumps(embedding.tolist())))
    db.commit()
    return {"redlist_id": redlist_id, "merged": True}


@router.get("/api/redlist")
def list_redlist(
    risk_level: str = Query(None),
    active: bool = Query(None),
    name: str = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(RedListPerson)
    if risk_level:
        query = query.filter(RedListPerson.risk_level == risk_level)
    if active is not None:
        query = query.filter(RedListPerson.active == (1 if active else 0))
    if name:
        query = query.filter(RedListPerson.name.ilike(f"%{name}%"))
    people = query.all()
    return [
        {
            "redlist_id": p.redlist_id,
            "name": p.name,
            "risk_level": p.risk_level,
            "category": p.category,
            "active": bool(p.active),
            "detection_count": p.detection_count,
            "last_camera_name": p.last_camera_name,
            "last_seen": p.last_seen.isoformat() if p.last_seen else None,
            "image_url": to_image_url(p.representative_image_path),
        }
        for p in people
    ]


@router.get("/api/redlist/{redlist_id}")
def get_redlist_person(redlist_id: str, db: Session = Depends(get_db)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")
    alerts = db.query(Alert).filter(Alert.redlist_id == redlist_id).order_by(Alert.occurred_at.desc()).all()
    return {
        "redlist_id": person.redlist_id,
        "name": person.name,
        "risk_level": person.risk_level,
        "category": person.category,
        "notes": person.notes,
        "active": bool(person.active),
        "detection_count": person.detection_count,
        "first_seen": person.first_seen.isoformat() if person.first_seen else None,
        "last_seen": person.last_seen.isoformat() if person.last_seen else None,
        "last_camera_name": person.last_camera_name,
        "representative_image_path": person.representative_image_path,
        "image_url": to_image_url(person.representative_image_path),
        "recommended_action": _recommended_action(person.risk_level),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "camera_name": a.camera_name,
                "similarity_score": a.similarity_score,
                "risk_level": a.risk_level,
                "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
            }
            for a in alerts
        ],
    }


@router.put("/api/redlist/{redlist_id}")
def update_redlist_person(
    redlist_id: str,
    name: str = Form(None),
    risk_level: str = Form(None),
    category: str = Form(None),
    notes: str = Form(None),
    db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")
    if name is not None:
        person.name = name
    if risk_level is not None:
        if risk_level not in VALID_RISK_LEVELS:
            raise HTTPException(status_code=400, detail=f"risk_level must be one of {sorted(VALID_RISK_LEVELS)}")
        person.risk_level = risk_level
    if category is not None:
        person.category = category
    if notes is not None:
        person.notes = notes
    db.commit()
    return {"redlist_id": redlist_id, "updated": True}


@router.patch("/api/redlist/{redlist_id}/deactivate")
def deactivate_redlist_person(redlist_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")
    person.active = 0
    db.commit()
    return {"redlist_id": redlist_id, "active": False}


@router.patch("/api/redlist/{redlist_id}/activate")
def activate_redlist_person(redlist_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")
    person.active = 1
    db.commit()
    return {"redlist_id": redlist_id, "active": True}


@router.delete("/api/redlist/{redlist_id}")
def delete_redlist_person(redlist_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Red List person not found")
    db.query(RedListEmbedding).filter(RedListEmbedding.redlist_id == redlist_id).delete()
    db.query(Alert).filter(Alert.redlist_id == redlist_id).delete()
    db.delete(person)
    db.commit()
    return {"deleted": redlist_id}


@router.patch("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db), _auth = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = 1
    db.commit()
    return {"alert_id": alert_id, "acknowledged": True}


@router.get("/api/alerts")
def list_alerts(limit: int = 20, db: Session = Depends(get_db)):
    rows = (
        db.query(Alert, RedListPerson.name)
        .join(RedListPerson, Alert.redlist_id == RedListPerson.redlist_id)
        .order_by(Alert.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "alert_id": a.alert_id,
            "redlist_id": a.redlist_id,
            "name": name,
            "risk_level": a.risk_level,
            "camera_name": a.camera_name,
            "similarity_score": a.similarity_score,
            "detection_image_path": a.detection_image_path,
            "image_url": to_image_url(a.detection_image_path),
            "acknowledged": bool(a.acknowledged),
            "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
            "recommended_action": _recommended_action(a.risk_level),
        }
        for a, name in rows
    ]
