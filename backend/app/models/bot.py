# backend/app/models/bot.py
import secrets
from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.db import Base

class Bot(Base):
    __tablename__ = "bots"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    public_key: Mapped[str] = mapped_column(
        String(32), unique=True, index=True,
        default=lambda: secrets.token_urlsafe(16))
    greeting: Mapped[str] = mapped_column(String(300), default="Hi! How can I help?")
    system_prompt: Mapped[str | None] = mapped_column(Text)
    theme: Mapped[dict] = mapped_column(JSON, default=dict)
    allowed_origins: Mapped[list] = mapped_column(JSON, default=list)  # ["https://shop.com"]