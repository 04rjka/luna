from app.rag.pdf_loader import load_pdf,PDFLoader
from app.rag.chunking import DocumentSplitter
from app.rag.vector_store import VectorStore
from pathlib import Path
from app.config import settings

class IngestionService:
    def __init__(self, pdf_loader:PDFLoader,splitter:DocumentSplitter,vector_store:VectorStore ):
        self.pdf_loader = pdf_loader
        self.splitter = splitter
        self.vector_store = vector_store

    def ingest(self, pdf_path, user_id: str, document_id: int, bot_id: int | None = None):
        documents = self.pdf_loader.load(pdf_path)
        chunks = self.splitter.split_documents(documents)

        for chunk in chunks:
            chunk.metadata["user_id"] = user_id
            chunk.metadata["document_id"] = document_id
            if bot_id is not None:
                chunk.metadata["bot_id"] = bot_id

        self.vector_store.add(chunks)
        return {"chunks": len(chunks)}