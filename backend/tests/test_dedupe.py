from datetime import datetime, timezone

from app.services.dedupe import make_dedupe_key, normalize
from tests.helpers import sample


def test_normalize_case_width_and_space():
    assert normalize("  Ｈｅｌｌｏ  World ") == normalize("hello world")
    assert normalize("海 尔智家") == "海尔智家"


def test_dedupe_key_uses_shanghai_calendar_date():
    morning = datetime(2026, 12, 1, 0, 30, tzinfo=timezone.utc)  # 上海时间 08:30
    evening = datetime(2026, 12, 1, 15, 0, tzinfo=timezone.utc)  # 上海时间 23:00
    before = datetime(2026, 11, 30, 15, 30, tzinfo=timezone.utc)  # 前一日 23:30
    assert make_dedupe_key("海尔", "校招", morning).endswith("|2026-12-01")
    assert make_dedupe_key("海尔", "校招", evening).endswith("|2026-12-01")
    assert make_dedupe_key("海尔", "校招", before).endswith("|2026-11-30")
    # 2026-11-30 16:30 UTC 是上海时间 2026-12-01 00:30。
    crossed = datetime(2026, 11, 30, 16, 30, tzinfo=timezone.utc)
    assert make_dedupe_key("海尔", "校招", crossed).endswith("|2026-12-01")


def test_same_shanghai_day_conflicts(client):
    first = client.post(
        "/api/v1/opportunities",
        json=sample(deadline_at="2027-06-01T09:00:00+08:00"),
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/opportunities",
        json=sample(
            deadline_at="2027-06-01T23:30:00+08:00",
            source_url="https://cdutjy.cdut.edu.cn/info/demo/2.htm",
            title="后端开发实习生",
            company="示例科技",
        ),
    )
    assert second.status_code == 409
    assert "dedupe_key" in second.json()["detail"]


def test_normalized_title_and_company_conflict(client):
    created = client.post("/api/v1/opportunities", json=sample(title="Hello World", company="ACME"))
    assert created.status_code == 201
    again = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="  hello   world ",
            company="ａｃｍｅ",
            source_url="https://cdutjy.cdut.edu.cn/info/demo/3.htm",
        ),
    )
    assert again.status_code == 409


def test_different_deadline_date_is_allowed(client):
    assert client.post("/api/v1/opportunities", json=sample()).status_code == 201
    response = client.post(
        "/api/v1/opportunities",
        json=sample(
            deadline_at="2027-06-02T18:00:00+08:00",
            source_url="https://cdutjy.cdut.edu.cn/info/demo/4.htm",
        ),
    )
    assert response.status_code == 201


def test_duplicate_source_url_is_409(client):
    assert client.post("/api/v1/opportunities", json=sample()).status_code == 201
    response = client.post(
        "/api/v1/opportunities",
        json=sample(title="另一个标题", company="另一家公司"),
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "source_url 已存在"


def test_expired_row_does_not_block_a_new_active(client):
    created = client.post(
        "/api/v1/opportunities",
        json=sample(status="expired"),
    )
    assert created.status_code == 201
    response = client.post(
        "/api/v1/opportunities",
        json=sample(source_url="https://cdutjy.cdut.edu.cn/info/demo/5.htm"),
    )
    assert response.status_code == 201
    assert response.json()["status"] == "active"


def test_naive_deadline_is_shanghai(client):
    response = client.post(
        "/api/v1/opportunities",
        json=sample(deadline_at="2027-08-01T23:30:00"),
    )
    assert response.status_code == 201
    assert response.json()["dedupe_key"].endswith("|2027-08-01")
