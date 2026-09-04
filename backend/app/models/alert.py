from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(Integer, primary_key=True, autoincrement=True)
    redlist_id = Column(String, ForeignKey("redlist_persons.redlist_id"), nullable=False)
    camera_name = Column(String, nullable=False)
    similarity_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    detection_image_path = Column(String, nullable=True)
    acknowledged = Column(Integer, nullable=False, default=0)
    occurred_at = Column(DateTime, server_default=func.now())
