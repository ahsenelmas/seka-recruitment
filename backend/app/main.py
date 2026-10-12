from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

app = FastAPI(
    title="SEKA Recruitment API",
    description="System zarządzania rekrutacją SEKA",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "message": "API działa poprawnie",
    }


@app.get("/api/health/database")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Nie można połączyć się z bazą danych.",
        ) from None

    return {
        "status": "ok",
        "message": "Połączenie z bazą danych działa poprawnie",
    }

from app.routes import router

app.include_router(router)

from app.cv_routes import router as cv_router

app.include_router(cv_router)

from app.intake_routes import router as intake_router

app.include_router(intake_router)
