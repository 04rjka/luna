from fastapi import HTTPException,status
from sqlalchemy import select
from sqlalchemy.orm import Session
from pathlib import Path

from app.rag.vector_store import VectorStore
from app.models.bot import Bot
from app.models.user import User
from app.models.document import Document
from app.models.chat import Conversation

class BotService:
    def __init__(self, db: Session, vector_store: VectorStore):
        self.db, self.vector_store = db, vector_store

    def create(self, user: User, data: dict) -> Bot:
        bot = Bot(owner_id=user.id, **data)
        self.db.add(bot); self.db.commit(); self.db.refresh(bot)
        return bot

    def list(self, user_id: str):
        return self.db.scalars(select(Bot).where(Bot.owner_id == user_id)
                               .order_by(Bot.id.desc())).all()

    def get(self, user_id: str, bot_id: int) -> Bot:
        bot = self.db.scalars(select(Bot).where(Bot.id == bot_id, Bot.owner_id == user_id)).first()
        if not bot:
            raise HTTPException(404, "Bot not found")
        return bot

    def update(self, user_id: str, bot_id: int, data: dict) -> Bot:
        bot = self.get(user_id, bot_id)
        for k, v in data.items():
            setattr(bot, k, v)
        self.db.commit(); self.db.refresh(bot)
        return bot

    def delete(self, user_id: str, bot_id: int):
        bot = self.get(user_id, bot_id)
        self.vector_store.delete_by_bot(bot.id)
        for doc in self.db.scalars(select(Document).where(Document.bot_id == bot.id)):
            Path(doc.file_path).unlink(missing_ok=True)
            self.db.delete(doc)
        for conv in self.db.scalars(select(Conversation).where(Conversation.bot_id == bot.id)):
            self.db.delete(conv)
        self.db.delete(bot); self.db.commit()