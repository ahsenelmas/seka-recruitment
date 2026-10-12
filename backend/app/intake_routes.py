from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.cv_routes import MAX_SIZE, UPLOAD_DIR, stored_path
from app.database import get_db
from app.models import Branch, Candidate
from app.schemas import CandidateOut

router = APIRouter(
    prefix="/api",
    tags=["Przykładowe aplikacje e-mail"],
)


@router.post(
    "/intake/sample-email",
    response_model=CandidateOut,
    status_code=201,
)
def sample_email_intake(
    first_name: Annotated[str, Form(min_length=1, max_length=100)],
    last_name: Annotated[str, Form(min_length=1, max_length=100)],
    email: Annotated[str, Form(min_length=3, max_length=254)],
    position: Annotated[str, Form(min_length=1, max_length=150)],
    branch_id: Annotated[int, Form(gt=0)],
    email_subject: Annotated[str, Form(min_length=1, max_length=255)],
    email_body: Annotated[str, Form(min_length=1, max_length=10000)],
    file: UploadFile,
    db: Session = Depends(get_db),
):
    try:
        fields = {
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "email": email.strip().lower(),
            "position": position.strip(),
            "email_subject": email_subject.strip(),
            "email_body": email_body.strip(),
        }

        if any(not value for value in fields.values()):
            raise HTTPException(
                status_code=400,
                detail="Wypełnij wszystkie wymagane pola.",
            )

        # Demo intake uses fictional addresses only.
        local_part, separator, domain = fields["email"].partition("@")
        if (
            not separator
            or not local_part
            or any(char.isspace() for char in local_part)
            or domain != "example.com"
        ):
            raise HTTPException(
                status_code=400,
                detail="Użyj fikcyjnego adresu w domenie example.com.",
            )

        branch = db.get(Branch, branch_id)
        if branch is None:
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono oddziału.",
            )

        original_name = (
            (file.filename or "")
            .replace("\\", "/")
            .split("/")[-1]
        )

        if not original_name.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Dozwolone są wyłącznie pliki PDF.",
            )

        content = file.file.read(MAX_SIZE + 1)

        if len(content) > MAX_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Maksymalny rozmiar pliku to 5 MB.",
            )

        if not content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="Plik nie ma prawidłowego nagłówka PDF.",
            )
    finally:
        file.file.close()

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{uuid4().hex}.pdf"
    path = stored_path(key)

    candidate = Candidate(
        **fields,
        branch=branch,
        status="new",
        source="sample_email",
        hr_notes="Aplikacja demonstracyjna z przykładowej wiadomości e-mail.",
        cv_storage_key=key,
        cv_original_filename=original_name[:255],
    )

    try:
        path.write_bytes(content)
        db.add(candidate)
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise

    db.refresh(candidate)
    return candidate
