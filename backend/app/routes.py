from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.demo_access import DemoAccess, demo_access, candidate_scope, require_hr
from app.database import get_db
from app.models import Branch, Candidate
from app.schemas import (
    BranchOut,
    CandidateOut,
    CandidatePage,
    CandidateStatus,
    CandidateUpdate,
)

router = APIRouter(prefix="/api", tags=["Rekrutacja"])


@router.get("/branches", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db), access: DemoAccess = Depends(demo_access)):
    return db.scalars(
        select(Branch).where(*([Branch.id == access.branch_id] if access.role == "branch_manager" else [])).order_by(Branch.city)
    ).all()


@router.get("/positions", response_model=list[str])
def list_positions(db: Session = Depends(get_db), access: DemoAccess = Depends(demo_access)):
    return db.scalars(
        select(Candidate.position)
        .where(Candidate.position.is_not(None), *candidate_scope(access))
        .distinct()
        .order_by(Candidate.position)
    ).all()


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), access: DemoAccess = Depends(demo_access)):
    statuses = {
        "new": 0,
        "review": 0,
        "interview": 0,
        "hired": 0,
        "rejected": 0,
    }

    counts = db.execute(
        select(Candidate.status, func.count(Candidate.id)).where(*candidate_scope(access))
        .group_by(Candidate.status)
    ).all()

    for status, count in counts:
        statuses[status] = count

    branches = db.execute(
        select(
            Branch.id,
            Branch.city,
            func.count(Candidate.id).label("total"),
        )
        .outerjoin(Candidate, Candidate.branch_id == Branch.id)
        .where(*([Branch.id == access.branch_id] if access.role == "branch_manager" else []))
        .group_by(Branch.id, Branch.city)
        .order_by(Branch.city)
    ).all()

    return {
        "total": sum(statuses.values()),
        "by_status": statuses,
        "unassigned": db.scalar(select(func.count(Candidate.id)).where(Candidate.branch_id.is_(None), *candidate_scope(access))),
        "by_branch": [
            {
                "branch_id": row.id,
                "city": row.city,
                "total": row.total,
            }
            for row in branches
        ],
    }


@router.get("/candidates", response_model=CandidatePage)
def list_candidates(
    search: str | None = Query(default=None, max_length=200),
    city: str | None = Query(default=None, max_length=100),
    position: str | None = Query(default=None, max_length=150),
    status: CandidateStatus | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    filters = candidate_scope(access)

    if search and search.strip():
        # Escape SQL wildcard characters so search is literal.
        escaped = (
            search.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{escaped}%"
        full_name = Candidate.first_name + " " + Candidate.last_name

        filters.append(
            or_(
                full_name.ilike(pattern, escape="\\"),
                Candidate.email.ilike(pattern, escape="\\"),
                Candidate.position.ilike(pattern, escape="\\"),
            )
        )

    if city:
        filters.append(Branch.city == city)
    if position:
        filters.append(Candidate.position == position)
    if status:
        filters.append(Candidate.status == status)

    total = db.scalar(
        select(func.count(Candidate.id))
        .outerjoin(Branch)
        .where(*filters)
    )

    items = db.scalars(
        select(Candidate)
        .outerjoin(Branch)
        .options(joinedload(Candidate.branch))
        .where(*filters)
        .order_by(Candidate.created_at.desc(), Candidate.id)
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def find_candidate(candidate_id: UUID, db: Session, access: DemoAccess):
    candidate = db.scalar(
        select(Candidate)
        .options(joinedload(Candidate.branch))
        .where(Candidate.id == candidate_id, *candidate_scope(access))
    )
    if candidate is None:
        raise HTTPException(
            status_code=404,
            detail="Nie znaleziono kandydata.",
        )
    return candidate


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(
    candidate_id: UUID,
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    return find_candidate(candidate_id, db, access)


@router.patch("/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: UUID,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    access: DemoAccess = Depends(demo_access),
):
    require_hr(access)
    candidate = find_candidate(candidate_id, db, access)
    changes = payload.model_dump(exclude_unset=True)

    if "branch_id" in changes:
        branch_id = changes.pop("branch_id")
        branch = db.get(Branch, branch_id) if branch_id is not None else None
        if branch_id is not None and branch is None:
            raise HTTPException(
                status_code=404,
                detail="Nie znaleziono oddziału.",
            )
        candidate.branch = branch

    for field, value in changes.items():
        setattr(candidate, field, value)

    db.commit()
    db.refresh(candidate)
    return candidate
