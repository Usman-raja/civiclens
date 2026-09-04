from sqlalchemy import Column, String, Integer, DateTime

from app.database import Base


class RedListPerson(Base):
    __tablename__ = "redlist_persons"

    redlist_id = Column(String, primary_key=True)  # e.g. "R001"
    name = Column(String, nullable=False)
    risk_level = Column(String, nullable=False)     # Low | Medium | High | Critical
    category = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    representative_image_path = Column(String, nullable=True)
    active = Column(Integer, nullable=False, default=1)
    detection_count = Column(Integer, nullable=False, default=0)
    last_camera_name = Column(String, nullable=True)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
