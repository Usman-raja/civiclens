from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class SceneEvent(Base):
    __tablename__ = "scene_events"

    scene_event_id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False)  # "crowd_detected" | "illegal_parking" | ...
    camera_name = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    detection_image_path = Column(String, nullable=True)
    occurred_at = Column(DateTime, server_default=func.now())
