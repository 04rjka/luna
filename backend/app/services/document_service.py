from pathlib import Path
from uuid import uuid4
from app.config import settings
from fastapi import UploadFile,HTTPException,status,BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User
from app.models.document import Document
from app.services.ingestion_service import IngestionService
from app.db.db import SessionLocal

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB

class DocumentService:

    def __init__(self, db: Session, ingestion_service: IngestionService):
        self.db = db
        self.ingestion_service = ingestion_service
        self.upload_dir = Path(settings.upload_path)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload(self, file: UploadFile, current_user: User, bot, background: BackgroundTasks):
        if file.content_type != "application/pdf":
            raise HTTPException(400, "Only PDF files are allowed.")

        contents = await file.read()
        if len(contents) > MAX_PDF_BYTES:
            raise HTTPException(413, "File too large (max 10 MB).")
        if not contents.startswith(b"%PDF"):       # content_type can be faked
            raise HTTPException(400, "File is not a valid PDF.")

        folder = self.upload_dir / str(current_user.id) / str(bot.id)
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / f"{uuid4()}.pdf"
        file_path.write_bytes(contents)

        doc = Document(user_id=current_user.id, bot_id=bot.id,
                       filename=Path(file.filename).name,
                       file_path=str(file_path), status="processing")
        try:
            self.db.add(doc); self.db.commit(); self.db.refresh(doc)
        except Exception as exc:
            self.db.rollback()
            file_path.unlink(missing_ok=True)
            import traceback; traceback.print_exc()          # temporary
            raise HTTPException(500, f"Could not save the document: {exc}")

        background.add_task(self._ingest_job, doc.id, str(file_path), current_user.id, bot.id)
        return doc

    def _ingest_job(self, document_id: int, path: str, user_id: int, bot_id: int):
        # runs after the response, so it needs its own session
        with SessionLocal() as db:
            doc = db.get(Document, document_id)
            try:
                self.ingestion_service.ingest(path, user_id=user_id,
                                              document_id=document_id, bot_id=bot_id)
                doc.status = "ready"
            except Exception:
                doc.status = "failed"
            db.commit()

    def get_bot_documents(self, bot_id: int):
        return self.db.scalars(select(Document).where(Document.bot_id == bot_id)
                               .order_by(Document.created_at.desc())).all()

    def get_user_documents(self, user_id: int):
            return self.db.scalars(select(Document).where(Document.user_id == user_id)
                                   .order_by(Document.created_at.desc())).all()
    
    def delete_document(self, user_id: int, document_id: int):
        doc = self.get_document(user_id, document_id)   # existing owner check
        self.ingestion_service.vector_store.delete_by_document(doc.id)
        Path(doc.file_path).unlink(missing_ok=True)
        self.db.delete(doc); self.db.commit()