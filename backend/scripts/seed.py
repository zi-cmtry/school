"""写入一组可重复执行的校园通知。

截止时间相对运行时刻计算：一条校招已经过期，用于演示过期任务，其余在未来。
标题和链接来自已发布通知。岗位按全校专业混排，覆盖光电、土木水利、材料、
石油工程、计算机，以及数据分析、营销和运营，不按单一学院过滤。
再次运行会按 source_url 替换这些记录。
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

from sqlalchemy import delete  # noqa: E402

from app.db import Base, SessionLocal, engine, ensure_opportunity_columns  # noqa: E402
from app.models import Opportunity  # noqa: E402
from app.services.dedupe import SHANGHAI, make_dedupe_key  # noqa: E402
from app.services.sources import resolve_source  # noqa: E402
from seed_excerpts import (  # noqa: E402
    CHENXIAN_MAJOR_REQUIREMENTS,
    CHENXIAN_MAJOR_TAGS,
    CHENXIAN_REQUIREMENTS,
    CHENXIAN_RESPONSIBILITIES,
    DIANJIAN_MAJOR_REQUIREMENTS,
    DIANJIAN_MAJOR_TAGS,
    DIETUO_MAJOR_REQUIREMENTS,
    DIETUO_MAJOR_TAGS,
    DIETUO_REQUIREMENTS,
    DIETUO_RESPONSIBILITIES,
    HAIXIN_MAJOR_REQUIREMENTS,
    HAIXIN_MAJOR_TAGS,
    HUARUN_MAJOR_REQUIREMENTS,
    HUARUN_MAJOR_TAGS,
    HUARUN_REQUIREMENTS,
    HUARUN_RESPONSIBILITIES,
    SINOPEC_MAJOR_REQUIREMENTS,
    SINOPEC_MAJOR_TAGS,
    SINOPEC_REQUIREMENTS,
    ZHONGWEI_MAJOR_REQUIREMENTS,
    ZHONGWEI_MAJOR_TAGS,
)

REQUIRED_URLS = (
    "https://aao.cdut.edu.cn/info/1442/7000.htm",
    "https://cim.cdut.edu.cn/info/1098/6232.htm",
)
MOOCOLLEGE_DETAIL_URL = (
    "https://cp.moocollege.com/home/competition/details?competitionId=107706"
)


def at_days(days: int) -> datetime:
    now = datetime.now(SHANGHAI)
    return (now + timedelta(days=days)).replace(hour=18, minute=0, second=0, microsecond=0)


def record(
    *,
    title: str,
    kind: str,
    company: str,
    days: int,
    source_url: str,
    role_tags: list[str],
    location: str,
    apply_url: str | None,
    summary: str,
    expected_tier: str,
    work_location: str | None = None,
    responsibilities: str = "未提供",
    requirements: str = "未提供",
    major_requirements: str = "未提供",
    major_tags: list[str] | None = None,
) -> dict:
    source_name, source_tier = resolve_source(source_url, kind)
    if source_tier != expected_tier:
        raise SystemExit(
            f"{source_url}（{kind}）的 source_tier 为 {source_tier}，期望 {expected_tier}"
        )
    deadline_at = at_days(days)
    return {
        "title": title,
        "kind": kind,
        "company": company,
        "deadline_at": deadline_at,
        "source_url": source_url,
        "source_name": source_name,
        "source_tier": source_tier,
        "status": "active",
        "dedupe_key": make_dedupe_key(company, title, deadline_at),
        "role_tags": role_tags,
        "location": location,
        "apply_url": apply_url,
        "summary": summary,
        "work_location": work_location or location or "未提供",
        "responsibilities": responsibilities,
        "requirements": requirements,
        "major_requirements": major_requirements,
        "major_tags": major_tags or ["通用"],
        "_days": days,
    }


def fixtures() -> list[dict]:
    return [
        record(
            title="叠拓 AI 实习生",
            kind="internship",
            company="叠拓",
            days=40,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20240902/"
                "%E5%8F%A0%E6%8B%932025%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["AI", "软件开发", "实习"],
            location="成都、南京",
            apply_url="https://www.wjx.top/vm/Ot5dQ4H.aspx",
            summary="叠拓（Tietoevry）校园招聘简章中的 AI 实习生，面向计算机、AI、应用数学在读研究生。",
            expected_tier="official",
            work_location="成都、南京",
            responsibilities=DIETUO_RESPONSIBILITIES,
            requirements=DIETUO_REQUIREMENTS,
            major_requirements=DIETUO_MAJOR_REQUIREMENTS,
            major_tags=DIETUO_MAJOR_TAGS,
        ),
        record(
            title="成都辰显光电有限公司2027届应届毕业生招聘简章",
            kind="campus_recruit",
            company="成都辰显光电有限公司",
            days=45,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20260909/"
                "%E6%88%90%E9%83%BD%E8%BE%B0%E6%98%BE%E5%85%89%E7%94%B5%E6%9C%89%E9%99%90"
                "%E5%85%AC%E5%8F%B8%E2%80%942027%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98"
                "%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["光电", "微电子", "材料"],
            location="成都、合肥",
            apply_url="https://vistar.zhiye.com/",
            summary=(
                "成都辰显光电 2027 届应届毕业生招聘，面向 Micro-LED 显示。"
                "岗位含电路、结构、光学设计，巨量转移与阵列工艺，以及财务、计划物料和采购。"
                "工作地以成都为主，背板代工工程师一岗在合肥。网申入口 vistar.zhiye.com。"
            ),
            expected_tier="official",
            work_location="成都、合肥",
            responsibilities=CHENXIAN_RESPONSIBILITIES,
            requirements=CHENXIAN_REQUIREMENTS,
            major_requirements=CHENXIAN_MAJOR_REQUIREMENTS,
            major_tags=CHENXIAN_MAJOR_TAGS,
        ),
        record(
            title="中国电建集团成都院2027届校园招聘公告",
            kind="campus_recruit",
            company="中国电建集团成都院",
            days=55,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20260929/"
                "%E4%B8%AD%E5%9B%BD%E7%94%B5%E5%BB%BA%E6%88%90%E9%83%BD%E9%99%A2"
                "2027%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E5%85%AC%E5%91%8A.pdf"
            ),
            role_tags=["土木工程", "水利水电", "地质工程"],
            location="成都",
            apply_url="http://www.hotjob.cn/wt/chidi/web/index?brandCode=1",
            summary=(
                "中国电建集团成都院 2027 届校园招聘，专业含土木工程、水利水电工程、"
                "地质工程、岩土工程等，学历为硕士及以上。单位注册在成都。"
            ),
            expected_tier="official",
            work_location="成都",
            # 公告有申请条件和招聘专业，没有岗位职责、任职要求，这两项保持未提供。
            major_requirements=DIANJIAN_MAJOR_REQUIREMENTS,
            major_tags=DIANJIAN_MAJOR_TAGS,
        ),
        record(
            title="海信集团全国营销中心2026届校园招聘",
            kind="campus_recruit",
            company="海信集团",
            days=60,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20250922/"
                "%E6%B5%B7%E4%BF%A1%E9%9B%86%E5%9B%A2%E5%85%A8%E5%9B%BD%E8%90%A5%E9%94%80"
                "%E4%B8%AD%E5%BF%832026%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["营销", "校招"],
            location="山东青岛、沈阳、长春、北京、天津、石家庄、太原、西安、兰州、郑州、漯河、青岛、济南、临沂、南京、上海、杭州、宁波、无锡、武汉、长沙、南昌、合肥、广州、深圳、南宁、福州、成都、重庆、昆明、贵阳等",
            apply_url="https://jobs.hisense.com",
            summary="海信集团全国营销中心 2026 届校园招聘，营销中心名单含成都。简章未写岗位职责和任职要求。",
            expected_tier="official",
            work_location="山东青岛、沈阳、长春、北京、天津、石家庄、太原、西安、兰州、郑州、漯河、青岛、济南、临沂、南京、上海、杭州、宁波、无锡、武汉、长沙、南昌、合肥、广州、深圳、南宁、福州、成都、重庆、昆明、贵阳等",
            major_requirements=HAIXIN_MAJOR_REQUIREMENTS,
            major_tags=HAIXIN_MAJOR_TAGS,
        ),
        record(
            title="中伟集团2026届校园招聘",
            kind="campus_recruit",
            company="中伟集团",
            days=75,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20250924/"
                "2026%E5%B1%8A%E6%A0%A1%E6%8B%9B%E7%AE%80%E7%AB%A0-250815.pdf"
            ),
            role_tags=["材料", "研发", "校招"],
            location="湖南、贵州、广西、印度尼西亚、摩洛哥等",
            apply_url="https://cngr.hotjob.cn",
            summary=(
                "中伟集团 2026 届校园招聘，覆盖科创研发、矿业资源、信息技术等方向。"
                "简章写明工作地点为湖南、贵州、广西、印度尼西亚、摩洛哥等，不在四川。"
            ),
            expected_tier="official",
            work_location="湖南、贵州、广西、印度尼西亚、摩洛哥等",
            # 简章是岗位和需求专业对照表，没有岗位职责、任职要求。
            major_requirements=ZHONGWEI_MAJOR_REQUIREMENTS,
            major_tags=ZHONGWEI_MAJOR_TAGS,
        ),
        record(
            title="华润数科2025届校园招聘",
            kind="campus_recruit",
            company="华润数科",
            days=50,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20240930/"
                "0-%E5%8D%8E%E6%B6%A6%E6%95%B0%E7%A7%91%E6%8E%A7%E8%82%A1%E6%9C%89%E9%99%90"
                "%E5%85%AC%E5%8F%B82025%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80"
                "%E7%AB%A0%E3%80%90%E5%90%AB%E5%B2%97%E4%BD%8D%E4%BB%8B%E7%BB%8D%E3%80%91.pdf"
            ),
            role_tags=["数据分析", "咨询", "运营"],
            location="北京、香港、深圳、西安、南京、成都、佛山",
            apply_url="https://www.crdigital.com.cn/",
            summary=(
                "华润数科 2025 届校园招聘。部门层含助理数据师、助理咨询经理、"
                "助理运营经理、助理产品经理，并写明以上岗位同步招聘 2026 届实习生。"
                "工作地点：北京、香港、深圳、西安、南京、成都、佛山。"
            ),
            expected_tier="official",
            work_location="北京、香港、深圳、西安、南京、成都、佛山",
            responsibilities=HUARUN_RESPONSIBILITIES,
            requirements=HUARUN_REQUIREMENTS,
            major_requirements=HUARUN_MAJOR_REQUIREMENTS,
            major_tags=HUARUN_MAJOR_TAGS,
        ),
        record(
            title="中石化胜利石油工程有限公司2027年度校园招聘简章",
            kind="campus_recruit",
            company="中石化胜利石油工程有限公司",
            days=-14,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20260930/"
                "%E4%B8%AD%E7%9F%B3%E5%8C%96%E8%83%9C%E5%88%A9%E7%9F%B3%E6%B2%B9%E5%B7%A5"
                "%E7%A8%8B%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B82027%E5%B9%B4%E5%BA%A6"
                "%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["石油工程", "地质", "校招"],
            location="以山东东营为主、新疆工区",
            apply_url="http://job.sinopec.com",
            summary=(
                "中石化胜利石油工程 2027 年度校园招聘，含石油工程、地质及综合商务管理等岗位，"
                "工作地以山东东营为主，现场技术岗另有新疆工区。不在四川。"
                "截止时间设在过去，供过期任务演示；调用 expire 后应变为 expired。"
            ),
            expected_tier="official",
            work_location="以山东东营为主、新疆工区",
            # 简章没有岗位职责。应聘条件、外语水平、其他要求和专业要求按原文写入。
            requirements=SINOPEC_REQUIREMENTS,
            major_requirements=SINOPEC_MAJOR_REQUIREMENTS,
            major_tags=SINOPEC_MAJOR_TAGS,
        ),
        record(
            title="昆仑数智科技有限责任公司校园招聘简章",
            kind="campus_recruit",
            company="昆仑数智科技有限责任公司",
            days=70,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20240918/"
                "%E6%98%86%E4%BB%91%E6%95%B0%E6%99%BA%E7%A7%91%E6%8A%80%E6%9C%89%E9%99%90"
                "%E8%B4%A3%E4%BB%BB%E5%85%AC%E5%8F%B8%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98"
                "%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["初级产品经理", "软件开发工程师", "油气业务咨询顾问"],
            location="成都",
            apply_url=None,
            summary=(
                "昆仑数智科技有限责任公司成立于2020年11月，是中国石油贯彻落实习近平总书记加快建设网络强国、"
                "数字中国和高水平科技自立自强重要指示批示精神，推进产业数字化和数智产业化协同发展，"
                "整合内部资源，以市场化方式组建的数智科技公司。"
            ),
            expected_tier="official",
            work_location="成都",
            responsibilities="协助高级产品经理完成方案设计及需求分析",
            requirements="计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上",
            major_requirements=(
                "计算机、电子信息、数学、大数据管理与应用等相关专业方向硕士研究生及以上\n"
                "石油工程、地质工程、油气储运工程等相关专业方向本科及以上"
            ),
            major_tags=[
                "计算机",
                "电子信息",
                "数学",
                "大数据管理与应用",
                "石油工程",
                "地质工程",
                "油气储运工程",
            ],
        ),
        record(
            title="关于2026年中国大学生计算机设计大赛成都理工大学校级赛的通知",
            kind="competition",
            company="中国大学生计算机设计大赛",
            days=45,
            source_url="https://aao.cdut.edu.cn/info/1442/7000.htm",
            role_tags=["计算机", "校赛"],
            location="成都",
            apply_url="http://jsjds.blcu.edu.cn/",
            summary="教务处通知：2026 年中国大学生计算机设计大赛成都理工大学校级赛，由计算机与网络安全学院承办。",
            expected_tier="campus_channel",
        ),
        record(
            title="关于举办2026年四川省大学生大数据采集与分析大赛企业大数据智能决策赛道校赛的通知",
            kind="competition",
            company="四川省大学生大数据采集与分析大赛",
            days=80,
            source_url="https://cim.cdut.edu.cn/info/1098/6232.htm",
            role_tags=["大数据", "校赛"],
            location="成都",
            apply_url="https://cp.moocollege.com/home/competition/details?competitionId=106777",
            summary="管理科学学院通知：2026 年四川省大学生大数据采集与分析大赛企业大数据智能决策赛道校赛。",
            expected_tier="campus_channel",
        ),
        record(
            title="第三届四川省大学生智能医学创新设计大赛",
            kind="competition",
            company="四川省教育厅",
            days=25,
            source_url=MOOCOLLEGE_DETAIL_URL,
            role_tags=["医学", "省赛"],
            location="四川",
            apply_url=MOOCOLLEGE_DETAIL_URL,
            summary=(
                "四川省高校学科竞赛平台上的省赛详情，"
                "主办单位为川北医学院、西南医科大学。"
            ),
            expected_tier="campus_channel",
        ),
    ]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_opportunity_columns()
    items = fixtures()
    jobs = [item for item in items if item["kind"] in {"internship", "campus_recruit"}]
    contests = [item for item in items if item["kind"] == "competition"]
    urls = [item["source_url"] for item in items]
    if len(jobs) < 5 or len(contests) < 2:
        raise SystemExit("种子至少需要 5 条岗位和 2 条竞赛")
    for required in REQUIRED_URLS:
        if required not in urls:
            raise SystemExit(f"缺少必须的竞赛链接：{required}")
    if MOOCOLLEGE_DETAIL_URL not in urls:
        raise SystemExit("种子需要 moocollege 竞赛详情页链接")

    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        removed = db.execute(delete(Opportunity).where(Opportunity.source_url.in_(urls)))
        for item in items:
            item.pop("_days")
            db.add(
                Opportunity(
                    **item,
                    published_at=now,
                    updated_at=now,
                    fetched_at=now,
                )
            )
        db.commit()
    finally:
        db.close()

    print(f"已写入 {len(items)} 条机会（替换 {removed.rowcount or 0} 条）")
    for item in items:
        deadline = item["deadline_at"].astimezone(SHANGHAI).strftime("%Y-%m-%d %H:%M %z")
        print(
            f"- [{item['kind']}] {item['source_tier']} {item['source_name']} | "
            f"{item['company']} | {item['title']} | {deadline}"
        )
        print(f"  {item['source_url']}")


if __name__ == "__main__":
    main()
