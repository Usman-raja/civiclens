from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    event_id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(String, ForeignKey("participants.person_id"), nullable=False)
    detection_id = Column(Integer, ForeignKey("detections.detection_id"), nullable=True)
    event_type_id = Column(String, ForeignKey("event_types.event_type_id"), nullable=False)
    camera_name = Column(String, nullable=False)
    score_before = Column(Integer, nullable=False)
    score_delta = Column(Integer, nullable=False)
    score_after = Column(Integer, nullable=False)
    occurred_at = Column(DateTime, server_default=func.now())
