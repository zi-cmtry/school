import pytest

from app.services.sources import load_school, resolve_source


@pytest.mark.parametrize(
    "url,kind",
    [
        ("https://jobs.hisense.com/campus", "campus_recruit"),
        ("https://jobs.hisense.com/", "internship"),
        ("https://www.jobs.hisense.com/home", "campus_recruit"),
        ("https://maker.haier.net/", "internship"),
        ("https://cngr.hotjob.cn/position", "campus_recruit"),
        ("https://careers.example-corp.com/jobs", "internship"),
        ("https://zhaopin.acme.com/", "campus_recruit"),
        ("https://campus.mihoyo.com/", "internship"),
        ("https://job.sinopec.com/", "campus_recruit"),
        ("https://xz.duoyi.com/FNa", "campus_recruit"),
        ("https://vistar.zhiye.com/", "campus_recruit"),
        ("https://company.example/join/campus", "internship"),
        ("https://company.example/campus-recruit", "campus_recruit"),
    ],
)
def test_enterprise_career_pages_resolve_to_campus_channel(url, kind):
    name, tier = resolve_source(url, kind)
    assert tier == "campus_channel"
    assert name == "企业校招"


def test_cdutjy_stays_official():
    name, tier = resolve_source(
        "https://cdutjy.cdut.edu.cn/data/mcit_editor/20250922/hisense.pdf",
        "campus_recruit",
    )
    assert name == "学生就业指导中心"
    assert tier == "official"


def test_cdutjy_campus_path_stays_official():
    name, tier = resolve_source(
        "https://cdutjy.cdut.edu.cn/campus/recruit.htm",
        "internship",
    )
    assert name == "学生就业指导中心"
    assert tier == "official"


@pytest.mark.parametrize(
    "url,name",
    [
        ("https://aao.cdut.edu.cn/info/1442/7000.htm", "教务处竞赛通知"),
        ("https://cim.cdut.edu.cn/info/1098/6232.htm", "计算机学院竞赛"),
        ("https://cmcc.cdut.edu.cn/info/1037/9038.htm", "材料与化学化工学院"),
        ("https://cp.moocollege.com/home/competition/details?competitionId=107706", "学科竞赛平台(moocollege)"),
        ("https://www.cp.moocollege.com/home", "学科竞赛平台(moocollege)"),
    ],
)
def test_competition_whitelist_stays_campus_channel(url, name):
    resolved_name, tier = resolve_source(url, "competition")
    assert tier == "campus_channel"
    assert resolved_name == name


def test_random_host_stays_unverified():
    name, tier = resolve_source("https://example.com/jobs/1", "internship")
    assert tier == "unverified"
    assert name == "example.com"


def test_campus_inside_a_longer_word_stays_unverified():
    for url in (
        "https://example.com/news/campuses",
        "https://example.com/blog/mycampusguide",
        "https://example.com/products/campusedition",
    ):
        _name, tier = resolve_source(url, "campus_recruit")
        assert tier == "unverified"


def test_campus_only_in_query_stays_unverified():
    name, tier = resolve_source("https://example.com/search?q=campus", "campus_recruit")
    assert tier == "unverified"
    assert name == "example.com"


@pytest.mark.parametrize(
    "url",
    [
        "https://my.yingjiesheng.com/xjh-006-285-782.html",
        "https://ezhizhaopin.com/school.php?id=2233&section=lectures",
        "https://www.zhaopin.com/campus/index.html",
        "https://xiaoyuan.zhaopin.com/job",
        "https://jobs.51job.com/campus/123.html",
        "https://campus.liepin.com/",
        "https://www.hotjob.cn/",
        "https://zhiye.com/",
    ],
)
def test_aggregators_and_platform_apex_stay_unverified(url):
    _name, tier = resolve_source(url, "campus_recruit")
    assert tier == "unverified"


def test_enterprise_host_is_unverified_for_competition():
    name, tier = resolve_source("https://jobs.hisense.com/campus", "competition")
    assert tier == "unverified"
    assert name == "jobs.hisense.com"


def test_contest_host_job_stays_unverified_even_with_campus_path():
    name, tier = resolve_source("https://aao.cdut.edu.cn/campus/recruit", "internship")
    assert tier == "unverified"
    assert name == "aao.cdut.edu.cn"


def test_blank_source_url_is_not_trusted():
    assert resolve_source("", "internship") == ("unknown", "unverified")
    assert resolve_source("   ", "campus_recruit") == ("unknown", "unverified")


def test_school_yaml_documents_enterprise_career_hosts():
    load_school.cache_clear()
    school = load_school()
    matched = [
        source
        for source in school["sources"]
        if source["tier"] == "campus_channel"
        and source["name"] == "企业校招"
        and "internship" in source["applies_to"]
        and "campus_recruit" in source["applies_to"]
        and "maker.haier.net" in source["hosts"]
        and "jobs.hisense.com" in source["hosts"]
        and "cngr.hotjob.cn" in source["hosts"]
    ]
    assert matched, "企业校招必须复用 campus_channel，并写明种子里的企业招聘主机"
    aggregators = school["aggregators"]
    assert "yingjiesheng.com" in aggregators
    assert "ezhizhaopin.com" in aggregators
    assert "zhaopin.com" in aggregators
    assert "51job.com" in aggregators
