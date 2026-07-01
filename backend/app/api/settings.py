from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_session
from app.models import Setting
from app.schemas.settings import SettingRead, SettingUpsert

router = APIRouter()


@router.get("", response_model=list[SettingRead])
def list_settings(db: Session = Depends(get_session)) -> list[Setting]:
    return db.scalars(select(Setting).order_by(Setting.key)).all()


@router.put("", response_model=SettingRead)
def upsert_setting(payload: SettingUpsert, db: Session = Depends(get_session)) -> Setting:
    setting = db.scalars(select(Setting).where(Setting.key == payload.key)).first()
    if not setting:
        setting = Setting(key=payload.key, value=payload.value)
        db.add(setting)
    else:
        setting.value = payload.value
    db.commit()
    db.refresh(setting)
    return setting

