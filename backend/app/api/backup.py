from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_session
from app.schemas.backup import BackupDocument, BackupImportRequest, BackupImportResult
from app.services.backup_service import export_backup, replace_with_backup

router = APIRouter()


@router.get("/export", response_model=BackupDocument)
def export_data_backup(db: Session = Depends(get_session)) -> BackupDocument:
    return export_backup(db)


@router.post("/import", response_model=BackupImportResult)
def import_data_backup(payload: BackupImportRequest, db: Session = Depends(get_session)) -> BackupImportResult:
    return replace_with_backup(db, payload.backup.data)
