from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.database import Base


class SceneAlert(Base):
    __tablename__ = "scene_alerts"

    scene_alert_id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False)   # "crowd_detected" | "illegal_parking" | ...
    camera_name = Column(String, nullable=False)
    zone_name = Column(String, nullable=True)
    person_count = Column(Integer, nullable=True)
    detail = Column(String, nullable=True)
    detection_image_path = Column(String, nullable=True)
    acknowledged = Column(Integer, nullable=False, default=0)
    occurred_at = Column(DateTime, server_default=func.now())
