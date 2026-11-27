from sqlalchemy import String,Boolean
from sqlalchemy.orm import Mapped,mapped_column,relationship
from datetime import datetime, timezone
from app.db.types import UTCDateTime
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True) 
    email: Mapped[str] = mapped_column(String(255),unique=True,index=True,nullable=False)
    name:  Mapped[str] = mapped_column(String(255),nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))
    documents = relationship("Document",back_populates="user",cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user",cascade="all, delete-orphan")