from tests.helpers import sample


def _create(client, **overrides):
    response = client.post("/api/v1/opportunities", json=sample(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def test_missing_excerpt_fields_are_explicit(client):
    created = _create(client)
    assert created["work_location"] == "未提供"
    assert created["responsibilities"] == "未提供"
    assert created["requirements"] == "未提供"
    assert created["major_requirements"] == "未提供"
    assert created["major_tags"] == ["通用"]

    detail = client.get(f"/api/v1/opportunities/{created['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["responsibilities"] == "未提供"
    assert body["major_tags"] == ["通用"]


def test_blank_excerpt_is_stored_as_missing(client):
    created = _create(
        client,
        work_location="  ",
        responsibilities="",
        requirements="",
        major_requirements="",
        major_tags=[],
    )
    assert created["work_location"] == "未提供"
    assert created["responsibilities"] == "未提供"
    assert created["major_tags"] == ["通用"]


def test_chengdu_jobs_rank_before_other_sichuan_without_hiding(client):
    mianyang = _create(
        client,
        title="绵阳工艺岗",
        company="绵阳单位",
        source_url="https://cdutjy.cdut.edu.cn/mianyang",
        deadline_at="2027-03-01T18:00:00+08:00",
        work_location="绵阳",
    )
    chengdu_later = _create(
        client,
        title="成都设计岗",
        company="成都单位",
        source_url="https://cdutjy.cdut.edu.cn/chengdu",
        deadline_at="2027-08-01T18:00:00+08:00",
        work_location="成都",
    )
    yibin = _create(
        client,
        title="宜宾工程岗",
        kind="campus_recruit",
        company="宜宾单位",
        source_url="https://cdutjy.cdut.edu.cn/yibin",
        deadline_at="2027-04-01T18:00:00+08:00",
        work_location="宜宾",
    )

    rows = client.get("/api/v1/opportunities").json()
    assert [item["id"] for item in rows] == [chengdu_later["id"], mianyang["id"], yibin["id"]]
    assert {item["work_location"] for item in rows} == {"成都", "绵阳", "宜宾"}


def test_major_ranks_related_first_and_keeps_the_rest(client):
    """大数据管理与应用只认专业要求里的原句。通用、职位名都不算对口。"""
    unrelated_chengdu = _create(
        client,
        title="土木工程岗",
        kind="campus_recruit",
        company="成都院",
        source_url="https://cdutjy.cdut.edu.cn/civil",
        deadline_at="2027-05-01T18:00:00+08:00",
        work_location="成都",
        major_requirements="土木工程、水利水电工程",
        major_tags=["土木工程", "水利水电工程"],
    )
    related_mianyang = _create(
        client,
        title="产品工程师",
        kind="campus_recruit",
        company="数智公司",
        source_url="https://cdutjy.cdut.edu.cn/data",
        deadline_at="2027-09-01T18:00:00+08:00",
        work_location="绵阳",
        requirements="计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上",
        major_requirements="计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上",
        major_tags=["计算机", "电子信息", "数学", "大数据管理与应用"],
    )
    generic_title = _create(
        client,
        title="大数据分析师",
        kind="campus_recruit",
        company="另一家",
        source_url="https://cdutjy.cdut.edu.cn/generic",
        deadline_at="2027-06-01T18:00:00+08:00",
        work_location="成都",
        major_tags=["通用"],
        major_requirements="未提供",
    )
    other_sichuan = _create(
        client,
        title="材料岗",
        kind="campus_recruit",
        company="宜宾材料",
        source_url="https://cdutjy.cdut.edu.cn/material",
        deadline_at="2027-04-01T18:00:00+08:00",
        work_location="宜宾",
        major_requirements="材料科学与工程",
        major_tags=["材料科学与工程"],
    )

    rows = client.get("/api/v1/opportunities", params={"major": "大数据管理与应用", "kind": "campus_recruit"}).json()
    ids = [item["id"] for item in rows]
    assert ids[0] == related_mianyang["id"]
    assert set(ids) == {
        related_mianyang["id"],
        unrelated_chengdu["id"],
        generic_title["id"],
        other_sichuan["id"],
    }
    # 不对口的仍在，成都排在其他省内城市前面。职位名里的「大数据」没有被当成相关。
    assert ids[1:] == [unrelated_chengdu["id"], generic_title["id"], other_sichuan["id"]]
    assert rows[1]["major_tags"] == ["土木工程", "水利水电工程"]
    assert "大数据管理与应用" not in rows[1]["major_tags"]
    assert rows[2]["major_tags"] == ["通用"]


def test_competition_without_work_location_stays_listed(client):
    plain = _create(
        client,
        title="省赛甲",
        kind="competition",
        company="四川省教育厅",
        source_url="https://cp.moocollege.com/home/competition/details?competitionId=1",
        deadline_at="2027-05-01T18:00:00+08:00",
        work_location="未提供",
        major_tags=["通用"],
    )
    related = _create(
        client,
        title="省赛乙",
        kind="competition",
        company="成都理工大学",
        source_url="https://aao.cdut.edu.cn/info/2.htm",
        deadline_at="2027-08-01T18:00:00+08:00",
        major_requirements="大数据管理与应用",
        major_tags=["大数据管理与应用"],
    )
    rows = client.get(
        "/api/v1/opportunities",
        params={"kind": "competition", "major": "大数据管理与应用"},
    ).json()
    assert [item["id"] for item in rows] == [related["id"], plain["id"]]
    assert rows[1]["work_location"] == "未提供"
