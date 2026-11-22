from fastapi import APIRouter,Depends,status,BackgroundTasks,UploadFile,File
from app.services.bot_service import BotService
from app.services.document_service import DocumentService
from app.auth.dependencies import get_current_user
from app.dependencies import get_bot_service,get_document_service
from app.schemas.bot import BotIn,BotPatch

from app.models.user import User
from app.models.document import Document

router = APIRouter(prefix="/bots", tags=["Bots"])

@router.post("")
def create_bot(body: BotIn, user: User = Depends(get_current_user),
               svc: BotService = Depends(get_bot_service)):
    return svc.create(user, body.model_dump())

@router.get("")
def list_bots(user: User = Depends(get_current_user), svc: BotService = Depends(get_bot_service)):
    return svc.list(user.id)

@router.get("/{bot_id}")
def get_bot(bot_id: int, user: User = Depends(get_current_user), svc: BotService = Depends(get_bot_service)):
    return svc.get(user.id, bot_id)

@router.patch("/{bot_id}")
def update_bot(bot_id: int, body: BotPatch, user: User = Depends(get_current_user),
               svc: BotService = Depends(get_bot_service)):
    return svc.update(user.id, bot_id, body.model_dump(exclude_unset=True))

@router.delete("/{bot_id}", status_code=204)
def delete_bot(bot_id: int, user: User = Depends(get_current_user), svc: BotService = Depends(get_bot_service)):
    svc.delete(user.id, bot_id)

# ----- documents of a bot -----
@router.post("/{bot_id}/documents")
async def upload(bot_id: int, background: BackgroundTasks, file: UploadFile = File(...),
                 user: User = Depends(get_current_user),
                 bots: BotService = Depends(get_bot_service),
                 docs: DocumentService = Depends(get_document_service)):
    bot = bots.get(user.id, bot_id)             # ownership check
    return await docs.upload(file, user, bot, background)

@router.get("/{bot_id}/documents")
def bot_documents(bot_id: int, user: User = Depends(get_current_user),
                  bots: BotService = Depends(get_bot_service),
                  docs: DocumentService = Depends(get_document_service)):
    bots.get(user.id, bot_id)
    return docs.get_bot_documents(bot_id)