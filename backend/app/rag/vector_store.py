from langchain_chroma import Chroma

class VectorStore:
    def __init__(self, db_path, embedding):
        self.db_path = db_path
        self.embedding = embedding
        self.db = Chroma(persist_directory=self.db_path,embedding_function=self.embedding)

    def add(self,chunks):
        return self.db.add_documents(chunks) 
    
    def load(self):
        return self.db

    def delete_by_document(self, document_id: int):
        self.db.delete(where={"document_id": document_id})

    def delete_by_bot(self, bot_id: int):
        self.db.delete(where={"bot_id": bot_id})