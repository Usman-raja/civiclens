from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Participant(Base):
    __tablename__ = "participants"

    person_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    registered_face_image_path = Column(String, nullable=False)
    current_score = Column(Integer, nullable=False, default=5)
    positive_event_count = Column(Integer, nullable=False, default=0)
    negative_event_count = Column(Integer, nullable=False, default=0)
    total_detections = Column(Integer, nullable=False, default=0)
    latest_detection_image_path = Column(String, nullable=True)
    last_camera_name = Column(String, nullable=True)
    last_match_confidence = Column(Float, nullable=True)
    # External-source fields (NADRA / Excel imports keep their source data)
    external_id = Column(String, nullable=True)   # CNIC / NIC / employee ID
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    source = Column(String, nullable=True)        # e.g. "NADRA export", "Excel"
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
