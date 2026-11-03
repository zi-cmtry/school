from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Opportunity


def expire_overdue(db: Session, now: datetime | None = None) -> int:
    """Mark active opportunities past their deadline as expired. Returns the count."""
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)

    rows = list(
        db.scalars(
            select(Opportunity).where(
                Opportunity.status == "active",
                Opportunity.deadline_at < now,
            )
        )
    )
    for row in rows:
        row.status = "expired"
        row.updated_at = now
    db.commit()
    return len(rows)
