from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, get_dashboard_service
from app.models.user import User
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard(user: User = Depends(get_current_user),
                  svc: DashboardService = Depends(get_dashboard_service)):
    return svc.stats(user.id)