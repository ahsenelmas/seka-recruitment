import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(150))

    candidates: Mapped[list["Candidate"]] = relationship(
        back_populates="branch"
    )


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        CheckConstraint(
            "status IN ('new', 'review', 'interview', 'hired', 'rejected')",
            name="candidate_status_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    position: Mapped[str] = mapped_column(String(150), index=True)

    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id"),
        index=True,
    )
    branch: Mapped["Branch"] = relationship(
        back_populates="candidates"
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="new",
        index=True,
    )
    hr_notes: Mapped[str] = mapped_column(Text, default="")

    source: Mapped[str] = mapped_column(String(30), default="manual")
    email_subject: Mapped[str | None] = mapped_column(String(255))
    email_body: Mapped[str | None] = mapped_column(Text)

    cv_storage_key: Mapped[str | None] = mapped_column(String(255))
    cv_original_filename: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
