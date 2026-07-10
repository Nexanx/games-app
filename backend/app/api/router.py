from fastapi import APIRouter

from app.api import backlog, backup, chat, completed_games, dashboard, games, poe

api_router = APIRouter()
api_router.include_router(games.router, prefix="/games", tags=["games"])
api_router.include_router(backlog.router, prefix="/backlog", tags=["backlog"])
api_router.include_router(backup.router, prefix="/backup", tags=["backup"])
api_router.include_router(completed_games.router, prefix="/completed-games", tags=["completed-games"])
api_router.include_router(poe.router, prefix="/poe", tags=["path-of-exile"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
