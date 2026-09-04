import json
import os
from datetime import datetime

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.missing_person import MissingPerson
from app.models.missing_person_embedding import MissingPersonEmbedding
from app.models.missing_person_alert import MissingPersonAlert
from app.services.face_engine import extract_embedding, find_top_matches
from app.services.url_helper import to_image_url
from app.config import REGISTERED_DIR
from app.services.security import require_admin, get_current_user

router = APIRouter()

DUPLICATE_REVIEW_THRESHOLD = 0.45


def _next_missing_id(db: Session) -> str:
    count = db.query(MissingPerson).count()
    return f"M{count + 1:03d}"


def _load_missing_embeddings(db: Session, active_only: bool = True):
    query = db.query(MissingPersonEmbedding).join(
        MissingPerson, MissingPersonEmbedding.missing_id == MissingPerson.missing_id
    )
    if active_only:
        query = query.filter(MissingPerson.active == 1)
    rows = query.all()
    return [(row.missing_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _decode_image(contents: bytes):
    np_arr = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


@router.post("/api/missing-persons/check-similar")
async def check_similar(face_image: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    embeddings = _load_missing_embeddings(db, active_only=False)
    matches = find_top_matches(embedding, embeddings, top_n=3)

    candidates = []
    for missing_id, score in matches:
        if score < DUPLICATE_REVIEW_THRESHOLD:
            continue
        person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
        if person:
            candidates.append({
                "missing_id": person.missing_id,
                "name": person.name,
                "similarity": round(float(score), 3),
            })
    return {"possible_duplicates": candidates}


@router.post("/api/missing-persons")
async def create_missing_person(
    name: str = Form(...),
    age: int = Form(None),
    description: str = Form(""),
    contact_info: str = Form(""),
    face_image: UploadFile = File(...),
    force: bool = Form(False),
    db: Session = Depends(get_db), _auth = Depends(require_admin)):
    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    if not force:
        embeddings = _load_missing_embeddings(db, active_only=False)
        matches = find_top_matches(embedding, embeddings, top_n=1)
        if matches and matches[0][1] >= DUPLICATE_REVIEW_THRESHOLD:
            existing_id, score = matches[0]
            existing = db.query(MissingPerson).filter(MissingPerson.missing_id == existing_id).first()
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "A similar missing person record already exists",
                    "existing_missing_id": existing_id,
                    "existing_name": existing.name if existing else None,
                    "similarity": round(float(score), 3),
                    "options": [
                        f"merge: POST /api/missing-persons/{existing_id}/merge-image",
                        f"update: PUT /api/missing-persons/{existing_id}",
                        "cancel: do nothing",
                        "force create: resend this request with force=true",
                    ],
                },
            )

    missing_id = _next_missing_id(db)
    os.makedirs(REGISTERED_DIR, exist_ok=True)
    image_path = os.path.join(REGISTERED_DIR, f"{missing_id}.jpg")
    cv2.imwrite(image_path, image_bgr)

    person = MissingPerson(
        missing_id=missing_id,
        name=name,
        age=age,
        description=description,
        contact_info=contact_info,
        representative_image_path=image_path,
        active=1,
        detection_count=0,
        reported_missing_since=datetime.utcnow(),
    )
    db.add(person)
    db.add(MissingPersonEmbedding(missing_id=missing_id, embedding=json.dumps(embedding.tolist())))
    db.commit()

    return {"missing_id": missing_id, "name": name, "active": True}


@router.post("/api/missing-persons/{missing_id}/merge-image")
async def merge_image(missing_id: str, face_image: UploadFile = File(...), db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")

    image_bgr = _decode_image(await face_image.read())
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    db.add(MissingPersonEmbedding(missing_id=missing_id, embedding=json.dumps(embedding.tolist())))
    db.commit()
    return {"missing_id": missing_id, "merged": True}


@router.get("/api/missing-persons")
def list_missing_persons(
    active: bool = Query(None),
    name: str = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(MissingPerson)
    if active is not None:
        query = query.filter(MissingPerson.active == (1 if active else 0))
    if name:
        query = query.filter(MissingPerson.name.ilike(f"%{name}%"))
    people = query.all()
    return [
        {
            "missing_id": p.missing_id,
            "name": p.name,
            "age": p.age,
            "active": bool(p.active),
            "detection_count": p.detection_count,
            "last_camera_name": p.last_camera_name,
            "last_seen": p.last_seen.isoformat() if p.last_seen else None,
            "reported_missing_since": p.reported_missing_since.isoformat() if p.reported_missing_since else None,
            "image_url": to_image_url(p.representative_image_path),
        }
        for p in people
    ]


@router.get("/api/missing-persons/{missing_id}")
def get_missing_person(missing_id: str, db: Session = Depends(get_db)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")
    alerts = (
        db.query(MissingPersonAlert)
        .filter(MissingPersonAlert.missing_id == missing_id)
        .order_by(MissingPersonAlert.occurred_at.desc())
        .all()
    )
    return {
        "missing_id": person.missing_id,
        "name": person.name,
        "age": person.age,
        "description": person.description,
        "contact_info": person.contact_info,
        "active": bool(person.active),
        "detection_count": person.detection_count,
        "reported_missing_since": person.reported_missing_since.isoformat() if person.reported_missing_since else None,
        "first_seen": person.first_seen.isoformat() if person.first_seen else None,
        "last_seen": person.last_seen.isoformat() if person.last_seen else None,
        "last_camera_name": person.last_camera_name,
        "image_url": to_image_url(person.representative_image_path),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "camera_name": a.camera_name,
                "similarity_score": a.similarity_score,
                "image_url": to_image_url(a.detection_image_path),
                "acknowledged": bool(a.acknowledged),
                "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
            }
            for a in alerts
        ],
    }


@router.put("/api/missing-persons/{missing_id}")
def update_missing_person(
    missing_id: str,
    name: str = Form(None),
    age: int = Form(None),
    description: str = Form(None),
    contact_info: str = Form(None),
    db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")
    if name is not None:
        person.name = name
    if age is not None:
        person.age = age
    if description is not None:
        person.description = description
    if contact_info is not None:
        person.contact_info = contact_info
    db.commit()
    return {"missing_id": missing_id, "updated": True}


@router.patch("/api/missing-persons/{missing_id}/mark-found")
def mark_found(missing_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")
    person.active = 0
    db.commit()
    return {"missing_id": missing_id, "active": False}


@router.patch("/api/missing-persons/{missing_id}/reopen")
def reopen_case(missing_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")
    person.active = 1
    db.commit()
    return {"missing_id": missing_id, "active": True}


@router.delete("/api/missing-persons/{missing_id}")
def delete_missing_person(missing_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        raise HTTPException(status_code=404, detail="Missing person record not found")
    db.query(MissingPersonEmbedding).filter(MissingPersonEmbedding.missing_id == missing_id).delete()
    db.query(MissingPersonAlert).filter(MissingPersonAlert.missing_id == missing_id).delete()
    db.delete(person)
    db.commit()
    return {"deleted": missing_id}


@router.patch("/api/missing-person-alerts/{alert_id}/acknowledge")
def acknowledge_missing_alert(alert_id: int, db: Session = Depends(get_db), _auth = Depends(get_current_user)):
    alert = db.query(MissingPersonAlert).filter(MissingPersonAlert.alert_id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = 1
    db.commit()
    return {"alert_id": alert_id, "acknowledged": True}


@router.get("/api/missing-person-alerts")
def list_missing_alerts(limit: int = 20, db: Session = Depends(get_db)):
    rows = (
        db.query(MissingPersonAlert, MissingPerson.name)
        .join(MissingPerson, MissingPersonAlert.missing_id == MissingPerson.missing_id)
        .order_by(MissingPersonAlert.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "alert_id": a.alert_id,
            "missing_id": a.missing_id,
            "name": name,
            "camera_name": a.camera_name,
            "similarity_score": a.similarity_score,
            "image_url": to_image_url(a.detection_image_path),
            "acknowledged": bool(a.acknowledged),
            "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
        }
        for a, name in rows
    ]
