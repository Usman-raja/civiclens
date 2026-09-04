from sqlalchemy import Column, String, Integer

from app.database import Base


class EventType(Base):
    __tablename__ = "event_types"

    event_type_id = Column(String, primary_key=True)
    display_name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    score_delta = Column(Integer, nullable=False)
    description = Column(String, nullable=True)
