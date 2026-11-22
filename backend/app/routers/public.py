import json
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.db import SessionLocal, get_db
from app.dependencies import get_chat_service, get_retriever
from app.models.bot import Bot
from app.rag.chains import rag_chain, query_formulation_chain
from app.rag.retriever import Retriever
from app.services.chat_service import ChatService

router = APIRouter(prefix="/public/bots", tags=["Public"])

# ---------- simple in-memory rate limiting ----------
_hits: dict[str, deque] = defaultdict(deque)

def rate_limit(key: str, limit: int, window: int = 60):
    q, now = _hits[key], time.time()
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many messages, please slow down.")
    q.append(now)

# ---------- schemas ----------
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    visitor_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")

def find_bot(key: str, db: Session) -> Bot:
    bot = db.scalars(select(Bot).where(Bot.public_key == key)).first()
    if not bot:
        raise HTTPException(404, "Bot not found")
    return bot

# ---------- routes ----------
@router.get("/{key}/config")
def config(key: str, db: Session = Depends(get_db)):
    bot = find_bot(key, db)
    return {
        "name": bot.name,
        "greeting": bot.greeting,
        "theme": bot.theme,
        "allowed_origins": bot.allowed_origins,
    }

@router.get("/{key}/history")
def history(
    key: str,
    visitor_id: str = Query(min_length=8, max_length=64),
    db: Session = Depends(get_db),
    svc: ChatService = Depends(get_chat_service),
):
    bot = find_bot(key, db)
    conv = svc.get_visitor_conversation(bot, visitor_id, create=False)
    if not conv:
        return {"messages": []}
    msgs = svc.get_messages_of(conv.id)
    return {"messages": [{"role": m.role, "content": m.content} for m in msgs]}

@router.post("/{key}/chat")
async def chat(
    key: str,
    body: ChatIn,
    request: Request,
    retriever: Retriever = Depends(get_retriever),
):
    with SessionLocal() as db:
        bot_id = find_bot(key, db).id

    ip = request.client.host if request.client else "unknown"
    rate_limit(f"v:{key}:{body.visitor_id}", limit=15)
    rate_limit(f"ip:{ip}", limit=30)
    rate_limit(f"bot:{key}", limit=200)

    async def stream():
        with SessionLocal() as db:          # own session for the whole stream
            try:
                bot = db.get(Bot, bot_id)
                svc = ChatService(
                    retriever=retriever,
                    rag_chain=rag_chain,
                    query_formulation_chain=query_formulation_chain,
                    db=db,
                )
                conv = svc.get_visitor_conversation(bot, body.visitor_id, create=True)
                async for event in svc.ask(body.message, user_id=None, conversation=conv, bot=bot):
                    yield event
            except Exception as exc:
                print("public chat error:", repr(exc))
                err = {"type": "error", "content": "Something went wrong. Please try again."}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )