from sqlalchemy import Column, Integer, String, ForeignKey, Float, Boolean, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Detection(Base):
    __tablename__ = "detections"

    detection_id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(String, ForeignKey("participants.person_id"), nullable=True)
    unknown_id = Column(String, ForeignKey("unknown_profiles.unknown_id"), nullable=True)
    camera_name = Column(String, nullable=False)
    detection_image_path = Column(String, nullable=True)
    match_confidence = Column(Float, nullable=True)
    is_known = Column(Boolean, nullable=False)
    centroid_x = Column(Float, nullable=True)
    centroid_y = Column(Float, nullable=True)
    detected_at = Column(DateTime, server_default=func.now())
