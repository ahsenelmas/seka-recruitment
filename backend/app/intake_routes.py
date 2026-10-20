from typing import Annotated
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.cv_routes import MAX_SIZE, UPLOAD_DIR, stored_path
from app.demo_access import DemoAccess, demo_access, require_hr
from app.database import get_db
from app.models import Branch, Candidate
from app.pdf_validation import pdf_problem
from app.schemas import CandidateOut

router = APIRouter(prefix="/api", tags=["Przykładowe aplikacje e-mail"])


@router.post("/intake/sample-email", response_model=CandidateOut, status_code=201)
def sample_email_intake(
    first_name: Annotated[str, Form(min_length=1, max_length=100)],
    last_name: Annotated[str, Form(min_length=1, max_length=100)],
    email: Annotated[str, Form(min_length=3, max_length=254)],
    email_subject: Annotated[str, Form(min_length=1, max_length=255)],
    email_body: Annotated[str, Form(min_length=1, max_length=10000)],
    position: Annotated[str | None, Form(max_length=150)] = None,
    branch_id: Annotated[int | None, Form(gt=0)] = None,
    file: Annotated[UploadFile | None, File()] = None,
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    path = None
    try:
        require_hr(access)
        fields = dict(first_name=first_name.strip(), last_name=last_name.strip(),
                      email=email.strip().lower(), email_subject=email_subject.strip(),
                      email_body=email_body.strip())
        if any(not value for value in fields.values()):
            raise HTTPException(status_code=400, detail="Wypełnij wymagane dane nadawcy i wiadomości.")
        local, sep, domain = fields["email"].partition("@")
        if not sep or not local or "@" in local or any(c.isspace() for c in local) or domain != "example.com":
            raise HTTPException(status_code=400, detail="Użyj fikcyjnego adresu w domenie example.com.")
        branch = db.get(Branch, branch_id) if branch_id is not None else None
        if branch_id is not None and branch is None:
            raise HTTPException(status_code=404, detail="Nie znaleziono oddziału.")
        key = original_name = problem = None
        content = None
        if file is not None:
            original_name = (file.filename or "zalacznik").replace("\\", "/").split("/")[-1][:255]
            content = file.file.read(MAX_SIZE + 1)
            if len(content) > MAX_SIZE:
                raise HTTPException(status_code=413, detail="Maksymalny rozmiar pliku to 5 MB.")
            problem = pdf_problem(content, original_name)
            # Keep the application and diagnostic, but do not expose unreadable attachments.
            if problem is None:
                UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                key = f"{uuid4().hex}.pdf"
                path = stored_path(key)
        candidate = Candidate(**fields, position=(position or "").strip() or None,
                              branch=branch, status="new", source="sample_email",
                              hr_notes="Aplikacja demonstracyjna z przykładowej wiadomości e-mail.",
                              cv_storage_key=key, cv_original_filename=original_name if key else None,
                              cv_validation_error=problem)
        if path is not None:
            path.write_bytes(content) # type: ignore
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return candidate
    except Exception:
        db.rollback()
        if path is not None:
            path.unlink(missing_ok=True)
        raise
    finally:
        if file is not None:
            file.file.close()
