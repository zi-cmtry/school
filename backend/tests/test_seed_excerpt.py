"""种子摘录必须来自已打开的就业网 PDF，省外就业岗不进默认列表和省内视图。"""

import importlib.util
from datetime import datetime, timezone
from pathlib import Path

from app.db import SessionLocal
from app.models import Opportunity
from app.services.fields import location_rank, resolved_place


def _fixtures():
    path = Path(__file__).resolve().parents[1] / "scripts" / "seed.py"
    spec = importlib.util.spec_from_file_location("campus_seed", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.fixtures()


def _by_company():
    return {item["company"]: item for item in _fixtures()}


def test_opened_pdfs_fill_dut_and_requirements():
    rows = _by_company()
    dietuo = rows["叠拓"]
    assert dietuo["responsibilities"] != "未提供"
    assert "参与AI相关的研究和开发项目" in dietuo["responsibilities"]
    assert "参与模型的训练、评估与调优" in dietuo["responsibilities"]
    assert "计算机、AI、应用数学等相关专业的在读研究生" in dietuo["requirements"]
    assert "未提供" not in dietuo["requirements"]
    assert dietuo["major_tags"] == ["计算机", "AI", "应用数学"]

    chen = rows["成都辰显光电有限公司"]
    assert "阵列方案设计仿真" in chen["responsibilities"]
    assert "巨量转移工艺开发、良率攻关" in chen["responsibilities"]
    assert "Lighttools" in chen["requirements"]
    assert "研究或者技术开发经验着优先" in chen["requirements"]
    assert chen["work_location"] == "成都、合肥"

    huarun = rows["华润数科"]
    assert "围绕工业场景下的建模优化需要" in huarun["responsibilities"]
    assert "统招全日制重点大学博士研究生学历" in huarun["requirements"]
    assert "北京、香港、深圳、西安、南京、成都、佛山" == huarun["work_location"]
    assert "助理数据师" in huarun["responsibilities"]

    for company in ("叠拓", "成都辰显光电有限公司", "华润数科"):
        item = rows[company]
        blob = "\n".join(
            (item["responsibilities"], item["requirements"], item["major_requirements"])
        )
        assert item["responsibilities"] != "未提供"
        assert item["requirements"] != "未提供"
        for tag in item["major_tags"]:
            assert tag in blob


def test_pdfs_without_duty_sections_stay_missing():
    """简章没写岗位职责或任职要求时，不补写。"""
    rows = _by_company()
    dianjian = rows["中国电建集团成都院"]
    assert dianjian["responsibilities"] == "未提供"
    assert dianjian["requirements"] == "未提供"
    assert "供热供燃气通风及空调工程" in dianjian["major_requirements"]
    assert "安全工程" in dianjian["major_tags"]

    haixin = rows["海信集团"]
    assert haixin["responsibilities"] == "未提供"
    assert haixin["requirements"] == "未提供"
    assert "营销" in haixin["major_tags"]
    assert "成都" in haixin["work_location"]

    zhongwei = rows["中伟集团"]
    assert zhongwei["responsibilities"] == "未提供"
    assert zhongwei["requirements"] == "未提供"
    assert "化学类、材料类、冶金类" in zhongwei["major_requirements"]
    assert "地质工程" in zhongwei["major_tags"]
    assert zhongwei["work_location"] == "湖南、贵州、广西、印度尼西亚、摩洛哥等"

    sinopec = rows["中石化胜利石油工程有限公司"]
    assert sinopec["responsibilities"] == "未提供"
    assert "遵纪守法、品行端正" in sinopec["requirements"]
    assert "油气井工程" in sinopec["major_tags"]
    assert "山东东营" in sinopec["work_location"]

    boe = rows["京东方科技集团股份有限公司"]
    assert boe["kind"] == "campus_recruit"
    assert boe["source_tier"] == "campus_channel"
    assert boe["source_name"] == "企业校招"
    assert "campus.boe.com" in boe["source_url"]
    assert boe["work_location"] == "四川省·绵阳市"
    assert "成都" not in boe["work_location"]
    assert boe["responsibilities"] == (
        "确保系统稳定，优化系统功能，改善生产流程。\n"
        "1.负责工厂信息化系统日常巡检、故障处理、版本更新，保障产线系统稳定运行。\n"
        "2.维护工单、工艺、物料、工序等基础数据，保证生产数据准确。\n"
        "3.根据生产业务变更，配置、优化系统功能，改善生产流程。\n"
        "4.负责工厂信息化系统日常运维、巡检、故障处理，保障产线系统稳定运行。\n"
        "5.负责机台通讯、数据采集、生产流程管控，解决产线自动化异常问题。"
    )
    assert boe["requirements"] == (
        "1、本科应届毕业生；\n"
        "2、计算机类、软件类等相关专业；\n"
        "3、具有较强的学习能力和执行能力，具备基本编程能力，熟练使用Office等办公软件；\n"
        "4、具备良好的沟通能力、处理问题能力、再学习能力、抗压能力及团队合作意识；\n"
        "5、有较好的英语能力（英语四级及以上）。"
    )
    assert boe["major_requirements"] == "未提供"
    assert boe["major_tags"] == ["计算机类", "软件类"]
    assert boe["risk_flags"] == []


def test_seeded_catalog_hides_zhongwei_and_keeps_chengdu_jobs(client):
    items = _fixtures()
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        for item in items:
            payload = dict(item)
            payload.pop("_days", None)
            db.add(Opportunity(**payload, published_at=now, updated_at=now, fetched_at=now))
        db.commit()
    finally:
        db.close()

    default = client.get("/api/v1/opportunities").json()
    titles = [row["title"] for row in default]
    assert not any("中伟" in title for title in titles)
    assert not any("胜利石油" in title for title in titles)
    assert any(row["company"] == "叠拓" and "参与模型的训练、评估与调优" in row["responsibilities"] for row in default)
    assert any("辰显" in row["title"] and "Lighttools" in row["requirements"] for row in default)
    assert any(row["company"] == "华润数科" and row["responsibilities"] != "未提供" for row in default)
    assert any(row["company"] == "海信集团" for row in default)
    assert any(row["company"] == "中国电建集团成都院" for row in default)
    assert any(row["company"] == "昆仑数智科技有限责任公司" for row in default)

    sichuan = client.get("/api/v1/opportunities", params={"region": "sichuan"}).json()
    assert [row["id"] for row in sichuan] == [row["id"] for row in default]
    assert all("中伟" not in row["title"] for row in sichuan)

    def place(row: dict) -> int:
        return location_rank(resolved_place(row["work_location"], row.get("location")))

    # 绵阳岗不含成都：默认列表和省内视图都返回，并排在成都岗之后。
    for rows in (default, sichuan):
        boe_rows = [row for row in rows if row["company"] == "京东方科技集团股份有限公司"]
        assert len(boe_rows) == 1
        boe_row = boe_rows[0]
        assert boe_row["work_location"] == "四川省·绵阳市"
        assert "负责机台通讯、数据采集、生产流程管控" in boe_row["responsibilities"]
        assert place(boe_row) == 1
        index = next(i for i, row in enumerate(rows) if row["id"] == boe_row["id"])
        assert index > 0
        assert all(place(row) < place(boe_row) for row in rows[:index])
        assert all(place(row) >= place(boe_row) for row in rows[index:])

    contests = client.get(
        "/api/v1/opportunities",
        params={"kind": "competition", "region": "sichuan"},
    ).json()
    assert len(contests) == 3
    assert all(row["kind"] == "competition" for row in contests)
