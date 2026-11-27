from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.chat import router as chat_router
from app.routers.documents import router as documents_router
from app.routers.bots import router as bot_router
from app.routers.public import router as public_router
from app.routers.dashboard import router as dashboard_router
from app.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(bot_router)
app.include_router(public_router)
app.include_router(dashboard_router)

@app.get("/")
def health():
    return {
        "status":"online"
    }