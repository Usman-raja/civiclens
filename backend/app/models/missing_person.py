from sqlalchemy import Column, String, Integer, DateTime

from app.database import Base


class MissingPerson(Base):
    __tablename__ = "missing_persons"

    missing_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    description = Column(String, nullable=True)
    contact_info = Column(String, nullable=True)
    representative_image_path = Column(String, nullable=True)
    active = Column(Integer, nullable=False, default=1)
    detection_count = Column(Integer, nullable=False, default=0)
    last_camera_name = Column(String, nullable=True)
    reported_missing_since = Column(DateTime, nullable=True)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
