from app.jobs.scheduler import run_expire_job
from tests.helpers import sample


def test_expire_endpoint_marks_only_past_active(client):
    past = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="已过期岗位",
            company="甲公司",
            deadline_at="2020-01-01T12:00:00+08:00",
            source_url="https://cdutjy.cdut.edu.cn/info/past.htm",
        ),
    )
    future = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="未到期岗位",
            company="乙公司",
            deadline_at="2099-01-01T12:00:00+08:00",
            source_url="https://cdutjy.cdut.edu.cn/info/future.htm",
        ),
    )
    withdrawn = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="已撤回",
            company="丙公司",
            deadline_at="2020-01-01T12:00:00+08:00",
            source_url="https://cdutjy.cdut.edu.cn/info/withdrawn.htm",
            status="withdrawn",
        ),
    )
    assert past.status_code == future.status_code == withdrawn.status_code == 201

    result = client.post("/api/v1/admin/jobs/expire")
    assert result.status_code == 200
    assert result.json() == {"expired": 1}

    past_body = client.get(f"/api/v1/opportunities/{past.json()['id']}").json()
    future_body = client.get(f"/api/v1/opportunities/{future.json()['id']}").json()
    withdrawn_body = client.get(f"/api/v1/opportunities/{withdrawn.json()['id']}").json()
    assert past_body["status"] == "expired"
    assert future_body["status"] == "active"
    assert withdrawn_body["status"] == "withdrawn"

    again = client.post("/api/v1/admin/jobs/expire")
    assert again.json() == {"expired": 0}


def test_expire_job_entrypoint(client):
    created = client.post(
        "/api/v1/opportunities",
        json=sample(deadline_at="2020-05-01T08:00:00+08:00"),
    )
    assert created.status_code == 201
    assert run_expire_job() == 1
    body = client.get(f"/api/v1/opportunities/{created.json()['id']}").json()
    assert body["status"] == "expired"
    assert run_expire_job() == 0


def test_expired_record_drops_off_the_default_list(client):
    created = client.post(
        "/api/v1/opportunities",
        json=sample(deadline_at="2019-12-31T23:00:00+08:00"),
    )
    assert created.status_code == 201
    listed = client.get("/api/v1/opportunities")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [created.json()["id"]]

    client.post("/api/v1/admin/jobs/expire")
    assert client.get("/api/v1/opportunities").json() == []
    expired = client.get("/api/v1/opportunities?status=expired")
    assert [item["id"] for item in expired.json()] == [created.json()["id"]]
