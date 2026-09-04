"""Queue consumer handler — processes detection events published to Redis."""

import logging

from app.database import SessionLocal

logger = logging.getLogger(__name__)


def handle_queue_event(event_type: str, payload: dict) -> None:
    """Process a single event from the message queue.

    This runs in a background thread. Each event opens its own DB session.
    """
    db = SessionLocal()
    try:
        if event_type == "detection":
            _process_detection(db, payload)
        elif event_type.startswith("alert:"):
            _process_alert(db, event_type, payload)
        else:
            logger.debug("Unknown queue event: %s", event_type)
    except Exception as e:
        logger.error("Queue handler error for %s: %s", event_type, e)
        db.rollback()
    finally:
        db.close()


def _process_detection(db, payload: dict):
    """Process a detection result received from a worker node."""
    from app.models.detection import Detection

    det = Detection(
        participant_id=payload.get("participant_id"),
        camera_id=payload.get("camera_id"),
        zone_id=payload.get("zone_id"),
        confidence=payload.get("confidence", 0),
        face_embedding=payload.get("face_embedding"),
        image_path=payload.get("image_path"),
        is_known=payload.get("is_known", False),
    )
    db.add(det)
    db.commit()
    logger.info("Queue: processed detection for camera %s", payload.get("camera_id"))


def _process_alert(db, event_type: str, payload: dict):
    """Process an alert received from a worker node."""
    from app.models.alert import Alert

    alert_kind = event_type.replace("alert:", "")
    alert = Alert(
        camera_id=payload.get("camera_id"),
        alert_type=alert_kind,
        severity=payload.get("severity", "medium"),
        description=payload.get("description", ""),
        participant_id=payload.get("participant_id"),
        evidence_path=payload.get("evidence_path"),
    )
    db.add(alert)
    db.commit()
    logger.info("Queue: processed %s alert for camera %s", alert_kind, payload.get("camera_id"))
