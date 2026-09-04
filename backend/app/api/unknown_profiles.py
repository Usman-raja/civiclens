import json
import os
import shutil

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.unknown_profile import UnknownProfile
from app.models.participant import Participant
from app.models.face_embedding import FaceEmbedding
from app.models.detection import Detection
from app.services.face_engine import extract_embedding
from app.services.url_helper import to_image_url
from app.config import REGISTERED_DIR

router = APIRouter()


def _next_person_id(db: Session) -> str:
    count = db.query(Participant).count()
    return f"P{count + 1:03d}"


@router.get("/api/unknown-profiles")
def list_unknown_profiles(db: Session = Depends(get_db)):
    profiles = db.query(UnknownProfile).filter(UnknownProfile.claimed == 0).all()
    return [
        {
            "unknown_id": p.unknown_id,
            "detection_count": p.detection_count,
            "last_camera_name": p.last_camera_name,
            "first_seen": p.first_seen.isoformat() if p.first_seen else None,
            "last_seen": p.last_seen.isoformat() if p.last_seen else None,
            "representative_image_path": p.representative_image_path,
            "image_url": to_image_url(p.representative_image_path),
        }
        for p in profiles
    ]


@router.post("/api/unknown-profiles/{unknown_id}/claim")
async def claim_unknown_profile(
    unknown_id: str,
    name: str = Form(...),
    face_image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    profile = db.query(UnknownProfile).filter(UnknownProfile.unknown_id == unknown_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Unknown profile not found")
    if profile.claimed:
        raise HTTPException(status_code=400, detail="Already claimed")

    person_id = _next_person_id(db)
    os.makedirs(REGISTERED_DIR, exist_ok=True)
    registered_path = os.path.join(REGISTERED_DIR, f"{person_id}.jpg")

    if face_image is not None:
        contents = await face_image.read()
        np_arr = np.frombuffer(contents, np.uint8)
        image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            raise HTTPException(status_code=400, detail="Could not read the uploaded image")
        new_embedding = extract_embedding(image_bgr)
        if new_embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in the uploaded image")
        cv2.imwrite(registered_path, image_bgr)
        embedding_json = json.dumps(new_embedding.tolist())
    else:
        if profile.representative_image_path and os.path.exists(profile.representative_image_path):
            shutil.copyfile(profile.representative_image_path, registered_path)
        else:
            registered_path = profile.representative_image_path
        embedding_json = profile.embedding

    participant = Participant(
        person_id=person_id,
        name=name,
        registered_face_image_path=registered_path,
        current_score=5,
        total_detections=profile.detection_count,
        first_seen=profile.first_seen,
        last_seen=profile.last_seen,
        last_camera_name=profile.last_camera_name,
    )
    db.add(participant)
    db.add(FaceEmbedding(person_id=person_id, embedding=embedding_json, model_name="buffalo_l"))

    past_detections = db.query(Detection).filter(Detection.unknown_id == unknown_id).all()
    for d in past_detections:
        d.person_id = person_id
        d.is_known = True

    profile.claimed = 1
    profile.converted_to_person_id = person_id
    db.commit()

    return {
        "person_id": person_id,
        "name": name,
        "current_score": 5,
        "score_color": "gray",
        "claimed_from": unknown_id,
        "transferred_detections": len(past_detections),
        "used_new_photo": face_image is not None,
    }
