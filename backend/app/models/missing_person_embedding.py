from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.database import Base


class MissingPersonEmbedding(Base):
    __tablename__ = "missing_person_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    missing_id = Column(String, ForeignKey("missing_persons.missing_id", ondelete="CASCADE"), nullable=False)
    embedding = Column(String, nullable=False)
    model_name = Column(String, nullable=False, default="buffalo_l")
    created_at = Column(DateTime, server_default=func.now())
