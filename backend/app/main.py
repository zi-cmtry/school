import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  注册数据表
from app.db import Base, engine
from app.jobs.scheduler import shutdown_scheduler, start_scheduler
from app.routers.opportunities import router as opportunities_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("DISABLE_SCHEDULER") != "1":
        start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="成都理工大学校园可信信息",
    version="1.0.0",
    summary="汇总学校渠道的实习、校招与竞赛",
    description="记录由接口或种子脚本写入。服务不抓取网页，也不生成文案。",
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
