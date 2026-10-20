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

@app.middleware("http")
async def no_cached_demo_data(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, no-store"
        vary = response.headers.get("Vary", "")
        if "cookie" not in {part.strip().lower() for part in vary.split(",")}:
            response.headers["Vary"] = (vary + ", Cookie").strip(", ")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
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

from app.demo_access import router as demo_router
app.include_router(demo_router)
