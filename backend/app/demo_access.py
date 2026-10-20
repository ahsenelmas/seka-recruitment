"""DEMO ONLY. Users freely choose roles; this is not authentication."""
from dataclasses import dataclass
from typing import Literal
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Branch, Candidate

Role = Literal["admin", "hr_manager", "branch_manager"]

@dataclass(frozen=True)
class DemoAccess:
    role: Role = "hr_manager"
    branch_id: int | None = None


def demo_access(seka_demo: str | None = Cookie(default=None)) -> DemoAccess:
    if seka_demo is None:
        return DemoAccess()
    try:
        role, raw_id = seka_demo.split(":", 1)
        if role not in {"admin", "hr_manager", "branch_manager"}:
            raise ValueError()
        branch_id = int(raw_id) if raw_id else None
        if role == "branch_manager" and (branch_id is None or branch_id <= 0):
            raise ValueError()
        if role != "branch_manager" and branch_id is not None:
            raise ValueError()
        return DemoAccess(role, branch_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Nieprawidłowy kontekst demonstracyjny. Wybierz rolę ponownie.") from None


def candidate_scope(access: DemoAccess):
    return [Candidate.branch_id == access.branch_id] if access.role == "branch_manager" else []


def require_hr(access: DemoAccess):
    if access.role == "branch_manager":
        raise HTTPException(status_code=403, detail="Kierownik oddziału ma dostęp tylko do odczytu.")


class DemoSelection(BaseModel):
    role: Role
    branch_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def valid_branch(self):
        if self.role == "branch_manager" and self.branch_id is None:
            raise ValueError("Wybierz oddział.")
        if self.role != "branch_manager" and self.branch_id is not None:
            raise ValueError("Oddział dotyczy wyłącznie kierownika oddziału.")
        return self


router = APIRouter(prefix="/api/demo", tags=["Symulacja ról — bez logowania"])

@router.get("/context")
def get_context(response: Response, db: Session = Depends(get_db), access: DemoAccess = Depends(demo_access)):
    response.headers["Cache-Control"] = "no-store"
    return {"role": access.role, "branch_id": access.branch_id, "simulation": True,
            "branches": [{"id": b.id, "city": b.city, "name": b.name}
                         for b in db.scalars(select(Branch).order_by(Branch.city)).all()]}


@router.post("/context")
def select_context(payload: DemoSelection, response: Response, db: Session = Depends(get_db)):
    if payload.branch_id is not None and db.get(Branch, payload.branch_id) is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono oddziału.")
    response.set_cookie("seka_demo", f"{payload.role}:{payload.branch_id or ''}",
                        httponly=True, samesite="lax", path="/api", max_age=28800)
    response.headers["Cache-Control"] = "no-store"
    return {"role": payload.role, "branch_id": payload.branch_id, "simulation": True}

@router.get('/admin-overview')
def admin_overview(access: DemoAccess = Depends(demo_access)):
    if access.role != 'admin':
        raise HTTPException(status_code=403, detail='Dostęp tylko dla administratora.')
    return {'authentication': 'demo_only', 'company_login': 'not_connected',
            'email_delivery': 'not_configured', 'roles': ['admin', 'hr_manager', 'branch_manager']}
