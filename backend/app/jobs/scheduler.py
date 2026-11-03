from apscheduler.schedulers.background import BackgroundScheduler

from app.db import SessionLocal
from app.services.expire import expire_overdue

_scheduler: BackgroundScheduler | None = None


def run_expire_job() -> int:
    db = SessionLocal()
    try:
        return expire_overdue(db)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(
        run_expire_job,
        trigger="interval",
        hours=1,
        id="expire_opportunities",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    _scheduler = scheduler
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
