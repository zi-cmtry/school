from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Kind = Literal["internship", "campus_recruit", "competition"]
Status = Literal["active", "expired", "duplicate", "withdrawn"]
SourceTier = Literal["official", "campus_channel", "student_submit", "unverified"]

KINDS: tuple[str, ...] = ("internship", "campus_recruit", "competition")
STATUSES: tuple[str, ...] = ("active", "expired", "duplicate", "withdrawn")
JOB_KINDS: tuple[str, ...] = ("internship", "campus_recruit")


class OpportunityCreate(BaseModel):
    title: str
    kind: Kind
    company: str
    deadline_at: datetime
    source_url: str | None = None
    role_tags: list[str] = Field(default_factory=list)
    location: str | None = None
    apply_url: str | None = None
    summary: str | None = None
    status: Status | None = None

    @field_validator("title", "company")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("role_tags")
    @classmethod
    def strip_tags(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item and item.strip()]


class OpportunityUpdate(BaseModel):
    title: str | None = None
    kind: Kind | None = None
    company: str | None = None
    deadline_at: datetime | None = None
    source_url: str | None = None
    role_tags: list[str] | None = None
    location: str | None = None
    apply_url: str | None = None
    summary: str | None = None
    status: Status | None = None

    @field_validator("title", "company")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("role_tags")
    @classmethod
    def strip_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item.strip() for item in value if item and item.strip()]


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    kind: Kind
    company: str
    deadline_at: datetime
    source_url: str
    source_name: str
    source_tier: SourceTier
    status: Status
    dedupe_key: str
    published_at: datetime
    updated_at: datetime
    fetched_at: datetime
    role_tags: list[str] = Field(default_factory=list)
    location: str | None = None
    apply_url: str | None = None
    summary: str | None = None

    @field_validator("role_tags", mode="before")
    @classmethod
    def default_tags(cls, value):
        return value or []


class ExpireResult(BaseModel):
    expired: int
