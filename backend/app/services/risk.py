"""按已入库字段计算疑似欺骗标注。

只做提示：不改 status，不从列表隐藏，也不因此拒收采集。
不补写原文。合格源、聚合站沿用 resolve_source 和 school.yaml，不另起一套档位。
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from urllib.parse import urlparse

from app.services.dedupe import SHANGHAI
from app.services.sources import is_aggregator_url, resolve_source

# 响应里的固定顺序。没有命中的不出现。
RISK_FLAGS = (
    "no_official_source",
    "aggregator_only",
    "pay_to_apply",
    "domain_mismatch",
    "deadline_conflict",
)

_TRUSTED_TIERS = {"official", "campus_channel"}
_KINDS = ("internship", "campus_recruit", "competition")
_EMPLOYMENT_OFFICE = "cdutjy.cdut.edu.cn"

# 标题或摘要里这些说法，才表示「声称是官网 / 官方校招」。
# 职责里的「维护招聘官网」不含这些说法，不据此打域名不符。
_OFFICIAL_CLAIM = re.compile(
    r"(官网校招|官方校招|公司官网|企业官网|官方网站|官方招聘网站|官方招聘网)"
)
_HTTP_URL = re.compile(r"https?://[^\s<>()（）\[\]\"']+", re.IGNORECASE)
_LATIN = re.compile(r"[A-Za-z]{4,}")
_LATIN_STOP = {"www", "com", "http", "https", "edu", "job", "jobs", "html", "pdf", "campus"}

# 收费话术。普通薪酬、补贴、工作位置不在这里。
# 定金避开「一定金额 / 指定金额」；押金避开「质押金 / 抵押金」。
_PAY_PATTERNS = (
    re.compile(r"报名费"),
    re.compile(r"(?<![一指定额锁固特约])定金"),
    re.compile(r"(?<![质抵])押金"),
    re.compile(r"(?:投递|报名|应聘|网申).{0,12}?(?:付费|缴费|交费|交钱|付钱)"),
    re.compile(r"(?:付费|缴费|交费|收费|交钱|付钱).{0,12}?(?:报名|投递|应聘|网申)"),
)
_PAY_NEGATION = re.compile(
    r"(?:不收取|无需收取|无须收取|禁止收取|严禁收取|不要收取|不需收取|"
    r"不需要|无需|无须|不必|没有|免收|免费|免交|不交|拒收|禁止|严禁|不收|"
    r"不付|未收取|并无|并不|从不|报销|免|无)$"
)
_PAY_NEGATION_INSIDE = re.compile(r"(不需|无需|无须|不必|不用|不要|不付|免|不交)")

# 标题里的「20xx届」。只看标题，不看正文里顺带写的另一届。
_COHORT = re.compile(r"(20\d{2})\s*届")


def compute_risk_flags(
    *,
    title: str,
    company: str,
    deadline_at: datetime | None,
    source_url: str,
    source_tier: str,
    summary: str | None = None,
    location: str | None = None,
    work_location: str | None = None,
    responsibilities: str | None = None,
    requirements: str | None = None,
    major_requirements: str | None = None,
    role_tags: list[str] | None = None,
) -> list[str]:
    """返回命中的 flag，顺序固定。没有则返回空数组。"""
    text = _join(
        title,
        summary,
        location,
        work_location,
        responsibilities,
        requirements,
        major_requirements,
        " ".join(role_tags or []),
    )
    hits = {
        "no_official_source": _no_official_source(source_tier),
        "aggregator_only": _aggregator_only(source_url, source_tier),
        "pay_to_apply": _pay_to_apply(text),
        "domain_mismatch": _domain_mismatch(
            source_url,
            source_tier,
            company,
            title or "",
            summary or "",
            text,
        ),
        "deadline_conflict": _deadline_conflict(title or "", deadline_at, source_url, source_tier),
    }
    return [flag for flag in RISK_FLAGS if hits[flag]]


def assign_risk_flags(row) -> list[str]:
    """按当前字段重算并写回。调用方仍负责提交。"""
    flags = compute_risk_flags(
        title=row.title,
        company=row.company,
        deadline_at=row.deadline_at,
        source_url=row.source_url,
        source_tier=row.source_tier,
        summary=getattr(row, "summary", None),
        location=getattr(row, "location", None),
        work_location=getattr(row, "work_location", None),
        responsibilities=getattr(row, "responsibilities", None),
        requirements=getattr(row, "requirements", None),
        major_requirements=getattr(row, "major_requirements", None),
        role_tags=getattr(row, "role_tags", None) or [],
    )
    row.risk_flags = flags
    return flags


def _join(*parts: str | None) -> str:
    chunks = []
    for part in parts:
        if not part:
            continue
        text = str(part).strip()
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def _hostname(source_url: str) -> str:
    return (urlparse((source_url or "").strip()).hostname or "").lower().rstrip(".")


def _bare_host(host: str) -> str:
    host = (host or "").lower().rstrip(".")
    if host.startswith("www."):
        return host[4:]
    return host


def _is_employment_office(source_url: str) -> bool:
    return _bare_host(_hostname(source_url)) == _EMPLOYMENT_OFFICE


def _trusted_host(source_url: str) -> bool:
    """这条链接在任一类别上会被 resolve_source 判成合格源。

    就业办、校园白名单和企业校招页都算。当前 kind 对不上时也不把域名当成第三方。
    """
    if not (source_url or "").strip():
        return False
    for kind in _KINDS:
        _name, tier = resolve_source(source_url, kind)
        if tier in _TRUSTED_TIERS:
            return True
    return False


def _no_official_source(source_tier: str) -> bool:
    """student_submit / unverified 且这条记录没有合格源。

    每条机会只有一个 source_url。合格源指 source_tier 为 official 或 campus_channel。
    """
    return source_tier in {"student_submit", "unverified"}


def _aggregator_only(source_url: str, source_tier: str) -> bool:
    """唯一来源是二手聚合站时才打。已有合格源则不打。"""
    if source_tier in _TRUSTED_TIERS:
        return False
    return is_aggregator_url(source_url)


def _pay_to_apply(text: str) -> bool:
    if not text:
        return False
    normalized = unicodedata.normalize("NFKC", text)
    for pattern in _PAY_PATTERNS:
        for match in pattern.finditer(normalized):
            if _pay_negated(normalized, match.start(), match.end()):
                continue
            return True
    return False


def _pay_negated(text: str, start: int, end: int) -> bool:
    span = text[start:end]
    if _PAY_NEGATION_INSIDE.search(span):
        return True
    prefix = text[max(0, start - 16) : start]
    prefix = re.split(r"[。！？；;\n]", prefix)[-1]
    prefix = re.sub(r"[\s，,、：:]+", "", prefix)
    prefix = re.sub(r"(任何|一切|额外|相关)+$", "", prefix)
    return bool(_PAY_NEGATION.search(prefix))


def _mentioned_hosts(text: str) -> list[str]:
    hosts: list[str] = []
    for raw in _HTTP_URL.findall(text or ""):
        cleaned = raw.rstrip(".,;，。；、）)")
        host = (urlparse(cleaned).hostname or "").lower().rstrip(".")
        if host and host not in hosts:
            hosts.append(host)
    return hosts


def _same_site(left: str, right: str) -> bool:
    a, b = _bare_host(left), _bare_host(right)
    if not a or not b:
        return False
    return a == b or a.endswith("." + b) or b.endswith("." + a)


def _latin_in_host(*texts: str, host: str) -> bool:
    bare = _bare_host(host)
    if not bare:
        return False
    for text in texts:
        for token in _LATIN.findall(unicodedata.normalize("NFKC", text or "")):
            word = token.lower()
            if word in _LATIN_STOP:
                continue
            if word in bare:
                return True
    return False


def _domain_mismatch(
    source_url: str,
    source_tier: str,
    company: str,
    title: str,
    summary: str,
    text: str,
) -> bool:
    """主机和声称的官网明显对不上。

    就业办转发、校园白名单、企业校招页不打。
    正文没有「官网校招 / 官方网站」这类说法时不打。
    认不出、但正文也没指向另一个地址的企业域名，不单凭标题打标，除非标题自己写成官网校招。
    """
    if source_tier in _TRUSTED_TIERS or _trusted_host(source_url):
        return False
    blob = unicodedata.normalize("NFKC", text or "")
    if not _OFFICIAL_CLAIM.search(blob):
        return False
    host = _hostname(source_url)
    if not host:
        return False
    if _latin_in_host(company, title, host=host):
        return False
    mentioned = _mentioned_hosts(blob)
    others = [item for item in mentioned if not _same_site(host, item)]
    if others:
        return True
    # 标题写成官网校招时，重复贴出当前链接也不能消掉不符。
    if _OFFICIAL_CLAIM.search(unicodedata.normalize("NFKC", title or "")):
        return True
    # 只在正文里提到、且写明的地址就是当前站点：链接和说法一致，不打。
    if mentioned:
        return False
    # 聚合站上出现官网说法，即使用词不在标题里也打。
    return is_aggregator_url(source_url)


def _shanghai_date(value: datetime) -> date:
    if value.tzinfo is None:
        value = value.replace(tzinfo=SHANGHAI)
    return value.astimezone(SHANGHAI).date()


def _cohort_fits(year: int, day: date) -> bool:
    """届次年前两年元旦，到届次年后两年的 6 月 30 日，都还不算明显矛盾。"""
    start = date(year - 2, 1, 1)
    end = date(year + 2, 6, 30)
    return start <= day <= end


def _deadline_conflict(
    title: str,
    deadline_at: datetime | None,
    source_url: str,
    source_tier: str,
) -> bool:
    """标题届次和截止日明显对不上才打。

    就业办转发不打。华润数科标题里的「2025届」是已知口径，官方就业网转发不因此标注。
    标题里只要有一届落在窗口内，就不打。
    """
    if source_tier == "official" or _is_employment_office(source_url):
        return False
    if deadline_at is None:
        return False
    normalized = unicodedata.normalize("NFKC", title or "")
    years = [int(item) for item in _COHORT.findall(normalized)]
    if not years:
        return False
    day = _shanghai_date(deadline_at)
    return not any(_cohort_fits(year, day) for year in years)
