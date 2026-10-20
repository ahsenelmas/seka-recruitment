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
from app.follow_up import build_follow_up


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
    position: Mapped[str | None] = mapped_column(String(150), index=True)

    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id"),
        index=True,
    )
    branch: Mapped["Branch | None"] = relationship(
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

    cv_validation_error: Mapped[str | None] = mapped_column(String(255))

    @property
    def missing_information(self) -> list[str]:
        issues = []
        if self.cv_validation_error:
            issues.append("invalid_cv")
        elif not self.cv_storage_key:
            issues.append("missing_cv")
        if self.branch_id is None:
            issues.append("missing_city")
        if not self.position or not self.position.strip():
            issues.append("missing_position")
        return issues

    @property
    def follow_up_email(self) -> dict:
        return build_follow_up(self)

    @property
    def is_complete(self) -> bool:
        return not self.missing_information

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
