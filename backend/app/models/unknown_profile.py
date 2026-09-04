from sqlalchemy import Column, String, Integer, DateTime

from app.database import Base


class UnknownProfile(Base):
    __tablename__ = "unknown_profiles"

    unknown_id = Column(String, primary_key=True)  # e.g. "U001"
    embedding = Column(String, nullable=False)
    representative_image_path = Column(String, nullable=True)
    detection_count = Column(Integer, nullable=False, default=1)
    last_camera_name = Column(String, nullable=True)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    claimed = Column(Integer, nullable=False, default=0)  # 0 = still unknown, 1 = registered since
    converted_to_person_id = Column(String, nullable=True)
