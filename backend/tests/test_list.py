from tests.helpers import sample


def _create(client, **overrides):
    response = client.post("/api/v1/opportunities", json=sample(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def test_default_list_is_active_jobs_only(client):
    internship = _create(client, title="实习", company="甲", source_url="https://cdutjy.cdut.edu.cn/a")
    campus = _create(
        client,
        title="校招",
        kind="campus_recruit",
        company="乙",
        source_url="https://cdutjy.cdut.edu.cn/b",
        deadline_at="2027-07-01T18:00:00+08:00",
    )
    contest = _create(
        client,
        title="竞赛",
        kind="competition",
        company="丙",
        source_url="https://aao.cdut.edu.cn/info/1.htm",
        deadline_at="2027-08-01T18:00:00+08:00",
    )
    expired = _create(
        client,
        title="过期实习",
        company="丁",
        source_url="https://cdutjy.cdut.edu.cn/c",
        status="expired",
    )
    withdrawn = _create(
        client,
        title="撤回校招",
        kind="campus_recruit",
        company="戊",
        source_url="https://cdutjy.cdut.edu.cn/d",
        deadline_at="2027-09-01T18:00:00+08:00",
        status="withdrawn",
    )

    default = client.get("/api/v1/opportunities")
    assert default.status_code == 200
    ids = [item["id"] for item in default.json()]
    assert ids == [internship["id"], campus["id"]]
    assert contest["id"] not in ids
    assert expired["id"] not in ids
    assert withdrawn["id"] not in ids
    assert {item["kind"] for item in default.json()} == {"internship", "campus_recruit"}
    assert {item["status"] for item in default.json()} == {"active"}


def test_kind_competition_lists_contests(client):
    _create(client, title="实习", company="甲", source_url="https://cdutjy.cdut.edu.cn/job")
    moo = _create(
        client,
        title="平台竞赛",
        kind="competition",
        company="主办",
        source_url="https://scgxxkjs.moocollege.com/competition",
        deadline_at="2027-05-01T18:00:00+08:00",
    )
    aao = _create(
        client,
        title="教务处竞赛",
        kind="competition",
        company="另一主办",
        source_url="https://aao.cdut.edu.cn/info/9.htm",
        deadline_at="2027-04-01T18:00:00+08:00",
    )
    _create(
        client,
        title="过期竞赛",
        kind="competition",
        company="旧主办",
        source_url="https://cim.cdut.edu.cn/info/1.htm",
        status="expired",
        deadline_at="2027-03-01T18:00:00+08:00",
    )

    response = client.get("/api/v1/opportunities?kind=competition")
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [aao["id"], moo["id"]]
    assert {item["source_tier"] for item in body} == {"campus_channel"}
    assert body[0]["source_name"] == "教务处竞赛通知"
    assert body[1]["source_name"] == "学科竞赛平台(moocollege)"


def test_invalid_list_filters_are_400(client):
    assert client.get("/api/v1/opportunities?kind=hackathon").status_code == 400
    assert client.get("/api/v1/opportunities?status=open").status_code == 400


def test_get_update_delete(client):
    created = _create(client)
    fetched = client.get(f"/api/v1/opportunities/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == created["title"]

    updated = client.patch(
        f"/api/v1/opportunities/{created['id']}",
        json={"location": "绵阳", "status": "withdrawn"},
    )
    assert updated.status_code == 200
    assert updated.json()["location"] == "绵阳"
    assert updated.json()["status"] == "withdrawn"
    assert client.get("/api/v1/opportunities").json() == []

    deleted = client.delete(f"/api/v1/opportunities/{created['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/opportunities/{created['id']}").status_code == 404
