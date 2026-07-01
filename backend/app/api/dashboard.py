from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_session
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import build_dashboard_summary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_session)) -> DashboardSummary:
    return build_dashboard_summary(db)

