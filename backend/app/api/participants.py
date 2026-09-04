import json
import os

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.participant import Participant
from app.models.face_embedding import FaceEmbedding
from app.services.face_engine import extract_embedding
from app.services.url_helper import to_image_url
from app.config import REGISTERED_DIR
from app.services.security import require_admin, get_current_user

router = APIRouter()


def _next_person_id(db: Session) -> str:
    count = db.query(Participant).count()
    return f"P{count + 1:03d}"


def _score_color(score: int) -> str:
    if score >= 7:
        return "green"
    if score >= 4:
        return "gray"
    return "red"


@router.post("/api/participants")
async def register_participant(
    name: str = Form(...),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth = Depends(require_admin),
):
    contents = await face_image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")

    embedding = extract_embedding(image_bgr)
    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in the uploaded image")

    person_id = _next_person_id(db)

    os.makedirs(REGISTERED_DIR, exist_ok=True)
    image_path = os.path.join(REGISTERED_DIR, f"{person_id}.jpg")
    cv2.imwrite(image_path, image_bgr)

    participant = Participant(
        person_id=person_id,
        name=name,
        registered_face_image_path=image_path,
        current_score=5,
    )
    db.add(participant)

    face_embedding = FaceEmbedding(
        person_id=person_id,
        embedding=json.dumps(embedding.tolist()),
        model_name="buffalo_l",
    )
    db.add(face_embedding)
    db.commit()

    return {
        "person_id": person_id,
        "name": name,
        "current_score": 5,
        "score_color": "gray",
        "registered_face_image_path": image_path,
    }


@router.get("/api/participants")
def list_participants(db: Session = Depends(get_db)):
    participants = db.query(Participant).all()
    return [
        {
            "person_id": p.person_id,
            "name": p.name,
            "current_score": p.current_score,
            "score_color": _score_color(p.current_score),
            "total_detections": p.total_detections,
            "image_url": to_image_url(p.registered_face_image_path),
            "external_id": p.external_id,
            "source": p.source,
        }
        for p in participants
    ]


@router.get("/api/participants/{person_id}")
def get_participant(person_id: str, db: Session = Depends(get_db)):
    p = db.query(Participant).filter(Participant.person_id == person_id).first()
    if p is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    return {
        "person_id": p.person_id,
        "name": p.name,
        "current_score": p.current_score,
        "score_color": _score_color(p.current_score),
        "positive_event_count": p.positive_event_count,
        "negative_event_count": p.negative_event_count,
        "total_detections": p.total_detections,
        "image_url": to_image_url(p.registered_face_image_path),
        "latest_detection_image_url": to_image_url(p.latest_detection_image_path),
        "last_camera_name": p.last_camera_name,
        "last_match_confidence": p.last_match_confidence,
        "first_seen": p.first_seen.isoformat() if p.first_seen else None,
        "last_seen": p.last_seen.isoformat() if p.last_seen else None,
        "external_id": p.external_id,
        "phone": p.phone,
        "address": p.address,
        "notes": p.notes,
        "source": p.source,
    }


@router.delete("/api/participants/{person_id}")
def delete_participant(person_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    participant = db.query(Participant).filter(Participant.person_id == person_id).first()
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    db.query(FaceEmbedding).filter(FaceEmbedding.person_id == person_id).delete()
    db.delete(participant)
    db.commit()
    return {"deleted": person_id}
