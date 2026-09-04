from sqlalchemy.orm import Session

from app.models.participant import Participant
from app.models.event_type import EventType
from app.models.event import Event


def score_color(score: int) -> str:
    if score >= 7:
        return "green"
    if score >= 4:
        return "gray"
    return "red"


def apply_event(db: Session, person_id: str, event_type_id: str, camera_name: str, detection_id: int = None):
    participant = db.query(Participant).filter(Participant.person_id == person_id).first()
    if participant is None:
        raise ValueError(f"Unknown participant {person_id}")

    event_type = db.query(EventType).filter(EventType.event_type_id == event_type_id).first()
    if event_type is None:
        raise ValueError(f"Unknown event type {event_type_id}")

    score_before = participant.current_score
    score_after = max(1, min(10, score_before + event_type.score_delta))

    db.add(Event(
        person_id=person_id,
        detection_id=detection_id,
        event_type_id=event_type_id,
        camera_name=camera_name,
        score_before=score_before,
        score_delta=event_type.score_delta,
        score_after=score_after,
    ))

    participant.current_score = score_after
    if event_type.category == "positive":
        participant.positive_event_count += 1
    else:
        participant.negative_event_count += 1

    db.commit()
    db.refresh(participant)

    return {
        "person_id": person_id,
        "event_type_id": event_type_id,
        "score_before": score_before,
        "score_delta": event_type.score_delta,
        "score_after": score_after,
        "score_color": score_color(score_after),
    }
