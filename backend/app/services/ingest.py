"""把白名单摘录写入机会表。同一来源可重复执行，沿用去重和过期清理。"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.collect import Candidate, collect_candidates
from app.services.dedupe import make_dedupe_key
from app.services.expire import expire_overdue
from app.services.fields import GENERIC_MAJOR, MISSING
from app.services.sources import resolve_source


def ingest_opportunities(db: Session, *, fetch=None) -> dict:
    """增量采集：已有 source_url 只更新摘录，不另插一条。"""
    report = collect_candidates(fetch) if fetch else collect_candidates()
    created = 0
    updated = 0
    skipped = 0
    for candidate in report.candidates:
        outcome = _upsert(db, candidate)
        if outcome == "created":
            created += 1
        elif outcome == "updated":
            updated += 1
        else:
            skipped += 1
    expired = expire_overdue(db)
    notes = list(report.notes)
    if expired:
        notes.append(f"顺带把 {expired} 条已过截止时间的记录标为过期")
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "rejected": report.rejected,
        "notes": notes[:12],
    }


def _upsert(db: Session, candidate: Candidate) -> str:
    if candidate.reject_reason or candidate.deadline_at is None:
        return "skipped"
    source_name, source_tier = resolve_source(candidate.source_url, candidate.kind)
    now = datetime.now(timezone.utc)
    dedupe_key = make_dedupe_key(candidate.company, candidate.title, candidate.deadline_at)
    existing = db.scalars(
        select(Opportunity).where(Opportunity.source_url == candidate.source_url)
    ).first()
    if existing is None:
        conflict = db.scalars(
            select(Opportunity).where(
                Opportunity.dedupe_key == dedupe_key,
                Opportunity.status == "active",
            )
        ).first()
        if conflict is not None:
            return "skipped"
        db.add(
            Opportunity(
                title=candidate.title,
                kind=candidate.kind,
                company=candidate.company,
                deadline_at=candidate.deadline_at,
                source_url=candidate.source_url,
                source_name=source_name,
                source_tier=source_tier,
                status="active",
                dedupe_key=dedupe_key,
                published_at=now,
                updated_at=now,
                fetched_at=now,
                role_tags=candidate.role_tags,
                location=None if candidate.work_location == MISSING else candidate.work_location,
                apply_url=candidate.apply_url,
                summary=candidate.summary,
                work_location=candidate.work_location or MISSING,
                responsibilities=candidate.responsibilities or MISSING,
                requirements=candidate.requirements or MISSING,
                major_requirements=candidate.major_requirements or MISSING,
                major_tags=candidate.major_tags or [GENERIC_MAJOR],
            )
        )
        db.commit()
        return "created"

    conflict = db.scalars(
        select(Opportunity).where(
            Opportunity.dedupe_key == dedupe_key,
            Opportunity.status == "active",
            Opportunity.id != existing.id,
        )
    ).first()
    if conflict is not None:
        return "skipped"
    existing.title = candidate.title
    existing.kind = candidate.kind
    existing.company = candidate.company
    existing.deadline_at = candidate.deadline_at
    existing.source_name = source_name
    existing.source_tier = source_tier
    existing.dedupe_key = dedupe_key
    existing.updated_at = now
    existing.fetched_at = now
    existing.location = None if candidate.work_location == MISSING else candidate.work_location
    existing.apply_url = candidate.apply_url
    existing.summary = candidate.summary
    existing.work_location = candidate.work_location or MISSING
    existing.responsibilities = candidate.responsibilities or MISSING
    existing.requirements = candidate.requirements or MISSING
    existing.major_requirements = candidate.major_requirements or MISSING
    existing.major_tags = candidate.major_tags or [GENERIC_MAJOR]
    if existing.status == "active":
        existing.role_tags = candidate.role_tags or existing.role_tags
    db.commit()
    return "updated"
