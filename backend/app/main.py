from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.api.router import api_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

allowed_origins = sorted({settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.exception_handler(OperationalError)
async def database_connection_error_handler(_, exc: OperationalError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "detail": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database connection failed. Check DATABASE_URL and PostgreSQL credentials.",
            }
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_, exc: SQLAlchemyError) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "DATABASE_ERROR",
                "message": "Database operation failed.",
            }
        },
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
