from tests.helpers import sample


def test_missing_source_url_is_400(client):
    body = sample()
    body.pop("source_url")
    response = client.post("/api/v1/opportunities", json=body)
    assert response.status_code == 400
    assert response.json()["detail"] == "source_url 不能为空"


def test_blank_source_url_is_400(client):
    response = client.post("/api/v1/opportunities", json=sample(source_url="   "))
    assert response.status_code == 400
    assert response.json()["detail"] == "source_url 不能为空"


def test_relative_source_url_is_400(client):
    response = client.post(
        "/api/v1/opportunities",
        json=sample(source_url="cdutjy.cdut.edu.cn/info/1.htm"),
    )
    assert response.status_code == 400
    assert "http(s)" in response.json()["detail"]


def test_invalid_kind_is_422(client):
    response = client.post("/api/v1/opportunities", json=sample(kind="job"))
    assert response.status_code == 422


def test_blank_title_is_422(client):
    response = client.post("/api/v1/opportunities", json=sample(title="  "))
    assert response.status_code == 422


def test_official_job_host(client):
    response = client.post("/api/v1/opportunities", json=sample())
    assert response.status_code == 201
    body = response.json()
    assert body["source_tier"] == "official"
    assert body["source_name"] == "学生就业指导中心"
    assert body["status"] == "active"
    assert body["dedupe_key"]
    assert body["published_at"] and body["updated_at"] and body["fetched_at"]


def test_competition_hosts_resolve_to_campus_channel(client):
    cases = [
        (
            "https://aao.cdut.edu.cn/info/1442/7000.htm",
            "教务处竞赛通知",
        ),
        (
            "https://cim.cdut.edu.cn/info/1098/6232.htm",
            "计算机学院竞赛",
        ),
        (
            "https://cmcc.cdut.edu.cn/info/1037/9038.htm",
            "材料与化学化工学院",
        ),
        (
            "https://scgxxkjs.moocollege.com/competition",
            "学科竞赛平台(moocollege)",
        ),
    ]
    for index, (url, name) in enumerate(cases):
        response = client.post(
            "/api/v1/opportunities",
            json=sample(
                title=f"竞赛{index}",
                kind="competition",
                company=f"主办方{index}",
                source_url=url,
                deadline_at=f"2027-0{index + 1}-15T18:00:00+08:00",
            ),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["source_tier"] == "campus_channel"
        assert body["source_name"] == name


def test_host_is_unverified_when_kind_does_not_apply(client):
    job_on_contest_host = client.post(
        "/api/v1/opportunities",
        json=sample(source_url="https://aao.cdut.edu.cn/info/1.htm"),
    )
    assert job_on_contest_host.status_code == 201
    assert job_on_contest_host.json()["source_tier"] == "unverified"

    contest_on_job_host = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="就业网上的竞赛",
            kind="competition",
            company="其他主办",
            source_url="https://cdutjy.cdut.edu.cn/info/contest.htm",
        ),
    )
    assert contest_on_job_host.status_code == 201
    assert contest_on_job_host.json()["source_tier"] == "unverified"


def test_unknown_host_is_unverified(client):
    response = client.post(
        "/api/v1/opportunities",
        json=sample(source_url="https://example.com/jobs/1"),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["source_tier"] == "unverified"
    assert body["source_name"] == "example.com"


def test_cp_moocollege_detail_is_campus_channel(client):
    """种子详情页必须是 campus_channel，不能是 unverified。"""
    url = "https://cp.moocollege.com/home/competition/details?competitionId=107706"
    response = client.post(
        "/api/v1/opportunities",
        json=sample(
            title="第三届四川省大学生智能医学创新设计大赛",
            kind="competition",
            company="四川省教育厅",
            source_url=url,
        ),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["source_url"] == url
    assert body["source_tier"] == "campus_channel"
    assert body["source_name"] == "学科竞赛平台(moocollege)"


def test_school_yaml_whitelists_moocollege_hosts():
    from app.services.sources import load_school

    load_school.cache_clear()
    matched = [
        source
        for source in load_school()["sources"]
        if source["tier"] == "campus_channel"
        and "competition" in source["applies_to"]
        and "cp.moocollege.com" in source["hosts"]
        and "scgxxkjs.moocollege.com" in source["hosts"]
    ]
    assert matched, "cp.moocollege.com 与 scgxxkjs.moocollege.com 必须同属竞赛 campus_channel 白名单"


def test_moocollege_job_is_unverified(client):
    response = client.post(
        "/api/v1/opportunities",
        json=sample(source_url="https://scgxxkjs.moocollege.com/competition"),
    )
    assert response.status_code == 201
    assert response.json()["source_tier"] == "unverified"


def test_health_and_cors(client):
    response = client.get("/api/v1/health", headers={"Origin": "https://example.edu"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["access-control-allow-origin"] == "*"
