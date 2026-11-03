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
    """新建机会。source_name、source_tier、dedupe_key 和时间戳由服务端填写。"""

    title: str = Field(description="标题")
    kind: Kind = Field(description="internship、campus_recruit 或 competition")
    company: str = Field(description="单位或竞赛主办方")
    deadline_at: datetime = Field(description="截止时间。不带时区时按亚洲/上海理解")
    source_url: str | None = Field(default=None, description="来源链接。缺失或空白返回 400")
    role_tags: list[str] = Field(default_factory=list, description="岗位或方向标签")
    location: str | None = Field(default=None, description="地点")
    apply_url: str | None = Field(default=None, description="投递或报名链接")
    summary: str | None = Field(default=None, description="摘要")
    status: Status | None = Field(default=None, description="省略时为 active")

    @field_validator("title", "company")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value

    @field_validator("role_tags")
    @classmethod
    def strip_tags(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item and item.strip()]


class OpportunityUpdate(BaseModel):
    """局部更新。只提交需要修改的字段。"""

    title: str | None = Field(default=None, description="标题")
    kind: Kind | None = Field(default=None, description="internship、campus_recruit 或 competition")
    company: str | None = Field(default=None, description="单位或竞赛主办方")
    deadline_at: datetime | None = Field(default=None, description="截止时间")
    source_url: str | None = Field(default=None, description="来源链接")
    role_tags: list[str] | None = Field(default=None, description="岗位或方向标签")
    location: str | None = Field(default=None, description="地点")
    apply_url: str | None = Field(default=None, description="投递或报名链接")
    summary: str | None = Field(default=None, description="摘要")
    status: Status | None = Field(
        default=None,
        description="active、expired、duplicate 或 withdrawn",
    )

    @field_validator("title", "company")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value

    @field_validator("role_tags")
    @classmethod
    def strip_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item.strip() for item in value if item and item.strip()]


class OpportunityOut(BaseModel):
    """机会的完整记录。"""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="主键")
    title: str = Field(description="标题")
    kind: Kind = Field(description="internship、campus_recruit 或 competition")
    company: str = Field(description="单位或竞赛主办方")
    deadline_at: datetime = Field(description="截止时间，UTC")
    source_url: str = Field(description="来源链接")
    source_name: str = Field(description="来源名称，由学校配置解析")
    source_tier: SourceTier = Field(description="来源可信级别")
    status: Status = Field(description="active、expired、duplicate 或 withdrawn")
    dedupe_key: str = Field(description="规范化单位、标题与上海时区截止日期")
    published_at: datetime = Field(description="首次写入时间，UTC")
    updated_at: datetime = Field(description="最近更新时间，UTC")
    fetched_at: datetime = Field(description="本次收录时间，UTC")
    role_tags: list[str] = Field(default_factory=list, description="岗位或方向标签")
    location: str | None = Field(default=None, description="地点")
    apply_url: str | None = Field(default=None, description="投递或报名链接")
    summary: str | None = Field(default=None, description="摘要")

    @field_validator("role_tags", mode="before")
    @classmethod
    def default_tags(cls, value):
        return value or []


class ExpireResult(BaseModel):
    """过期任务结果。"""

    expired: int = Field(description="本次标为 expired 的条数")
