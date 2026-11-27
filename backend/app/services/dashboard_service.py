from datetime import datetime, time, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bot import Bot
from app.models.chat import Conversation, Message
from app.models.document import Document


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def stats(self, user_id: str):
        bots = self.db.scalars(
            select(Bot).where(Bot.owner_id == user_id).order_by(Bot.id.desc())
        ).all()
        ids = [b.id for b in bots]

        today = datetime.now(timezone.utc).date()
        daily = {today - timedelta(days=i): 0 for i in range(6, -1, -1)}

        if not ids:
            return {
                "totals": {"bots": 0, "documents": 0, "failed_documents": 0,
                           "conversations": 0, "questions": 0},
                "daily": [{"date": d.isoformat(), "count": 0} for d in daily],
                "bots": [], "recent": [],
            }

        doc_counts = dict(self.db.execute(
            select(Document.bot_id, func.count(Document.id))
            .where(Document.bot_id.in_(ids)).group_by(Document.bot_id)).all())

        failed = self.db.scalar(
            select(func.count(Document.id))
            .where(Document.bot_id.in_(ids), Document.status == "failed")) or 0

        conv_counts = dict(self.db.execute(
            select(Conversation.bot_id, func.count(Conversation.id))
            .where(Conversation.bot_id.in_(ids)).group_by(Conversation.bot_id)).all())

        question_counts = dict(self.db.execute(
            select(Conversation.bot_id, func.count(Message.id))
            .select_from(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.bot_id.in_(ids), Message.role == "user")
            .group_by(Conversation.bot_id)).all())

        # questions per day (bucketed in Python so it works on any database)
        since = datetime.combine(min(daily), time.min, tzinfo=timezone.utc)
        stamps = self.db.scalars(
            select(Message.created_at)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.bot_id.in_(ids), Message.role == "user",
                   Message.created_at >= since)).all()
        for ts in stamps:
            if ts.date() in daily:
                daily[ts.date()] += 1

        names = {b.id: b.name for b in bots}
        recent_rows = self.db.execute(
            select(Message.content, Message.created_at, Conversation.bot_id)
            .select_from(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.bot_id.in_(ids), Message.role == "user")
            .order_by(Message.created_at.desc()).limit(8)).all()

        return {
            "totals": {
                "bots": len(bots),
                "documents": sum(doc_counts.values()),
                "failed_documents": failed,
                "conversations": sum(conv_counts.values()),
                "questions": sum(question_counts.values()),
            },
            "daily": [{"date": d.isoformat(), "count": c} for d, c in daily.items()],
            "bots": [{
                "id": b.id, "name": b.name,
                "documents": doc_counts.get(b.id, 0),
                "conversations": conv_counts.get(b.id, 0),
                "questions": question_counts.get(b.id, 0),
            } for b in bots],
            "recent": [{
                "bot_id": bid, "bot_name": names.get(bid, ""),
                "question": content[:140], "created_at": created,
            } for content, created, bid in recent_rows],
        }