import os
import tempfile
from pathlib import Path

_db_dir = Path(tempfile.mkdtemp(prefix="school-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_db_dir / 'test.db'}"
os.environ["DISABLE_SCHEDULER"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
