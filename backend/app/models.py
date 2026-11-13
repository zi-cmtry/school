from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, TypeDecorator

from app.db import Base
from app.services.fields import GENERIC_MAJOR, MISSING

SHANGHAI = ZoneInfo("Asia/Shanghai")


class UTCDateTime(TypeDecorator):
    """带时区的时刻按 UTC 存成无时区时间，读出时恢复为带 UTC 时区。"""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=SHANGHAI)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        Index(
            "uq_opportunities_active_dedupe",
            "dedupe_key",
            unique=True,
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    deadline_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    dedupe_key: Mapped[str] = mapped_column(String(700), nullable=False)
    published_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    role_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    apply_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_location: Mapped[str] = mapped_column(String(200), nullable=False, default=MISSING)
    responsibilities: Mapped[str] = mapped_column(Text, nullable=False, default=MISSING)
    requirements: Mapped[str] = mapped_column(Text, nullable=False, default=MISSING)
    major_requirements: Mapped[str] = mapped_column(Text, nullable=False, default=MISSING)
    major_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=lambda: [GENERIC_MAJOR])
    # 疑似提示。空数组表示没有。不参与状态、列表过滤或采集拒收。
    risk_flags: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default=text("'[]'"))
