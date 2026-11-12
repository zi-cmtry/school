from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity
from app.schemas import (
    JOB_KINDS,
    KINDS,
    STATUSES,
    ExpireResult,
    IngestResult,
    OpportunityCreate,
    OpportunityOut,
    OpportunityUpdate,
)
from app.services.dedupe import make_dedupe_key
from app.services.expire import expire_overdue
from app.services.fields import GENERIC_MAJOR, MISSING, location_rank, major_matches
from app.services.ingest import ingest_opportunities
from app.services.sources import resolve_source

router = APIRouter()


def require_source_url(source_url: str | None) -> str:
    if source_url is None or not source_url.strip():
        raise HTTPException(status_code=400, detail="source_url 不能为空")
    cleaned = source_url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="source_url 必须是绝对的 http(s) 地址")
    return cleaned


def _active_conflict(db: Session, dedupe_key: str, exclude_id: int | None = None) -> None:
    stmt = select(Opportunity).where(
        Opportunity.dedupe_key == dedupe_key,
        Opportunity.status == "active",
    )
    if exclude_id is not None:
        stmt = stmt.where(Opportunity.id != exclude_id)
    if db.scalars(stmt).first() is not None:
        raise HTTPException(
            status_code=409,
            detail="已存在相同 dedupe_key 的有效记录",
        )


def _url_conflict(db: Session, source_url: str, exclude_id: int | None = None) -> None:
    stmt = select(Opportunity).where(Opportunity.source_url == source_url)
    if exclude_id is not None:
        stmt = stmt.where(Opportunity.id != exclude_id)
    if db.scalars(stmt).first() is not None:
        raise HTTPException(status_code=409, detail="source_url 已存在")


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="与已有记录冲突")


def _sort_rows(rows: list[Opportunity], major: str | None) -> list[Opportunity]:
    """实习和校招：相关专业在前，其次成都，再是其他省内。竞赛只按相关度，不因没有工作地丢掉。"""

    def sort_key(row: Opportunity):
        related = major_matches(major, row.major_tags, row.major_requirements)
        if row.kind == "competition":
            place = 0
        else:
            place_text = row.work_location if row.work_location and row.work_location != MISSING else (row.location or "")
            place = location_rank(place_text)
        return (0 if related else 1, place, row.deadline_at, row.id)

    return sorted(rows, key=sort_key)


@router.get(
    "/opportunities",
    response_model=list[OpportunityOut],
    tags=["机会"],
    summary="机会列表",
    description=(
        "默认只返回 status=active 的 internship 与 campus_recruit。"
        "实习和校招把成都市岗排在前面，其他省内岗留在后面，不隐藏。"
        "传入 major 时，在当前 kind 里把专业要求或专业标签对得上的排在前面，其余仍返回。"
        "「通用」不算对口，也不按职位名匹配。竞赛不因没有工作地被排除。"
    ),
)
def list_opportunities(
    kind: str | None = Query(
        default=None,
        description="internship、campus_recruit 或 competition。省略时只含前两类。",
    ),
    status: str | None = Query(default=None, description="默认 active"),
    major: str | None = Query(
        default=None,
        description="学生专业，例如大数据管理与应用。只影响同一 kind 内的顺序，不过滤。",
    ),
    db: Session = Depends(get_db),
) -> list[Opportunity]:
    if kind is not None and kind not in KINDS:
        raise HTTPException(status_code=400, detail="kind 无效")
    effective_status = status or "active"
    if effective_status not in STATUSES:
        raise HTTPException(status_code=400, detail="status 无效")

    stmt = select(Opportunity).where(Opportunity.status == effective_status)
    if kind is None:
        stmt = stmt.where(Opportunity.kind.in_(JOB_KINDS))
    else:
        stmt = stmt.where(Opportunity.kind == kind)
    rows = list(db.scalars(stmt))
    needle = major.strip() if major else ""
    return _sort_rows(rows, needle or None)


@router.get(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityOut,
    tags=["机会"],
    summary="机会详情",
)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)) -> Opportunity:
    row = db.get(Opportunity, opportunity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="未找到该机会")
    return row


@router.post(
    "/opportunities",
    response_model=OpportunityOut,
    status_code=201,
    tags=["机会"],
    summary="新建机会",
    description="source_name、source_tier 与 dedupe_key 由服务端根据来源和标题生成。",
)
def create_opportunity(payload: OpportunityCreate, db: Session = Depends(get_db)) -> Opportunity:
    source_url = require_source_url(payload.source_url)
    now = datetime.now(timezone.utc)
    status = payload.status or "active"
    dedupe_key = make_dedupe_key(payload.company, payload.title, payload.deadline_at)
    source_name, source_tier = resolve_source(source_url, payload.kind)
    _url_conflict(db, source_url)
    if status == "active":
        _active_conflict(db, dedupe_key)

    row = Opportunity(
        title=payload.title,
        kind=payload.kind,
        company=payload.company,
        deadline_at=payload.deadline_at,
        source_url=source_url,
        source_name=source_name,
        source_tier=source_tier,
        status=status,
        dedupe_key=dedupe_key,
        published_at=now,
        updated_at=now,
        fetched_at=now,
        role_tags=payload.role_tags,
        location=payload.location,
        apply_url=payload.apply_url,
        summary=payload.summary,
        work_location=payload.work_location or MISSING,
        responsibilities=payload.responsibilities or MISSING,
        requirements=payload.requirements or MISSING,
        major_requirements=payload.major_requirements or MISSING,
        major_tags=payload.major_tags or [GENERIC_MAJOR],
    )
    db.add(row)
    _commit(db)
    db.refresh(row)
    return row


@router.patch(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityOut,
    tags=["机会"],
    summary="更新机会",
    description="只更新请求体里出现的字段，并重新计算 dedupe_key。",
)
def update_opportunity(
    opportunity_id: int,
    payload: OpportunityUpdate,
    db: Session = Depends(get_db),
) -> Opportunity:
    row = db.get(Opportunity, opportunity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="未找到该机会")

    data = payload.model_dump(exclude_unset=True)
    if not data:
        return row

    if "source_url" in data:
        data["source_url"] = require_source_url(data["source_url"])
        _url_conflict(db, data["source_url"], exclude_id=row.id)

    title = data.get("title", row.title)
    company = data.get("company", row.company)
    deadline_at = data.get("deadline_at", row.deadline_at)
    kind = data.get("kind", row.kind)
    source_url = data.get("source_url", row.source_url)
    status = data.get("status", row.status)
    dedupe_key = make_dedupe_key(company, title, deadline_at)
    if status == "active":
        _active_conflict(db, dedupe_key, exclude_id=row.id)

    for field, value in data.items():
        setattr(row, field, value)
    if "source_url" in data or "kind" in data:
        row.source_name, row.source_tier = resolve_source(source_url, kind)
    row.dedupe_key = dedupe_key
    row.updated_at = datetime.now(timezone.utc)
    _commit(db)
    db.refresh(row)
    return row


@router.delete(
    "/opportunities/{opportunity_id}",
    status_code=204,
    tags=["机会"],
    summary="删除机会",
)
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db)) -> Response:
    row = db.get(Opportunity, opportunity_id)
    if row is None:
        raise HTTPException(status_code=404, detail="未找到该机会")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/admin/jobs/expire",
    response_model=ExpireResult,
    tags=["管理"],
    summary="执行过期任务",
    description="把 deadline_at 已过的 active 记录标为 expired。与每小时的定时任务相同。",
)
def trigger_expire(db: Session = Depends(get_db)) -> ExpireResult:
    count = expire_overdue(db)
    return ExpireResult(expired=count)


@router.post(
    "/admin/jobs/ingest",
    response_model=IngestResult,
    tags=["管理"],
    summary="执行白名单采集",
    description=(
        "从学生就业指导中心、企业自己的招聘页和本校竞赛白名单做增量采集。"
        "先处理工作地在成都的岗位，再处理四川省内其他城市。可重复执行。"
        "原文没有的字段记为未提供。不访问 Boss 直聘、智联、前程无忧等聚合站。"
    ),
)
def trigger_ingest(db: Session = Depends(get_db)) -> IngestResult:
    return IngestResult(**ingest_opportunities(db))
