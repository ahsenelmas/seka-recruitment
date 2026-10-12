from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

CandidateStatus = Literal[
    "new", "review", "interview", "hired", "rejected"
]


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city: str
    name: str


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    position: str
    branch: BranchOut
    status: CandidateStatus
    hr_notes: str
    source: str
    email_subject: str | None
    email_body: str | None
    cv_original_filename: str | None
    created_at: datetime
    updated_at: datetime


class CandidatePage(BaseModel):
    items: list[CandidateOut]
    total: int
    limit: int
    offset: int


class CandidateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: CandidateStatus | None = None
    hr_notes: str | None = Field(default=None, max_length=10000)
    branch_id: int | None = Field(default=None, gt=0)
    position: str | None = Field(
        default=None, min_length=1, max_length=150
    )

    @model_validator(mode="after")
    def validate_changes(self):
        for field in self.model_fields_set:
            value = getattr(self, field)
            if value is None:
                raise ValueError("Pole nie może mieć wartości null.")
            if field == "position":
                self.position = value.strip()
                if not self.position:
                    raise ValueError("Stanowisko nie może być puste.")
        return self
