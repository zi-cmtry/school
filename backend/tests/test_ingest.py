import json

from app.jobs.scheduler import shutdown_scheduler, start_scheduler
from app.services.collect import collect_candidates
from app.services.fields import extract_major_tags
from app.services.ingest import ingest_opportunities


CHENGDU_PAGE = """
<html><body>
<h1>示例科技有限公司招聘简章</h1>
<p>工作地点：成都</p>
<p>报名截止2027年6月1日</p>
<h2>岗位职责</h2>
<p>负责校园活动的现场执行。</p>
<h2>任职要求</h2>
<p>计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上。</p>
</body></html>
"""

MIANYANG_PAGE = """
<html><body>
<h1>绵阳材料有限公司招聘</h1>
<p>工作地点：绵阳</p>
<p>网申截止2027年7月2日</p>
<h2>专业要求</h2>
<p>材料科学与工程相关专业。</p>
</body></html>
"""

BEIJING_PAGE = """
<html><body>
<h1>外地公司有限公司招聘</h1>
<p>工作地点：北京</p>
<p>报名截止2027年8月3日</p>
<h2>任职要求</h2>
<p>不限专业。</p>
</body></html>
"""

HOME = """
<html><body>
<a href="/index/index/employjobdetail.html?data=chengdu">成都岗位</a>
<a href="/index/index/employjobdetail.html?data=mianyang">绵阳岗位</a>
<a href="/index/index/employjobdetail.html?data=beijing">北京岗位</a>
<a href="https://www.zhipin.com/job_detail/123.html">Boss 直聘</a>
<a href="https://jobs.example-corp.com/campus">企业校招</a>
</body></html>
"""

ENTERPRISE = """
<html><body>
<h1>例子集团有限公司2027届招聘</h1>
<p>工作地点：成都</p>
<p>投递截止2027年9月9日</p>
<h2>岗位职责</h2>
<p>维护招聘官网。</p>
</body></html>
"""

MOO_LIST = {
    "code": 0,
    "data": {
        "records": [
            {
                "competitionId": 11,
                "competitionName": "四川省大学生示例大赛",
                "sponsor": "四川省教育厅",
                "organizer": "成都理工大学",
                "domainUrl": "https://cp.moocollege.com/home/competition/details?competitionId=11",
                "enrollEndTime": "2027-05-20 00:00:00",
            },
            {
                "competitionId": 12,
                "competitionName": "浙江省大学生示例大赛",
                "sponsor": "浙江省教育厅",
                "organizer": "浙江某大学",
                "domainUrl": "https://cp.moocollege.com/home/competition/details?competitionId=12",
                "enrollEndTime": "2027-05-21 00:00:00",
            },
        ]
    },
}

MOO_DETAIL = {
    "code": 0,
    "data": {
        "competitionId": 11,
        "competitionName": "四川省大学生示例大赛",
        "sponsor": "四川省教育厅",
        "cityName": "",
        "competitionDesc": "面向四川省内高校在校生。",
        "entryGuide": "参赛对象为四川省内高校全日制在读本科生、研究生。",
        "faceMajor": "",
    },
}


def _fetch(url: str):
    from app.services.collect import FetchResult

    assert "zhipin.com" not in url
    assert "bosszhipin" not in url
    pages = {
        "https://cdutjy.cdut.edu.cn/": FetchResult(url, 412, "text/html", b"", "$_ts"),
        "https://cdutjy.cdut.edu.cn/sitemap.xml": FetchResult(url, 200, "text/html", HOME.encode(), HOME),
        "https://cdutjy.cdut.edu.cn/index/index/employjobdetail.html?data=chengdu": FetchResult(
            url, 200, "text/html", CHENGDU_PAGE.encode(), CHENGDU_PAGE
        ),
        "https://cdutjy.cdut.edu.cn/index/index/employjobdetail.html?data=mianyang": FetchResult(
            url, 200, "text/html", MIANYANG_PAGE.encode(), MIANYANG_PAGE
        ),
        "https://cdutjy.cdut.edu.cn/index/index/employjobdetail.html?data=beijing": FetchResult(
            url, 200, "text/html", BEIJING_PAGE.encode(), BEIJING_PAGE
        ),
        "https://jobs.example-corp.com/campus": FetchResult(url, 200, "text/html", ENTERPRISE.encode(), ENTERPRISE),
        "https://cp.moocollege.com/prod-api/home/competition/page?pageNum=1&pageSize=20": FetchResult(
            url, 200, "application/json", json.dumps(MOO_LIST).encode(), json.dumps(MOO_LIST)
        ),
        "https://cp.moocollege.com/prod-api/home/competition/page?pageNum=2&pageSize=20": FetchResult(
            url, 200, "application/json", b'{"data":{"records":[]}}', '{"data":{"records":[]}}'
        ),
        "https://cp.moocollege.com/prod-api/home/competition/detail?competitionId=11": FetchResult(
            url, 200, "application/json", json.dumps(MOO_DETAIL).encode(), json.dumps(MOO_DETAIL)
        ),
    }
    for entry in (
        "https://aao.cdut.edu.cn/",
        "https://cim.cdut.edu.cn/",
        "https://cmcc.cdut.edu.cn/",
    ):
        pages[entry] = FetchResult(entry, 412, "text/html", b"", "$_ts")
    if url not in pages:
        return FetchResult(url, 404, "text/html", b"", "")
    return pages[url]


def test_major_tags_come_from_requirements_not_title():
    tags = extract_major_tags(
        "计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上",
        "未提供",
    )
    assert "大数据管理与应用" in tags
    assert "通用" not in tags
    assert extract_major_tags("未提供", "不限专业") == ["通用"]


def test_collect_keeps_sichuan_jobs_and_skips_aggregators():
    report = collect_candidates(_fetch)
    urls = [item.source_url for item in report.candidates if item.kind != "competition"]
    assert urls[0].endswith("data=chengdu")
    assert any(url.endswith("data=mianyang") for url in urls)
    assert not any("beijing" in url for url in urls)
    assert not any("zhipin" in url for url in urls)
    chengdu = next(item for item in report.candidates if item.source_url.endswith("data=chengdu"))
    assert chengdu.work_location == "成都"
    assert "现场执行" in chengdu.responsibilities
    assert "大数据管理与应用" in chengdu.major_tags
    assert chengdu.kind == "campus_recruit"
    contest = next(item for item in report.candidates if item.kind == "competition")
    assert contest.work_location == "未提供"
    assert "浙江省" not in contest.title


def test_ingest_is_repeatable(client):
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        first = ingest_opportunities(db, fetch=_fetch)
        second = ingest_opportunities(db, fetch=_fetch)
    finally:
        db.close()
    assert first["created"] >= 2
    assert second["created"] == 0
    assert second["updated"] == first["created"]
    rows = client.get("/api/v1/opportunities", params={"major": "大数据管理与应用"}).json()
    assert rows[0]["major_requirements"].find("大数据管理与应用") >= 0
    assert any(item["work_location"] == "绵阳" for item in rows)
    assert all("北京" not in (item["work_location"] or "") for item in rows)


def test_ingest_endpoint(client, monkeypatch):
    monkeypatch.setattr("app.routers.opportunities.ingest_opportunities", lambda db: {
        "created": 1,
        "updated": 0,
        "skipped": 0,
        "rejected": 2,
        "notes": ["跳过聚合站"],
    })
    response = client.post("/api/v1/admin/jobs/ingest")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 1
    assert body["rejected"] == 2


def test_scheduler_registers_ingest_job():
    scheduler = start_scheduler()
    try:
        assert {job.id for job in scheduler.get_jobs()} >= {"expire_opportunities", "ingest_opportunities"}
    finally:
        shutdown_scheduler()
