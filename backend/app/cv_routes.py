import os
import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.pdf_validation import pdf_problem
from app.config import BACKEND_DIR
from app.demo_access import DemoAccess, demo_access, require_hr
from app.database import get_db
from app.routes import find_candidate
from app.schemas import CandidateOut

router = APIRouter(prefix="/api", tags=["Dokumenty CV"])

UPLOAD_DIR = Path(
    os.environ.get("UPLOAD_DIR", str(BACKEND_DIR / "uploads"))
).resolve()

MAX_SIZE = 5 * 1024 * 1024


def stored_path(key: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}\.pdf", key):
        raise HTTPException(
            status_code=404,
            detail="Nie znaleziono dokumentu CV.",
        )
    return UPLOAD_DIR / key


@router.post(
    "/candidates/{candidate_id}/cv",
    response_model=CandidateOut,
)
def upload_cv(
    candidate_id: UUID,
    file: UploadFile,
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    require_hr(access)
    candidate = find_candidate(candidate_id, db, access)

    try:
        original_name = (file.filename or "").replace("\\", "/").split("/")[-1]

        content = file.file.read(MAX_SIZE + 1)
        if len(content) > MAX_SIZE:
            raise HTTPException(status_code=413, detail="Maksymalny rozmiar pliku to 5 MB.")
        problem = pdf_problem(content, original_name)
        if problem:
            raise HTTPException(status_code=400, detail=problem)
    finally:
        file.file.close()

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    key = f"{uuid4().hex}.pdf"
    path = stored_path(key)
    old_key = candidate.cv_storage_key

    try:
        path.write_bytes(content)
        candidate.cv_validation_error = None
        candidate.cv_storage_key = key
        candidate.cv_original_filename = original_name[:255]
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise

    # Remove the previous file only after the new reference is committed.
    if old_key and re.fullmatch(r"[0-9a-f]{32}\.pdf", old_key):
        try:
            stored_path(old_key).unlink(missing_ok=True)
        except OSError:
            pass

    db.refresh(candidate)
    return candidate


@router.get("/candidates/{candidate_id}/cv")
def view_cv(
    candidate_id: UUID,
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    candidate = find_candidate(candidate_id, db, access)

    if not candidate.cv_storage_key:
        raise HTTPException(
            status_code=404,
            detail="Nie dodano dokumentu CV.",
        )

    path = stored_path(candidate.cv_storage_key)

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Nie znaleziono dokumentu CV.",
        )

    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=candidate.cv_original_filename or "cv.pdf",
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff"},
    )
