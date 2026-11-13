import os
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "opportunities.db"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DB_PATH}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def _make_engine(url: str):
    connect_args: dict = {}
    kwargs: dict = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if url in {"sqlite://", "sqlite:///:memory:"} or ":memory:" in url:
            kwargs["poolclass"] = StaticPool
        else:
            path = url.removeprefix("sqlite:///")
            if path:
                Path(path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(url, connect_args=connect_args, **kwargs)


engine = _make_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_opportunity_columns() -> None:
    """给已有的 SQLite 表补上摘录字段。新库由 create_all 建齐。"""
    if not str(engine.url).startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if not inspector.has_table("opportunities"):
        return
    existing = {column["name"] for column in inspector.get_columns("opportunities")}
    statements = {
        "work_location": "ALTER TABLE opportunities ADD COLUMN work_location VARCHAR(200) DEFAULT '未提供' NOT NULL",
        "responsibilities": "ALTER TABLE opportunities ADD COLUMN responsibilities TEXT DEFAULT '未提供' NOT NULL",
        "requirements": "ALTER TABLE opportunities ADD COLUMN requirements TEXT DEFAULT '未提供' NOT NULL",
        "major_requirements": "ALTER TABLE opportunities ADD COLUMN major_requirements TEXT DEFAULT '未提供' NOT NULL",
        "major_tags": """ALTER TABLE opportunities ADD COLUMN major_tags JSON DEFAULT '["通用"]' NOT NULL""",
        "risk_flags": """ALTER TABLE opportunities ADD COLUMN risk_flags JSON DEFAULT '[]' NOT NULL""",
    }
    with engine.begin() as connection:
        for name, sql in statements.items():
            if name not in existing:
                connection.execute(text(sql))
