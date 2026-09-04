import json
import os
from datetime import datetime

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.participant import Participant
from app.models.face_embedding import FaceEmbedding
from app.models.detection import Detection
from app.models.camera import Camera
from app.models.unknown_profile import UnknownProfile
from app.models.redlist_person import RedListPerson
from app.models.redlist_embedding import RedListEmbedding
from app.models.alert import Alert
from app.models.missing_person import MissingPerson
from app.models.missing_person_embedding import MissingPersonEmbedding
from app.models.missing_person_alert import MissingPersonAlert
from app.models.scene_event import SceneEvent
from app.models.scene_alert import SceneAlert
from app.services.face_engine import detect_faces, find_match
from app.services.object_engine import detect_objects
from app.services.url_helper import to_image_url
from app.services.event_engine import evaluate_zone_events, count_in_zone, crowd_alert_allowed, track_vehicles, check_crowd_surge, track_unattended_objects, track_road_accidents
from app.services.scoring_engine import apply_event
from app.services.settings_service import get_setting
from app.services.security import get_current_user
from app.config import DETECTIONS_DIR, EVIDENCE_DIR

router = APIRouter()

CROWD_RECOMMENDED_ACTION = "Crowd forming in this zone — notify authorities immediately."

ACCIDENT_ACTIONS = {
    "fallen_person": "Person down on the road — accident or medical emergency. Dispatch Rescue 1122 immediately.",
    "person_vehicle_overlap": "Person under/against a vehicle — probable vehicle-pedestrian accident. Dispatch rescue and police.",
    "vehicle_stopped_on_road": "Vehicle stopped on the road with a person alongside — possible accident or breakdown. Dispatch traffic police to verify.",
    "vehicle_collision": "Two vehicles in contact — probable collision. Dispatch police and rescue immediately.",
    "crashed_vehicle_pair": "Two vehicles stopped together on the road — probable collision scene. Dispatch traffic police.",
}
ACCIDENT_DEFAULT_ACTION = "Probable road accident. Dispatch emergency services (Rescue 1122) immediately."


def _score_color(score: int) -> str:
    if score >= 7:
        return "green"
    if score >= 4:
        return "gray"
    return "red"


def _load_known_embeddings(db: Session):
    rows = db.query(FaceEmbedding).all()
    return [(row.person_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _load_unknown_embeddings(db: Session):
    rows = db.query(UnknownProfile).filter(UnknownProfile.claimed == 0).all()
    return [(row.unknown_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _load_zone_config(db: Session, camera_name: str):
    camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
    if camera is None or not camera.zone_config:
        return {}
    return json.loads(camera.zone_config)


def _scale_zones_to_frame(zone_config: dict, frame_w: int, frame_h: int):
    return {
        zone_name: [[px * frame_w / 1000.0, py * frame_h / 1000.0] for px, py in polygon]
        for zone_name, polygon in zone_config.items()
    }


def _load_camera_settings(db: Session, camera_name: str):
    camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
    if camera is None:
        return "Custom", ["vehicle_parking", "crowd", "road_events"]
    detections = json.loads(camera.enabled_detections) if camera.enabled_detections else []
    return camera.purpose or "Custom", detections


def _next_unknown_id(db: Session) -> str:
    count = db.query(UnknownProfile).count()
    return f"U{count + 1:03d}"


def _load_redlist_embeddings(db: Session):
    rows = (
        db.query(RedListEmbedding)
        .join(RedListPerson, RedListEmbedding.redlist_id == RedListPerson.redlist_id)
        .filter(RedListPerson.active == 1)
        .all()
    )
    return [(row.redlist_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _check_redlist(db: Session, embedding, camera_name: str, image_bgr, camera_purpose: str = "Custom"):
    redlist_embeddings = _load_redlist_embeddings(db)
    if not redlist_embeddings:
        print("[redlist_check] no active Red List embeddings loaded at all — is the entry active, and did it actually save?")
        return None
    redlist_threshold = get_setting(db, "redlist_match_threshold")
    redlist_id, score = find_match(embedding, redlist_embeddings, threshold=redlist_threshold)
    print(f"[redlist_check] best_score={score:.3f} threshold={redlist_threshold} matched_id={redlist_id} "
          f"(checked against {len(redlist_embeddings)} active Red List entries)")
    if redlist_id is None:
        return None

    person = db.query(RedListPerson).filter(RedListPerson.redlist_id == redlist_id).first()
    if person is None:
        return None

    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    evidence_path = os.path.join(EVIDENCE_DIR, f"{redlist_id}_{timestamp}.jpg")
    cv2.imwrite(evidence_path, image_bgr)

    now = datetime.utcnow()
    if person.first_seen is None:
        person.first_seen = now
    person.last_seen = now
    person.last_camera_name = camera_name
    person.detection_count += 1

    db.add(Alert(
        redlist_id=redlist_id,
        camera_name=camera_name,
        similarity_score=round(float(score), 3),
        risk_level=person.risk_level,
        detection_image_path=evidence_path,
    ))
    db.commit()

    return {
        "redlist_id": redlist_id,
        "name": person.name,
        "risk_level": person.risk_level,
        "similarity_score": round(float(score), 3),
        "camera_name": camera_name,
        "camera_purpose": camera_purpose,
        "occurred_at": now.isoformat(),
        "photo": to_image_url(person.representative_image_path),
        "evidence_image_url": to_image_url(evidence_path),
        "previous_detection_count": person.detection_count,
        "recommended_action": _recommended_action(person.risk_level),
    }


def _load_missing_person_embeddings(db: Session):
    rows = (
        db.query(MissingPersonEmbedding)
        .join(MissingPerson, MissingPersonEmbedding.missing_id == MissingPerson.missing_id)
        .filter(MissingPerson.active == 1)
        .all()
    )
    return [(row.missing_id, np.array(json.loads(row.embedding), dtype=np.float32)) for row in rows]


def _check_missing_person(db: Session, embedding, camera_name: str, image_bgr, camera_purpose: str = "Custom"):
    missing_embeddings = _load_missing_person_embeddings(db)
    if not missing_embeddings:
        return None
    missing_id, score = find_match(embedding, missing_embeddings, threshold=get_setting(db, "missing_person_match_threshold"))
    if missing_id is None:
        return None

    person = db.query(MissingPerson).filter(MissingPerson.missing_id == missing_id).first()
    if person is None:
        return None

    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    evidence_path = os.path.join(EVIDENCE_DIR, f"{missing_id}_{timestamp}.jpg")
    cv2.imwrite(evidence_path, image_bgr)

    now = datetime.utcnow()
    if person.first_seen is None:
        person.first_seen = now
    person.last_seen = now
    person.last_camera_name = camera_name
    person.detection_count += 1

    db.add(MissingPersonAlert(
        missing_id=missing_id,
        camera_name=camera_name,
        similarity_score=round(float(score), 3),
        detection_image_path=evidence_path,
    ))
    db.commit()

    return {
        "missing_id": missing_id,
        "name": person.name,
        "age": person.age,
        "similarity_score": round(float(score), 3),
        "camera_name": camera_name,
        "camera_purpose": camera_purpose,
        "occurred_at": now.isoformat(),
        "photo": to_image_url(person.representative_image_path),
        "evidence_image_url": to_image_url(evidence_path),
        "previous_detection_count": person.detection_count,
        "contact_info": person.contact_info,
    }


def _handle_known_face(db, person_id, score, camera_name, image_bgr, centroid, bbox, zone_config, enabled_detections):
    participant = db.query(Participant).filter(Participant.person_id == person_id).first()

    os.makedirs(DETECTIONS_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    image_path = os.path.join(DETECTIONS_DIR, f"{person_id}_{timestamp}.jpg")
    cv2.imwrite(image_path, image_bgr)

    now = datetime.utcnow()
    if participant.first_seen is None:
        participant.first_seen = now
    participant.last_seen = now
    participant.last_camera_name = camera_name
    participant.last_match_confidence = score
    participant.latest_detection_image_path = image_path
    participant.total_detections += 1

    detection = Detection(person_id=person_id, camera_name=camera_name, detection_image_path=image_path,
                           match_confidence=score, is_known=True, centroid_x=centroid[0], centroid_y=centroid[1])
    db.add(detection)
    db.flush()
    db.commit()
    db.refresh(participant)
    db.refresh(detection)

    triggered_events = []
    if zone_config and "road_events" in enabled_detections:
        event_type_ids = evaluate_zone_events(person_id, centroid, zone_config, db=db)
        for event_type_id in event_type_ids:
            result = apply_event(db, person_id, event_type_id, camera_name, detection_id=detection.detection_id)
            triggered_events.append(result)
        db.refresh(participant)

    return {
        "status": "matched",
        "person_id": person_id,
        "name": participant.name,
        "match_confidence": round(float(score), 3),
        "current_score": participant.current_score,
        "score_color": _score_color(participant.current_score),
        "total_detections": participant.total_detections,
        "face_bbox": [round(float(v), 1) for v in bbox],
        "centroid": centroid,
        "triggered_events": triggered_events,
        "image_url": to_image_url(image_path),
    }


def _handle_unknown_face(db, embedding, score_vs_known, camera_name, image_bgr, centroid, bbox):
    unknown_embeddings = _load_unknown_embeddings(db)
    unknown_id, unk_score = find_match(embedding, unknown_embeddings, threshold=get_setting(db, "unknown_match_threshold"))

    os.makedirs(DETECTIONS_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    now = datetime.utcnow()

    if unknown_id is not None:
        profile = db.query(UnknownProfile).filter(UnknownProfile.unknown_id == unknown_id).first()
        image_path = os.path.join(DETECTIONS_DIR, f"{unknown_id}_{timestamp}.jpg")
        cv2.imwrite(image_path, image_bgr)
        profile.detection_count += 1
        profile.last_seen = now
        profile.last_camera_name = camera_name
        profile.representative_image_path = image_path
        db.commit()
    else:
        unknown_id = _next_unknown_id(db)
        image_path = os.path.join(DETECTIONS_DIR, f"{unknown_id}_{timestamp}.jpg")
        cv2.imwrite(image_path, image_bgr)
        profile = UnknownProfile(
            unknown_id=unknown_id,
            embedding=json.dumps(embedding.tolist()),
            representative_image_path=image_path,
            detection_count=1,
            last_camera_name=camera_name,
            first_seen=now,
            last_seen=now,
            claimed=0,
        )
        db.add(profile)
        db.commit()

    db.add(Detection(person_id=None, unknown_id=unknown_id, camera_name=camera_name, detection_image_path=image_path,
                      match_confidence=score_vs_known, is_known=False, centroid_x=centroid[0], centroid_y=centroid[1]))
    db.commit()

    return {
        "status": "unknown",
        "unknown_id": unknown_id,
        "message": "Unknown Participant",
        "best_score": round(float(score_vs_known), 3),
        "detection_count": profile.detection_count,
        "face_bbox": [round(float(v), 1) for v in bbox],
        "centroid": centroid,
        "image_url": to_image_url(image_path),
    }


def _recommended_action(risk_level: str) -> str:
    return {
        "Low": "Monitor and log only.",
        "Medium": "Notify on-site personnel and verify identity before approaching.",
        "High": "Alert admin immediately. Do not approach alone.",
        "Critical": "Immediate alert to admin and relevant authorities. Restrict entry if possible.",
    }.get(risk_level, "Monitor and log only.")


def _check_scene_events(db: Session, camera_name: str, image_bgr, zone_config: dict, enabled_detections, loitering_person_ids: list = None):
    if "vehicle_parking" not in enabled_detections and "crowd" not in enabled_detections and "road_events" not in enabled_detections:
        return [], None

    scene_events = []
    objects = detect_objects(image_bgr)

    person_centroids = [[(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] for b in objects["persons"]]
    crowd_zone = zone_config.get("crowd_zone")

    if "crowd" in enabled_detections and crowd_zone:
        count = count_in_zone(person_centroids, crowd_zone)

        # Normal crowd alert
        if count >= get_setting(db, "crowd_threshold") and crowd_alert_allowed(camera_name):
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"crowd_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="crowd_detected", camera_name=camera_name,
                                      detail=f"count: {count}", detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="crowd_detected",
                camera_name=camera_name,
                zone_name="crowd_zone",
                person_count=count,
                detail=f"{count} persons in crowd zone",
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "crowd_detected",
                "count": count,
                "alert_id": scene_alert.scene_alert_id,
                "zone_name": "crowd_zone",
                "person_count": count,
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": CROWD_RECOMMENDED_ACTION,
            })

        # Crowd surge alert (always tracked, only fires when threshold crossed)
        surge = check_crowd_surge(camera_name, count, db=db)
        if surge:
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"surge_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="crowd_surge", camera_name=camera_name,
                                      detail=f"+{surge['increase']} persons in {surge['window_seconds']}s",
                                      detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="crowd_surge",
                camera_name=camera_name,
                zone_name="crowd_zone",
                person_count=surge["to_count"],
                detail=f"Crowd grew from {surge['from_count']} to {surge['to_count']} in {surge['window_seconds']}s",
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "crowd_surge",
                "alert_id": scene_alert.scene_alert_id,
                "zone_name": "crowd_zone",
                "person_count": surge["to_count"],
                "from_count": surge["from_count"],
                "increase": surge["increase"],
                "window_seconds": surge["window_seconds"],
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": "Rapid crowd growth detected — risk of crush or stampede. Alert crowd-control personnel immediately.",
            })

    if "vehicle_parking" in enabled_detections and zone_config.get("no_parking_zone"):
        triggered = track_vehicles(camera_name, objects["vehicles"], zone_config, db=db)
        for hit in triggered:
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"parking_{hit['vehicle_id']}_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="illegal_parking", camera_name=camera_name,
                                      detail=f"vehicle {hit['vehicle_id']}, {hit['dwell_seconds']}s",
                                      detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="illegal_parking",
                camera_name=camera_name,
                zone_name="no_parking_zone",
                detail=f"Vehicle {hit['vehicle_id']} in no-parking zone for {hit['dwell_seconds']}s",
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "illegal_parking",
                "alert_id": scene_alert.scene_alert_id,
                "zone_name": "no_parking_zone",
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": "Vehicle illegally parked. Dispatch traffic warden or tow unit.",
                **hit,
            })

    # Loitering: create SceneAlerts for any person_ids that just fired loitering
    if loitering_person_ids:
        for pid in loitering_person_ids:
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"loiter_{pid}_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="loitering", camera_name=camera_name,
                                      detail=f"person {pid}", detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="loitering",
                camera_name=camera_name,
                zone_name="restricted_zone",
                detail=f"Person {pid} loitering in restricted zone",
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "loitering",
                "alert_id": scene_alert.scene_alert_id,
                "zone_name": "restricted_zone",
                "person_id": pid,
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": "Person loitering in restricted area. Dispatch security to investigate.",
            })

    # Unattended objects (bags/suitcases) — run when crowd or road_events are enabled
    if ("crowd" in enabled_detections or "road_events" in enabled_detections) and objects.get("objects"):
        unattended = track_unattended_objects(camera_name, objects["objects"], person_centroids, db=db)
        for hit in unattended:
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"unattended_{hit['object_id']}_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="unattended_object", camera_name=camera_name,
                                      detail=f"object {hit['object_id']}, unattended {hit['dwell_seconds']}s",
                                      detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="unattended_object",
                camera_name=camera_name,
                zone_name=None,
                detail=f"Unattended object {hit['object_id']} left for {hit['dwell_seconds']}s with no nearby person",
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "unattended_object",
                "alert_id": scene_alert.scene_alert_id,
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": "Unattended bag or object detected. Treat as suspicious — follow security protocol.",
                **hit,
            })

    # Road accidents — fallen person, person under a vehicle, vehicle stopped
    # on road, vehicle-vehicle collision, crashed vehicle pair
    if "road_events" in enabled_detections:
        accidents = track_road_accidents(camera_name, objects["persons"], objects["vehicles"], zone_config, db=db)
        for hit in accidents:
            os.makedirs(EVIDENCE_DIR, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            image_path = os.path.join(EVIDENCE_DIR, f"accident_{timestamp}.jpg")
            cv2.imwrite(image_path, image_bgr)
            scene_event = SceneEvent(event_type="road_accident", camera_name=camera_name,
                                      detail=hit["detail"], detection_image_path=image_path)
            db.add(scene_event)
            db.flush()
            scene_alert = SceneAlert(
                event_type="road_accident",
                camera_name=camera_name,
                zone_name="road",
                detail=hit["detail"],
                detection_image_path=image_path,
            )
            db.add(scene_alert)
            db.commit()
            db.refresh(scene_alert)
            scene_events.append({
                "event_type": "road_accident",
                "alert_id": scene_alert.scene_alert_id,
                "zone_name": "road",
                "camera_name": camera_name,
                "occurred_at": scene_alert.occurred_at.isoformat() if scene_alert.occurred_at else None,
                "image_url": to_image_url(image_path),
                "recommended_action": ACCIDENT_ACTIONS.get(hit["type"], ACCIDENT_DEFAULT_ACTION),
                **hit,
            })

    return scene_events, len(objects["persons"])


def run_detection(db: Session, camera_name: str, image_bgr):
    """Full detection pipeline for one frame of one camera: face matching,
    watchlist/missing-person checks, and zone/scene events. Shared by the
    /api/detect/frame endpoint and the server-side stream monitor workers."""
    faces = detect_faces(image_bgr)
    known_embeddings = _load_known_embeddings(db)
    zone_config = _load_zone_config(db, camera_name)
    if zone_config:
        frame_h, frame_w = image_bgr.shape[:2]
        zone_config = _scale_zones_to_frame(zone_config, frame_w, frame_h)
    camera_purpose, enabled_detections = _load_camera_settings(db, camera_name)

    results = []
    loitering_person_ids = []
    for face in faces:
        embedding = face.embedding
        x1, y1, x2, y2 = [float(v) for v in face.bbox]
        centroid = [round((x1 + x2) / 2, 1), round((y1 + y2) / 2, 1)]

        keypoints = None
        if getattr(face, "kps", None) is not None:
            keypoints = [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in face.kps]

        person_id, score = find_match(embedding, known_embeddings, threshold=get_setting(db, "match_threshold"))

        if person_id is not None:
            result = _handle_known_face(db, person_id, score, camera_name, image_bgr, centroid, face.bbox,
                                        zone_config, enabled_detections)
            for ev in result.get("triggered_events", []):
                if ev and ev.get("event_type_id") == "loitering":
                    loitering_person_ids.append(person_id)
        else:
            result = _handle_unknown_face(db, embedding, score, camera_name, image_bgr, centroid, face.bbox)

        result["keypoints"] = keypoints
        result["redlist_alert"] = _check_redlist(db, embedding, camera_name, image_bgr, camera_purpose)
        result["missing_person_alert"] = _check_missing_person(db, embedding, camera_name, image_bgr, camera_purpose)
        results.append(result)

    scene_events, yolo_person_count = _check_scene_events(db, camera_name, image_bgr, zone_config, enabled_detections, loitering_person_ids=loitering_person_ids)

    person_count = yolo_person_count if yolo_person_count is not None else len(results)

    return {
        "camera_name": camera_name,
        "camera_purpose": camera_purpose,
        "person_count": person_count,
        "detections": results,
        "scene_events": scene_events,
    }


@router.post("/api/detect/frame")
async def detect_frame(
    camera_name: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    contents = await image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        return {"camera_name": camera_name, "detections": [], "error": "Could not read image"}

    return run_detection(db, camera_name, image_bgr)


@router.get("/api/scene-events")
def list_scene_events(event_type: str = None, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(SceneEvent)
    if event_type:
        query = query.filter(SceneEvent.event_type == event_type)
    rows = query.order_by(SceneEvent.occurred_at.desc()).limit(limit).all()
    return [
        {
            "scene_event_id": r.scene_event_id,
            "event_type": r.event_type,
            "camera_name": r.camera_name,
            "detail": r.detail,
            "detection_image_path": r.detection_image_path,
            "image_url": to_image_url(r.detection_image_path),
            "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
        }
        for r in rows
    ]


@router.get("/api/scene-alerts")
def list_scene_alerts(event_type: str = None, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(SceneAlert)
    if event_type:
        query = query.filter(SceneAlert.event_type == event_type)
    rows = query.order_by(SceneAlert.occurred_at.desc()).limit(limit).all()
    return [
        {
            "alert_id": r.scene_alert_id,
            "event_type": r.event_type,
            "camera_name": r.camera_name,
            "zone_name": r.zone_name,
            "person_count": r.person_count,
            "detail": r.detail,
            "image_url": to_image_url(r.detection_image_path),
            "acknowledged": bool(r.acknowledged),
            "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
        }
        for r in rows
    ]


@router.patch("/api/scene-alerts/{alert_id}/acknowledge")
def acknowledge_scene_alert(alert_id: int, db: Session = Depends(get_db), _auth = Depends(get_current_user)):
    alert = db.query(SceneAlert).filter(SceneAlert.scene_alert_id == alert_id).first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = 1
    db.commit()
    return {"alert_id": alert_id, "acknowledged": True}


@router.get("/api/participants/{person_id}/detections")
def get_participant_detections(person_id: str, db: Session = Depends(get_db)):
    rows = db.query(Detection).filter(Detection.person_id == person_id).order_by(Detection.detected_at.desc()).all()
    return [
        {
            "detection_id": d.detection_id,
            "camera_name": d.camera_name,
            "match_confidence": d.match_confidence,
            "detection_image_path": d.detection_image_path,
            "image_url": to_image_url(d.detection_image_path),
            "centroid": [d.centroid_x, d.centroid_y] if d.centroid_x is not None else None,
            "detected_at": d.detected_at.isoformat() if d.detected_at else None,
        }
        for d in rows
    ]
