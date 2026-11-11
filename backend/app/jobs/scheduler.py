from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import SessionLocal
from app.services.expire import expire_overdue
from app.services.ingest import ingest_opportunities

_scheduler: BackgroundScheduler | None = None


def run_expire_job() -> int:
    """执行一次过期扫描，供定时任务调用。"""
    db = SessionLocal()
    try:
        return expire_overdue(db)
    finally:
        db.close()


def run_ingest_job() -> dict:
    """执行一次白名单采集，供定时任务调用。重复跑不会插入同一来源。"""
    db = SessionLocal()
    try:
        return ingest_opportunities(db)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    """过期扫描每小时一次。白名单采集每 6 小时一次，先成都再省内，可重复执行。"""
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
    scheduler.add_job(
        run_ingest_job,
        trigger="interval",
        hours=6,
        id="ingest_opportunities",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        next_run_time=datetime.now(ZoneInfo("Asia/Shanghai")) + timedelta(hours=6),
    )
    scheduler.start()
    _scheduler = scheduler
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
