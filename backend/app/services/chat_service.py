from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from langchain_core.messages import AIMessage,HumanMessage
from fastapi import HTTPException,status
import json
from datetime import datetime, timedelta, timezone

from app.models.chat import Conversation, Message
from app.models.bot import Bot

class ChatService:
    def __init__(self,retriever,rag_chain,query_formulation_chain,db: Session):
        self.retriever = retriever
        self.rag_chain = rag_chain
        self.query_formulation_chain = query_formulation_chain
        self.db = db

    FALLBACK = "Sorry, I couldn't find that in my documents."

    def get_or_create_conversation(self,conversation_id:Optional[int],user_id:int,document_id:int,initial_title:str):
        if conversation_id:
            stmt = select(Conversation).where(Conversation.id==conversation_id,Conversation.user_id==user_id)
            conv = self.db.scalars(stmt).first()
            if not conv:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Chat not found")
            if conv.document_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="This chat's document has been deleted")
            
            return conv
        if not document_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="A document is required for a new chat")
        
        t = initial_title.strip()[:40]
        title = t[:1].upper() + t[1:]
        new_conv = Conversation(user_id = user_id,title=title,document_id=document_id)
        self.db.add(new_conv)
        self.db.commit()
        self.db.refresh(new_conv)
        return new_conv

    def get_conversation(self, user_id: int, conversation_id: int):
        stmt = select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        conversation = self.db.scalars(stmt).first()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return conversation      

    def get_visitor_conversation(self, bot, visitor_id: str, create: bool, idle_hours: int = 6):
        conv = self.db.scalars(
        select(Conversation)
        .where(Conversation.bot_id == bot.id, Conversation.visitor_id == visitor_id)
        .order_by(Conversation.created_at.desc())
    ).first()

        if conv:
            last = self.db.scalars(
            select(Message.created_at)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
        ).first()
            if last:
                if last.tzinfo is None:                      # in case the DB returns naive times
                    last = last.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - last < timedelta(hours=idle_hours):
                    return conv                              # still active

        if not create:
            return None

        conv = Conversation(bot_id=bot.id, visitor_id=visitor_id, title="Visitor chat")
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def get_messages_of(self, conversation_id: int):
        return self.db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()

    async def ask(self,question,user_id:int,conversation:Conversation,bot:Bot = None):

        stmt = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc())

        history_records = list(self.db.scalars(stmt).all())

        chat_history = []
        for msg in history_records[-6:]:
            if msg.content == self.FALLBACK:
                continue
            if msg.role == "user":
                chat_history.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                chat_history.append(AIMessage(content=msg.content))

        if chat_history:
            standalone_question = await self.query_formulation_chain.ainvoke({
                "chat_history":chat_history,
                "question":question
            })
        else:
            standalone_question = question

        self.db.add(Message(conversation_id=conversation.id,role="user",content=question))
        self.db.commit()

        if bot:
            docs = self.retriever.retrieve_for_bot(question=standalone_question, bot_id=bot.id)
        else:
            docs = self.retriever.retrieve(question=standalone_question, user_id=user_id,
                                           document_id=conversation.document_id)
            
        meta_payload = {
            "type": "metadata",
            "conversation_id": conversation.id
        }
        yield f"data: {json.dumps(meta_payload)}\n\n"

        if bot and not docs:
            # fallback = "Sorry, I couldn't find that in my documents."
            yield f"data: {json.dumps({'type': 'token', 'content': self.FALLBACK})}\n\n"
            self.db.add(Message(conversation_id=conversation.id, role="assistant", content=self.FALLBACK))
            self.db.commit()
            yield "data: [DONE]\n\n"
            return

        context="\n\n".join(
            doc.page_content
            for doc in docs
            )
        accumulated_answer = []

        async for chunk in self.rag_chain.astream({
            "context":context,
            "chat_history":chat_history,
            "question":question,
            "instructions": (bot.system_prompt or "") if bot else "",
        }):
            token = chunk.content if hasattr(chunk,"content") else str(chunk)
            accumulated_answer.append(token)
            token_payload = {"type":"token","content":token}
            yield f"data: {json.dumps(token_payload)}\n\n"

        full_response_text = "".join(accumulated_answer)

        
        ai_msg = Message(conversation_id=conversation.id,role="assistant",content=full_response_text)
        self.db.add(ai_msg)
        self.db.commit()

        yield "data: [DONE]\n\n"

    def get_conversations(self,user_id:int):
        stmt = select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.created_at.desc())
        converstations = self.db.scalars(stmt).all()
        return converstations

    def get_conversation_messages(self,user_id:int,conversation_id:int):
        stmt = select(Conversation).where(Conversation.user_id == user_id,Conversation.id == conversation_id)
        conversation = self.db.scalars(stmt).first()
        if not conversation:
            raise HTTPException(detail="Conversation not found or access denied.",status_code=status.HTTP_404_NOT_FOUND)

        msg_stmt = select(Message).where(Message.conversation_id== conversation_id).order_by(Message.created_at.asc())
        messages = self.db.scalars(msg_stmt).all()
        return messages

    def delete_conversation(self,user_id:int,conversation_id:int):
            stmt = select(Conversation).where(Conversation.user_id == user_id,Conversation.id == conversation_id)
            conversation = self.db.scalars(stmt).first()
            if not conversation:
                raise HTTPException(detail="Conversation not found or access denied.",status_code=status.HTTP_404_NOT_FOUND)

            self.db.delete(conversation)
            self.db.commit()