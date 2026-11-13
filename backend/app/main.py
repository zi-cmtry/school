import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  注册数据表
from app.db import Base, engine, ensure_opportunity_columns
from app.jobs.scheduler import shutdown_scheduler, start_scheduler
from app.routers.opportunities import router as opportunities_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_opportunity_columns()
    if os.getenv("DISABLE_SCHEDULER") != "1":
        start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="成都理工大学校园可信信息",
    version="1.0.0",
    summary="汇总学校渠道的实习、校招与竞赛",
    description=(
        "实习、校招和竞赛来自学校白名单。定时或手动采集只摘录原文，"
        "没有的职责、任职要求、专业要求和工作地记为「未提供」。"
        "工作地写明在四川省外的实习和校招，不进入默认列表，也不进入省内视图。"
        "不访问招聘聚合站，也不补写岗位。"
        "risk_flags 只提示疑似问题，不因此下架或拒收。"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(opportunities_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["健康检查"], summary="健康检查")
def health() -> dict:
    """服务可用时返回 status=ok。"""
    return {"status": "ok"}
