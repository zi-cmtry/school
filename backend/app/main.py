import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (register tables)
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
    title="CDUT Trusted Info",
    version="1.0.0",
    summary="Campus trusted-info aggregator for 成都理工大学",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(opportunities_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok"}
