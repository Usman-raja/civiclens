from sqlalchemy import Column, String, Integer

from app.database import Base


class Camera(Base):
    __tablename__ = "cameras"

    camera_name = Column(String, primary_key=True)
    zone_config = Column(String, nullable=True)
    purpose = Column(String, nullable=False, default="Custom")
    enabled_detections = Column(String, nullable=True)
    source_type = Column(String, nullable=False, default="manual")  # manual | rtsp | file
    source_path = Column(String, nullable=True)
    capture_interval = Column(Integer, nullable=False, default=5)
    monitoring_enabled = Column(Integer, nullable=False, default=0)
