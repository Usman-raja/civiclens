from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.participant import Participant
from app.models.event import Event
from app.models.redlist_person import RedListPerson
from app.models.scene_event import SceneEvent
from app.models.alert import Alert

router = APIRouter()

RISK_LEVELS = ["Low", "Medium", "High", "Critical"]


def _score_color(score: int) -> str:
    if score >= 7:
        return "green"
    if score >= 4:
        return "gray"
    return "red"


@router.get("/api/analytics/summary")
def analytics_summary(db: Session = Depends(get_db)):
    participants = db.query(Participant).all()
    score_distribution = {"green": 0, "gray": 0, "red": 0}
    for p in participants:
        score_distribution[_score_color(p.current_score)] += 1

    event_rows = db.query(Event.event_type_id, func.count(Event.event_id)).group_by(Event.event_type_id).all()
    event_type_counts = [{"event_type_id": eid, "count": count} for eid, count in event_rows]

    redlist_rows = (
        db.query(RedListPerson.risk_level, func.count(RedListPerson.redlist_id))
        .filter(RedListPerson.active == 1)
        .group_by(RedListPerson.risk_level)
        .all()
    )
    redlist_risk_counts = {level: 0 for level in RISK_LEVELS}
    for level, count in redlist_rows:
        if level in redlist_risk_counts:
            redlist_risk_counts[level] = count

    scene_rows = db.query(SceneEvent.event_type, func.count(SceneEvent.scene_event_id)).group_by(SceneEvent.event_type).all()
    scene_event_counts = {etype: count for etype, count in scene_rows}

    return {
        "score_distribution": score_distribution,
        "event_type_counts": event_type_counts,
        "redlist_risk_counts": redlist_risk_counts,
        "scene_event_counts": scene_event_counts,
        "total_alerts": db.query(Alert).count(),
        "total_participants": len(participants),
    }
