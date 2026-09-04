from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event_type import EventType
from app.models.event import Event
from app.models.participant import Participant
from app.services.scoring_engine import apply_event
from app.services.security import require_admin, get_current_user

router = APIRouter()


class TriggerEventRequest(BaseModel):
    person_id: str
    event_type_id: str
    camera_name: str


class EventTypeRequest(BaseModel):
    event_type_id: str
    display_name: str
    category: str
    score_delta: int
    description: str = ""


@router.get("/api/event-types")
def list_event_types(db: Session = Depends(get_db)):
    types = db.query(EventType).all()
    return [
        {"event_type_id": t.event_type_id, "display_name": t.display_name,
         "category": t.category, "score_delta": t.score_delta, "description": t.description}
        for t in types
    ]


@router.post("/api/event-types")
def create_event_type(payload: EventTypeRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    if payload.category not in ("positive", "negative"):
        raise HTTPException(status_code=400, detail="category must be 'positive' or 'negative'")
    existing = db.query(EventType).filter(EventType.event_type_id == payload.event_type_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="An event type with this ID already exists")
    event_type = EventType(
        event_type_id=payload.event_type_id,
        display_name=payload.display_name,
        category=payload.category,
        score_delta=payload.score_delta,
        description=payload.description,
    )
    db.add(event_type)
    db.commit()
    return {"event_type_id": payload.event_type_id, "display_name": payload.display_name,
            "category": payload.category, "score_delta": payload.score_delta, "description": payload.description}


@router.put("/api/event-types/{event_type_id}")
def update_event_type(event_type_id: str, payload: EventTypeRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    if payload.category not in ("positive", "negative"):
        raise HTTPException(status_code=400, detail="category must be 'positive' or 'negative'")
    event_type = db.query(EventType).filter(EventType.event_type_id == event_type_id).first()
    if event_type is None:
        raise HTTPException(status_code=404, detail="Event type not found")
    event_type.display_name = payload.display_name
    event_type.category = payload.category
    event_type.score_delta = payload.score_delta
    event_type.description = payload.description
    db.commit()
    return {"event_type_id": event_type_id, "display_name": payload.display_name,
            "category": payload.category, "score_delta": payload.score_delta, "description": payload.description}


@router.delete("/api/event-types/{event_type_id}")
def delete_event_type(event_type_id: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    event_type = db.query(EventType).filter(EventType.event_type_id == event_type_id).first()
    if event_type is None:
        raise HTTPException(status_code=404, detail="Event type not found")
    db.delete(event_type)
    db.commit()
    return {"deleted": event_type_id}


@router.post("/api/events/trigger")
def trigger_event(payload: TriggerEventRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    try:
        return apply_event(db, payload.person_id, payload.event_type_id, payload.camera_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/participants/{person_id}/events")
def get_participant_events(person_id: str, db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.person_id == person_id).order_by(Event.occurred_at.desc()).all()
    return [
        {"event_id": e.event_id, "event_type_id": e.event_type_id, "camera_name": e.camera_name,
         "score_before": e.score_before, "score_delta": e.score_delta, "score_after": e.score_after,
         "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None}
        for e in events
    ]


@router.get("/api/dashboard/recent-events")
def recent_events(limit: int = 20, db: Session = Depends(get_db)):
    rows = (
        db.query(Event, Participant.name)
        .join(Participant, Event.person_id == Participant.person_id)
        .order_by(Event.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "event_id": e.event_id,
            "person_id": e.person_id,
            "name": name,
            "event_type_id": e.event_type_id,
            "camera_name": e.camera_name,
            "score_before": e.score_before,
            "score_delta": e.score_delta,
            "score_after": e.score_after,
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
        }
        for e, name in rows
    ]


@router.get("/api/reports/incident-log")
def incident_log(limit: int = 200, db: Session = Depends(get_db)):
    rows = (
        db.query(Event, Participant.name)
        .join(Participant, Event.person_id == Participant.person_id)
        .join(EventType, Event.event_type_id == EventType.event_type_id)
        .filter(EventType.category == "negative")
        .order_by(Event.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "event_id": e.event_id,
            "person_id": e.person_id,
            "name": name,
            "event_type_id": e.event_type_id,
            "camera_name": e.camera_name,
            "score_delta": e.score_delta,
            "score_after": e.score_after,
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
        }
        for e, name in rows
    ]
