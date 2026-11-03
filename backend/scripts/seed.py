"""写入一组可重复执行的校园通知。

截止时间相对运行时刻计算：一条校招已经过期，用于演示过期任务，其余在未来。
标题和链接来自已发布通知。再次运行会按 source_url 替换这些记录。
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import delete  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Opportunity  # noqa: E402
from app.services.dedupe import SHANGHAI, make_dedupe_key  # noqa: E402
from app.services.sources import resolve_source  # noqa: E402

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
            location="成都",
            apply_url="https://www.wjx.top/vm/Ot5dQ4H.aspx",
            summary="叠拓（Tietoevry）成都招聘简章中的 AI 实习生，面向计算机、AI、应用数学在读研究生。",
            expected_tier="official",
        ),
        record(
            title="海尔智家2026届校园招聘",
            kind="campus_recruit",
            company="海尔智家",
            days=50,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20251015/"
                "2026%E6%B5%B7%E5%B0%94%E6%99%BA%E5%AE%B6%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98"
                "%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["研发", "营销", "校招"],
            location="青岛",
            apply_url="https://maker.haier.net/smart_home",
            summary="海尔智家 2026 届全球校园招聘，研发、智造、营销等方向，网申入口 maker.haier.net。",
            expected_tier="official",
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
            location="成都",
            apply_url="https://jobs.hisense.com",
            summary="海信集团全国营销中心 2026 届校园招聘，工作地含成都等营销中心。",
            expected_tier="official",
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
            location="长沙",
            apply_url="https://cngr.hotjob.cn",
            summary="中伟集团 2026 届校园招聘，覆盖科创研发、矿业资源、信息技术等方向。",
            expected_tier="official",
        ),
        record(
            title="学大教育2026届校园招聘",
            kind="campus_recruit",
            company="学大教育",
            days=-14,
            source_url=(
                "https://cdutjy.cdut.edu.cn/data/mcit_editor/20260318/"
                "%E2%80%9C%E9%80%90%E6%A2%A6%E5%AD%A6%E6%B5%B7%20%C2%B7%E5%A4%A7%E6%9C%89"
                "%E5%8F%AF%E4%B8%BA%E2%80%9D%E5%AD%A6%E5%A4%A7%E6%95%99%E8%82%B2"
                "2026%E5%B1%8A%E6%A0%A1%E5%9B%AD%E6%8B%9B%E8%81%98%E7%AE%80%E7%AB%A0.pdf"
            ),
            role_tags=["教师", "校招"],
            location="成都",
            apply_url="https://www.xueda.com",
            summary="学大教育西南区教师校招。截止时间设在过去，供过期任务演示；调用 expire 后应变为 expired。",
            expected_tier="official",
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
            expected_tier="unverified",
        ),
    ]


def main() -> None:
    Base.metadata.create_all(bind=engine)
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
