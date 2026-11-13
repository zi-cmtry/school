"""疑似欺骗标注。正向例子只用测试数据，不改演示种子。"""

import importlib.util
from datetime import datetime
from pathlib import Path

from app.services.dedupe import SHANGHAI
from app.services.risk import compute_risk_flags
from tests.helpers import sample


def _create(client, **overrides):
    response = client.post("/api/v1/opportunities", json=sample(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def _flags(**overrides):
    body = {
        "title": "后端开发实习生",
        "company": "示例科技",
        "deadline_at": datetime(2027, 6, 1, 18, 0, tzinfo=SHANGHAI),
        "source_url": "https://cdutjy.cdut.edu.cn/info/demo/1.htm",
        "source_tier": "official",
        "summary": "示例岗位",
    }
    body.update(overrides)
    return compute_risk_flags(**body)


def _seed_fixtures():
    path = Path(__file__).resolve().parents[1] / "scripts" / "seed.py"
    spec = importlib.util.spec_from_file_location("campus_seed_risk", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.fixtures()


def test_official_and_campus_channel_are_not_no_official_source(client):
    official = _create(client)
    assert official["source_tier"] == "official"
    assert official["risk_flags"] == []
    assert "no_official_source" not in official["risk_flags"]

    campus = _create(
        client,
        title="海信集团校园招聘",
        kind="campus_recruit",
        company="海信集团",
        source_url="https://jobs.hisense.com/campus",
        deadline_at="2027-07-01T18:00:00+08:00",
    )
    assert campus["source_tier"] == "campus_channel"
    assert campus["source_name"] == "企业校招"
    assert "no_official_source" not in campus["risk_flags"]

    contest = _create(
        client,
        title="校赛通知",
        kind="competition",
        company="教务处",
        source_url="https://aao.cdut.edu.cn/info/1442/7001.htm",
        deadline_at="2027-08-01T18:00:00+08:00",
    )
    assert contest["source_tier"] == "campus_channel"
    assert "no_official_source" not in contest["risk_flags"]


def test_unverified_and_student_submit_get_no_official_source(client):
    created = _create(
        client,
        title="个人博客里的实习",
        company="示例科技",
        source_url="https://example.com/jobs/1",
    )
    assert created["source_tier"] == "unverified"
    assert created["risk_flags"] == ["no_official_source"]
    assert "aggregator_only" not in created["risk_flags"]

    flags = _flags(
        source_tier="student_submit",
        source_url="https://example.com/student/1",
    )
    assert flags == ["no_official_source"]


def test_aggregator_only_when_it_is_the_only_source(client):
    created = _create(
        client,
        title="转载校招",
        company="转载站",
        source_url="https://www.zhaopin.com/campus/index.html",
        deadline_at="2027-03-01T18:00:00+08:00",
    )
    assert created["source_tier"] == "unverified"
    assert created["risk_flags"] == ["no_official_source", "aggregator_only"]

    boss = _create(
        client,
        title="Boss 上的岗位",
        company="另一家",
        source_url="https://www.zhipin.com/job_detail/123.html",
        deadline_at="2027-03-02T18:00:00+08:00",
    )
    assert "aggregator_only" in boss["risk_flags"]

    # 已有合格源时，即使链接看起来像聚合站，也不打 aggregator_only。
    spared = _flags(
        source_tier="official",
        source_url="https://www.zhaopin.com/campus/index.html",
    )
    assert "aggregator_only" not in spared
    assert "no_official_source" not in spared


def test_pay_to_apply_requires_explicit_fee_language(client):
    salary = _create(
        client,
        title="薪酬面议的运营岗",
        summary="月薪8000，提供住房补贴，工作位置在成都，薪酬面议。",
        requirements="负责日常运营。一定金额的项目奖金按考核发放，不收取报名费，也无押金。",
        source_url="https://cdutjy.cdut.edu.cn/info/salary/1.htm",
    )
    assert salary["source_tier"] == "official"
    assert salary["risk_flags"] == []
    assert "pay_to_apply" not in salary["risk_flags"]

    charged = _create(
        client,
        title="收费实习",
        company="收费示例",
        requirements="投递需付费，报名费200元，交定金后才能报名。",
        source_url="https://cdutjy.cdut.edu.cn/info/fee/1.htm",
        deadline_at="2027-04-01T18:00:00+08:00",
    )
    assert charged["status"] == "active"
    assert charged["risk_flags"] == ["pay_to_apply"]

    detail = client.get(f"/api/v1/opportunities/{charged['id']}")
    assert detail.status_code == 200
    assert detail.json()["risk_flags"] == ["pay_to_apply"]
    assert detail.json()["status"] == "active"


def test_domain_mismatch_and_employment_office_forward(client):
    mismatch = _create(
        client,
        title="示例科技官网校招",
        company="示例科技",
        source_url="https://unrelated-third.example/apply",
        summary="官方网站为 https://jobs.example-tech.com/campus ，请从该公司页面投递。",
        deadline_at="2027-05-01T18:00:00+08:00",
    )
    assert mismatch["source_tier"] == "unverified"
    assert "domain_mismatch" in mismatch["risk_flags"]
    assert "no_official_source" in mismatch["risk_flags"]
    assert "aggregator_only" not in mismatch["risk_flags"]

    titled = _create(
        client,
        title="另一家公司官网校招",
        company="另一家公司",
        source_url="https://scam-board.example/jobs/9",
        summary="欢迎投递。详见 https://scam-board.example/jobs/9",
        deadline_at="2027-05-02T18:00:00+08:00",
    )
    assert "domain_mismatch" in titled["risk_flags"]

    aggregator = _create(
        client,
        title="智联转载",
        company="示例科技",
        source_url="https://www.zhaopin.com/job/88.html",
        summary="号称公司官网校招，实际只有聚合站链接。",
        deadline_at="2027-05-03T18:00:00+08:00",
    )
    assert "aggregator_only" in aggregator["risk_flags"]
    assert "domain_mismatch" in aggregator["risk_flags"]

    forwarded = _create(
        client,
        title="示例科技官网校招",
        company="示例科技",
        source_url="https://cdutjy.cdut.edu.cn/info/forward/1.htm",
        summary="官方网站为 https://jobs.example-tech.com/campus 。就业网转发简章。",
        deadline_at="2027-05-04T18:00:00+08:00",
    )
    assert forwarded["source_tier"] == "official"
    assert forwarded["source_name"] == "学生就业指导中心"
    assert "domain_mismatch" not in forwarded["risk_flags"]
    assert forwarded["risk_flags"] == []

    career = _create(
        client,
        title="例子集团招聘",
        company="例子集团有限公司",
        kind="campus_recruit",
        source_url="https://jobs.example-corp.com/campus",
        responsibilities="维护招聘官网。",
        deadline_at="2027-05-05T18:00:00+08:00",
    )
    assert career["source_tier"] == "campus_channel"
    assert "domain_mismatch" not in career["risk_flags"]
    assert "no_official_source" not in career["risk_flags"]


def test_deadline_conflict_is_conservative(client):
    conflict = _create(
        client,
        title="某某公司2020届校园招聘",
        company="某某公司",
        source_url="https://example.com/cohort/2020",
        deadline_at="2030-01-01T18:00:00+08:00",
    )
    assert "deadline_conflict" in conflict["risk_flags"]
    assert conflict["status"] == "active"

    near = _flags(
        title="某某公司2025届校园招聘",
        source_tier="unverified",
        source_url="https://example.com/cohort/2025",
        deadline_at=datetime(2027, 3, 1, 18, 0, tzinfo=SHANGHAI),
    )
    assert "deadline_conflict" not in near

    official_far = _flags(
        title="华润数科2025届校园招聘",
        company="华润数科",
        source_tier="official",
        source_url="https://cdutjy.cdut.edu.cn/data/mcit_editor/20240930/huarun.pdf",
        deadline_at=datetime(2030, 1, 1, 18, 0, tzinfo=SHANGHAI),
    )
    assert "deadline_conflict" not in official_far
    assert official_far == []


def test_huarun_seed_is_not_marked_for_2025_cohort():
    rows = {item["company"]: item for item in _seed_fixtures()}
    huarun = rows["华润数科"]
    assert "2025届" in huarun["title"]
    assert huarun["source_tier"] == "official"
    assert "cdutjy.cdut.edu.cn" in huarun["source_url"]
    assert huarun["risk_flags"] == []
    assert "deadline_conflict" not in huarun["risk_flags"]
    for item in rows.values():
        assert item["risk_flags"] == [], item["title"]


def test_flagged_opportunity_stays_in_the_list(client):
    created = _create(
        client,
        title="仍在列表里的收费岗",
        company="列表示例",
        requirements="报名费300元。",
        source_url="https://cdutjy.cdut.edu.cn/info/list/fee.htm",
        location="成都",
        work_location="成都",
    )
    assert created["status"] == "active"
    assert created["risk_flags"] == ["pay_to_apply"]

    listed = client.get("/api/v1/opportunities").json()
    matched = [row for row in listed if row["id"] == created["id"]]
    assert len(matched) == 1
    assert matched[0]["status"] == "active"
    assert matched[0]["risk_flags"] == ["pay_to_apply"]

    cleared = client.patch(
        f"/api/v1/opportunities/{created['id']}",
        json={"requirements": "计算机相关专业。薪酬面议，提供住房补贴，工作位置在成都。"},
    )
    assert cleared.status_code == 200, cleared.text
    body = cleared.json()
    assert body["status"] == "active"
    assert body["risk_flags"] == []
    again = client.get("/api/v1/opportunities").json()
    assert any(row["id"] == created["id"] and row["status"] == "active" for row in again)


def test_client_cannot_invent_risk_flags(client):
    payload = sample(source_url="https://cdutjy.cdut.edu.cn/info/invent/1.htm")
    payload["risk_flags"] = ["pay_to_apply", "deadline_conflict"]
    response = client.post("/api/v1/opportunities", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["risk_flags"] == []


def test_ingest_keeps_charged_copy_and_does_not_reject_it(client):
    from app.db import SessionLocal
    from app.services.collect import FetchResult
    from app.services.ingest import ingest_opportunities

    page = """
    <html><body>
    <h1>示例科技有限公司招聘简章</h1>
    <p>工作地点：成都</p>
    <p>报名截止2027年6月1日</p>
    <h2>任职要求</h2>
    <p>投递需付费，报名费200元。</p>
    </body></html>
    """
    home = """
    <html><body>
    <a href="/index/index/employjobdetail.html?data=fee">示例科技有限公司招聘简章</a>
    </body></html>
    """
    detail = "https://cdutjy.cdut.edu.cn/index/index/employjobdetail.html?data=fee"

    def fetch(url: str):
        if url in {
            "https://cdutjy.cdut.edu.cn/",
            "https://cdutjy.cdut.edu.cn/sitemap.xml",
        }:
            return FetchResult(url, 200, "text/html", home.encode(), home)
        if url == detail:
            return FetchResult(url, 200, "text/html", page.encode(), page)
        if "moocollege" in url:
            empty = '{"data":{"records":[]}}'
            return FetchResult(url, 200, "application/json", empty.encode(), empty)
        return FetchResult(url, 404, "text/html", b"", "")

    db = SessionLocal()
    try:
        report = ingest_opportunities(db, fetch=fetch)
    finally:
        db.close()

    assert report["created"] == 1
    rows = client.get("/api/v1/opportunities").json()
    matched = [row for row in rows if "报名费" in (row.get("requirements") or "")]
    assert len(matched) == 1
    assert matched[0]["status"] == "active"
    assert matched[0]["risk_flags"] == ["pay_to_apply"]
    assert matched[0]["source_tier"] == "official"
    assert "no_official_source" not in matched[0]["risk_flags"]
