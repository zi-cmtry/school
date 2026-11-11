"""从白名单页面摘录实习、就业岗和竞赛。

只保留原文里写明的句子。没有的字段记为「未提供」，不补写岗位，也不访问聚合站。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx

from app.services.dedupe import SHANGHAI
from app.services.fields import (
    GENERIC_MAJOR,
    MISSING,
    clean_text,
    excerpt_section,
    extract_major_tags,
    extract_work_location,
    job_in_sichuan,
    missing_if_blank,
    venue_work_location,
)
from app.services.sources import load_school, resolve_source

JOB_ENTRY_URLS = (
    "https://cdutjy.cdut.edu.cn/",
    "https://cdutjy.cdut.edu.cn/sitemap.xml",
)
COMPETITION_ENTRY_URLS = (
    "https://aao.cdut.edu.cn/",
    "https://cim.cdut.edu.cn/",
    "https://cmcc.cdut.edu.cn/",
)
MOO_LIST_URL = "https://cp.moocollege.com/prod-api/home/competition/page"
MOO_DETAIL_URL = "https://cp.moocollege.com/prod-api/home/competition/detail"
MOO_DETAIL_PAGE = "https://cp.moocollege.com/home/competition/details?competitionId={competition_id}"

MAX_MOO_PAGES = 2
MAX_DETAIL_FETCHES = 24
MAX_ENTERPRISE_HOPS = 8
USER_AGENT = "CDUTCampusInfoBot/1.0 (Chengdu University of Technology campus info; educational)"

_DATE_IN_TEXT = re.compile(r"(20\d{2})\s*[-年/.](\d{1,2})\s*[-月/.](\d{1,2})\s*日?")
_DEADLINE_HINT = re.compile(r"(截止|报名|网申|投递|结束)")


@dataclass
class FetchResult:
    url: str
    status: int
    content_type: str
    body: bytes
    text: str = ""


@dataclass
class Candidate:
    title: str
    kind: str
    company: str
    source_url: str
    deadline_at: datetime | None
    work_location: str = MISSING
    responsibilities: str = MISSING
    requirements: str = MISSING
    major_requirements: str = MISSING
    major_tags: list[str] = field(default_factory=lambda: [GENERIC_MAJOR])
    role_tags: list[str] = field(default_factory=list)
    apply_url: str | None = None
    summary: str | None = None
    reject_reason: str | None = None


@dataclass
class CollectReport:
    candidates: list[Candidate]
    rejected: int = 0
    notes: list[str] = field(default_factory=list)


def _note(report: CollectReport, text: str) -> None:
    if text not in report.notes:
        report.notes.append(text)


def fetch_url(url: str, timeout: float = 20.0) -> FetchResult:
    """拉取一个公开地址。聚合站在调用前就被丢掉，这里不再跟随到那些主机。"""
    with httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        response = client.get(url)
    content_type = response.headers.get("content-type", "")
    body = response.content or b""
    text = ""
    if "pdf" not in content_type.lower() and not url.lower().split("?", 1)[0].endswith(".pdf"):
        text = body.decode(response.encoding or "utf-8", errors="replace")
    final = str(response.url)
    return FetchResult(url=final, status=response.status_code, content_type=content_type, body=body, text=text)


def collect_candidates(fetch=fetch_url) -> CollectReport:
    """先看成都工作地，再看省内其他城市，最后收本校竞赛。"""
    report = CollectReport(candidates=[])
    seen_urls: set[str] = set()
    job_candidates: list[Candidate] = []
    contest_candidates: list[Candidate] = []
    enterprise_urls: list[str] = []

    for entry in JOB_ENTRY_URLS:
        if _blocked(entry):
            report.rejected += 1
            report.notes.append(f"跳过聚合站 { _host(entry) }")
            continue
        try:
            page = fetch(entry)
        except Exception as exc:  # noqa: BLE001  采集失败只记原因，不中断其余来源
            report.notes.append(f"就业网入口暂时打不开：{exc.__class__.__name__}")
            continue
        if not _usable_html(page):
            _note(report, "就业网入口没有返回可摘录的正文")
            continue
        links = _links(page.text, page.url)
        details = [item for item in links if _is_job_detail(item[0])]
        enterprise_urls.extend(url for url, _title in links if _is_enterprise_career(url))
        fetched = 0
        for url, title in details:
            if fetched >= MAX_DETAIL_FETCHES or url in seen_urls or _blocked(url):
                if _blocked(url):
                    report.rejected += 1
                    report.notes.append(f"跳过聚合站 {_host(url)}")
                continue
            seen_urls.add(url)
            fetched += 1
            candidate = _candidate_from_link(fetch, url, title, report)
            if candidate is None:
                continue
            if candidate.reject_reason:
                report.rejected += 1
                continue
            job_candidates.append(candidate)
        if job_candidates or fetched:
            break

    hops = 0
    for url in enterprise_urls:
        if hops >= MAX_ENTERPRISE_HOPS or url in seen_urls or _blocked(url):
            if _blocked(url):
                report.rejected += 1
            continue
        seen_urls.add(url)
        hops += 1
        candidate = _candidate_from_link(fetch, url, "", report, kind_hint=None)
        if candidate is None:
            continue
        if candidate.reject_reason:
            report.rejected += 1
            continue
        name, tier = resolve_source(candidate.source_url, candidate.kind)
        if tier != "campus_channel" or name != "企业校招":
            report.rejected += 1
            continue
        job_candidates.append(candidate)

    for entry in COMPETITION_ENTRY_URLS:
        if _blocked(entry):
            report.rejected += 1
            continue
        try:
            page = fetch(entry)
        except Exception as exc:  # noqa: BLE001
            report.notes.append(f"竞赛页暂时打不开：{exc.__class__.__name__}")
            continue
        if not _usable_html(page):
            _note(report, f"{_host(entry)} 没有返回可摘录的竞赛正文")
            continue
        for url, title in _links(page.text, page.url):
            if url in seen_urls or _blocked(url):
                continue
            if not _is_competition_url(url):
                continue
            seen_urls.add(url)
            candidate = _candidate_from_link(fetch, url, title, report, kind_hint="competition")
            if candidate is None:
                continue
            if candidate.reject_reason:
                report.rejected += 1
                continue
            contest_candidates.append(candidate)

    contest_candidates.extend(_collect_moocollege(fetch, report, seen_urls))

    job_candidates.sort(key=lambda item: (0 if item.work_location.startswith("成都") else 1, item.source_url))
    report.candidates = job_candidates + contest_candidates
    if not report.notes:
        report.notes.append("采集完成")
    return report


def _candidate_from_link(fetch, url: str, title: str, report: CollectReport, kind_hint: str | None = None) -> Candidate | None:
    try:
        page = fetch(url)
    except Exception as exc:  # noqa: BLE001
        _note(report, f"页面打不开，已跳过：{exc.__class__.__name__}")
        report.rejected += 1
        return None
    if _blocked(page.url):
        report.notes.append(f"跳过聚合站 {_host(page.url)}")
        report.rejected += 1
        return None
    text = _document_text(page)
    if page.status >= 400 or not text or _is_challenge(page.text or text):
        _note(report, "页面没有可摘录正文，未补写字段")
        report.rejected += 1
        return None
    if kind_hint == "competition" or _is_competition_url(page.url):
        return _competition_from_text(title or _guess_title(text), text, page.url)
    return _job_from_text(title or _guess_title(text), text, page.url)


def _collect_moocollege(fetch, report: CollectReport, seen_urls: set[str]) -> list[Candidate]:
    found: list[Candidate] = []
    for page_num in range(1, MAX_MOO_PAGES + 1):
        url = f"{MOO_LIST_URL}?pageNum={page_num}&pageSize=20"
        try:
            page = fetch(url)
        except Exception as exc:  # noqa: BLE001
            report.notes.append(f"竞赛平台列表暂时打不开：{exc.__class__.__name__}")
            break
        payload = _json_body(page)
        records = (((payload or {}).get("data") or {}).get("records")) if isinstance(payload, dict) else None
        if not records:
            break
        for record in records:
            if not isinstance(record, dict):
                continue
            if not _moo_in_scope(record):
                report.rejected += 1
                continue
            competition_id = record.get("competitionId")
            source_url = _moo_source_url(record)
            if not source_url or source_url in seen_urls:
                continue
            seen_urls.add(source_url)
            detail_text = ""
            detail_url = f"{MOO_DETAIL_URL}?competitionId={competition_id}"
            try:
                detail_page = fetch(detail_url)
                detail = _json_body(detail_page)
                data = (detail or {}).get("data") if isinstance(detail, dict) else None
                if isinstance(data, dict):
                    detail_text = _html_to_text(
                        "\n".join(
                            str(data.get(key) or "")
                            for key in ("competitionDesc", "competitionInfo", "entryGuide", "faceMajor")
                        )
                    )
                    if data.get("cityName"):
                        detail_text += f"\n举办城市：{data.get('cityName')}"
                    record = {**record, **data}
            except Exception:  # noqa: BLE001  列表里已有的字段仍可用，缺的保持未提供
                report.notes.append("竞赛详情暂缺，只保留列表里写明的字段")
            candidate = _competition_from_moo(record, source_url, detail_text)
            if candidate.reject_reason:
                report.rejected += 1
                continue
            found.append(candidate)
    return found


def _job_from_text(title: str, text: str, source_url: str) -> Candidate:
    title = clean_text(_strip_date_prefix(title) or _guess_title(text))
    company = _company_from(title, text)
    responsibilities = excerpt_section(text, ("岗位职责", "工作职责", "工作内容"))
    requirements = excerpt_section(text, ("任职要求", "任职资格", "岗位要求"))
    major_requirements = excerpt_section(text, ("专业要求", "招聘专业", "需求专业"))
    if major_requirements == MISSING and "专业" in requirements:
        major_requirements = requirements
    if "专业" not in major_requirements:
        major_requirements = MISSING
    work_location = extract_work_location(text)
    if work_location == MISSING:
        brackets = " ".join(re.findall(r"【([^】]+)】", f"{title}\n{text}"))
        work_location = venue_work_location(brackets) if brackets else MISSING
    kind = "internship" if "实习" in title else "campus_recruit"
    candidate = Candidate(
        title=title,
        kind=kind,
        company=company,
        source_url=source_url,
        deadline_at=_deadline_from(text),
        work_location=work_location,
        responsibilities=responsibilities,
        requirements=requirements,
        major_requirements=major_requirements,
        major_tags=extract_major_tags(major_requirements, requirements),
        apply_url=_apply_url(text, source_url),
        summary=_summary_excerpt(text),
    )
    candidate.reject_reason = _reject_job(candidate)
    return candidate


def _competition_from_text(title: str, text: str, source_url: str) -> Candidate:
    blob = f"{title}\n{text}"
    if not _school_contest_blob(blob) and not _is_competition_url(source_url):
        return Candidate(
            title=title or "未提供",
            kind="competition",
            company=MISSING,
            source_url=source_url,
            deadline_at=None,
            reject_reason="不是本校白名单上的竞赛",
        )
    if not _school_contest_blob(blob) and "moocollege.com" not in _host(source_url):
        return Candidate(
            title=title or MISSING,
            kind="competition",
            company=MISSING,
            source_url=source_url,
            deadline_at=None,
            reject_reason="竞赛不在本校白名单范围内",
        )
    requirements = excerpt_section(text, ("参赛对象", "参赛要求", "报名要求"))
    return _finish_contest(
        title=clean_text(title) or _guess_title(text),
        company=_contest_company(text),
        source_url=source_url,
        text=text,
        requirements=requirements,
        work_location=venue_work_location(text) if sichuan_cities_in_safe(text) else MISSING,
    )


def sichuan_cities_in_safe(text: str) -> bool:
    from app.services.fields import sichuan_cities_in

    return bool(sichuan_cities_in(text))


def _competition_from_moo(record: dict, source_url: str, detail_text: str) -> Candidate:
    title = clean_text(str(record.get("competitionName") or ""))
    sponsor = clean_text(str(record.get("sponsor") or ""))
    organizer = clean_text(str(record.get("organizer") or ""))
    company = sponsor or organizer or MISSING
    text = "\n".join(part for part in (title, sponsor, organizer, detail_text) if part)
    if not _moo_in_scope(record) and "成都理工大学" not in text and "四川省" not in text:
        return Candidate(
            title=title or MISSING,
            kind="competition",
            company=company,
            source_url=source_url,
            deadline_at=None,
            reject_reason="不收录外校比赛",
        )
    city = clean_text(str(record.get("cityName") or ""))
    work_location = venue_work_location(city) if city else MISSING
    deadline = _parse_clock(record.get("enrollEndTime")) or _parse_clock(record.get("endTime")) or _deadline_from(text)
    face = clean_text(str(record.get("faceMajor") or ""))
    major_requirements = face if face else excerpt_section(detail_text, ("专业",))
    if major_requirements != MISSING and "专业" not in major_requirements and face == "":
        major_requirements = MISSING
    requirements = excerpt_section(detail_text, ("参赛对象", "参赛要求", "报名要求"))
    candidate = Candidate(
        title=title,
        kind="competition",
        company=company,
        source_url=source_url,
        deadline_at=deadline,
        work_location=work_location,
        responsibilities=MISSING,
        requirements=requirements,
        major_requirements=major_requirements if "专业" in (major_requirements or "") else MISSING,
        major_tags=extract_major_tags(
            major_requirements if "专业" in (major_requirements or "") else MISSING,
            requirements,
        ),
        summary=_summary_excerpt(detail_text) if detail_text else None,
    )
    if not candidate.title or not candidate.deadline_at:
        candidate.reject_reason = "竞赛原文缺少标题或截止时间"
    elif _host(candidate.source_url) not in {"cp.moocollege.com", "scgxxkjs.moocollege.com", "www.cp.moocollege.com"}:
        candidate.reject_reason = "竞赛详情页不在白名单主机上"
    return candidate


def _finish_contest(*, title: str, company: str, source_url: str, text: str, requirements: str, work_location: str) -> Candidate:
    major_requirements = excerpt_section(text, ("专业要求", "面向专业"))
    candidate = Candidate(
        title=title,
        kind="competition",
        company=company or MISSING,
        source_url=source_url,
        deadline_at=_deadline_from(text),
        work_location=work_location,
        responsibilities=MISSING,
        requirements=requirements,
        major_requirements=major_requirements,
        major_tags=extract_major_tags(major_requirements, requirements),
        summary=_summary_excerpt(text),
    )
    if not candidate.title or candidate.company == MISSING or candidate.deadline_at is None:
        candidate.reject_reason = "竞赛原文缺少标题、主办方或截止时间"
    name, tier = resolve_source(source_url, "competition")
    if tier != "campus_channel":
        candidate.reject_reason = f"竞赛来源不是白名单（{name}）"
    return candidate


def _reject_job(candidate: Candidate) -> str | None:
    if not candidate.source_url or not candidate.title or not candidate.company:
        return "缺少标题、单位或可点回来源"
    if _blocked(candidate.source_url):
        return "聚合站不作为来源"
    if candidate.deadline_at is None:
        return "原文没有截止时间"
    if not job_in_sichuan(candidate.work_location):
        return "工作地不在四川省或原文未写工作地"
    name, tier = resolve_source(candidate.source_url, candidate.kind)
    if tier not in {"official", "campus_channel"}:
        return f"来源不在白名单（{name}）"
    if tier == "campus_channel" and name != "企业校招":
        return "学院竞赛站点上的岗位不收入就业栏"
    return None


def _moo_in_scope(record: dict) -> bool:
    blob = "".join(
        str(record.get(key) or "")
        for key in ("competitionName", "sponsor", "organizer", "competitionDesc", "entryGuide")
    )
    if "成都理工大学" in blob or "四川省" in blob:
        return True
    return False


def _moo_source_url(record: dict) -> str:
    raw = str(record.get("domainUrl") or "").strip()
    host = _host(raw)
    if host in {"cp.moocollege.com", "www.cp.moocollege.com", "scgxxkjs.moocollege.com"}:
        return raw
    competition_id = record.get("competitionId")
    if not competition_id:
        return ""
    return MOO_DETAIL_PAGE.format(competition_id=competition_id)


def _school_contest_blob(text: str) -> bool:
    return "成都理工大学" in text or "四川省" in text


def _document_text(page: FetchResult) -> str:
    content_type = (page.content_type or "").lower()
    url = page.url.lower().split("?", 1)[0]
    if "pdf" in content_type or url.endswith(".pdf"):
        return _pdf_text(page.body)
    if "json" in content_type or (page.text or "").lstrip().startswith("{"):
        return page.text
    return _html_to_text(page.text)


def _pdf_text(body: bytes) -> str:
    if not body:
        return ""
    try:
        from pypdf import PdfReader
        import io
    except Exception:  # noqa: BLE001
        return ""
    try:
        reader = PdfReader(io.BytesIO(body))
    except Exception:  # noqa: BLE001
        return ""
    parts = []
    for pdf_page in reader.pages:
        extracted = pdf_page.extract_text() or ""
        if extracted:
            parts.append(extracted)
    return clean_text("\n".join(parts))


def _json_body(page: FetchResult) -> dict | None:
    raw = page.text or ""
    if not raw and page.body:
        raw = page.body.decode("utf-8", errors="replace")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _usable_html(page: FetchResult) -> bool:
    if page.status >= 400:
        return False
    text = page.text or ""
    if _is_challenge(text):
        return False
    return bool(clean_text(_html_to_text(text)))


def _is_challenge(text: str) -> bool:
    if "$_ts" not in text:
        return False
    visible = _html_to_text(text)
    return "招聘" not in visible and "notice_box" not in text and len(visible) < 80


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._chunks: list[str] = []
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self._href = href
            self._chunks = []

    def handle_data(self, data):
        if data:
            self.parts.append(data)
        if self._href is not None and data:
            self._chunks.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            text = clean_text("".join(self._chunks))
            self.links.append((self._href, text))
            self._href = None
            self._chunks = []


def _html_to_text(html: str) -> str:
    parser = _LinkParser()
    try:
        parser.feed(html or "")
    except Exception:  # noqa: BLE001
        return clean_text(re.sub(r"<[^>]+>", " ", html or ""))
    return clean_text("\n".join(parser.parts))


def _links(html: str, base: str) -> list[tuple[str, str]]:
    parser = _LinkParser()
    try:
        parser.feed(html or "")
    except Exception:  # noqa: BLE001
        return []
    items: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, text in parser.links:
        absolute = urljoin(base, href.strip())
        if absolute in seen:
            continue
        if urlparse(absolute).scheme not in {"http", "https"}:
            continue
        seen.add(absolute)
        items.append((absolute, text))
    return items


def _is_job_detail(url: str) -> bool:
    path = urlparse(url).path.lower()
    host = _host(url)
    if host.endswith("cdutjy.cdut.edu.cn") and any(
        token in path for token in ("employjobdetail", "employdetail", "newsdetail")
    ):
        return True
    return path.endswith(".pdf") and host.endswith("cdutjy.cdut.edu.cn")


def _is_competition_url(url: str) -> bool:
    host = _host(url)
    if host in {"aao.cdut.edu.cn", "cim.cdut.edu.cn", "cmcc.cdut.edu.cn"}:
        return "/info/" in urlparse(url).path
    return host in {"cp.moocollege.com", "scgxxkjs.moocollege.com", "www.cp.moocollege.com"}


def _is_enterprise_career(url: str) -> bool:
    if _blocked(url) or _host(url).endswith("cdut.edu.cn"):
        return False
    _name, tier = resolve_source(url, "campus_recruit")
    return tier == "campus_channel" and _name == "企业校招"


def _blocked(url: str) -> bool:
    host = _host(url)
    if not host:
        return True
    bare = host[4:] if host.startswith("www.") else host
    aggregators = load_school().get("aggregators") or []
    for domain in aggregators:
        domain = str(domain).lower().strip().lstrip(".")
        if bare == domain or bare.endswith("." + domain):
            return True
    return False


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def _guess_title(text: str) -> str:
    for line in clean_text(text).splitlines():
        line = line.strip()
        if len(line) >= 4:
            return line[:120]
    return ""


def _strip_date_prefix(title: str) -> str:
    return re.sub(r"^\d{1,2}月\s*\d{1,2}日\s*", "", title or "").strip()


def _company_from(title: str, text: str) -> str:
    bracket = re.search(r"【([^】]{2,40})】", title)
    if bracket:
        name = bracket.group(1).strip()
        if "宣讲" not in name and "厅" not in name and "广场" not in name:
            return name
    for pattern in (r"([\u4e00-\u9fffA-Za-z0-9（）()]{2,40}(?:有限公司|集团|大学))",):
        match = re.search(pattern, title) or re.search(pattern, text[:400])
        if match:
            return match.group(1).strip()
    return ""


def _contest_company(text: str) -> str:
    for label in ("主办单位", "主办方", "承办单位"):
        match = re.search(label + r"\s*[:：]\s*([^\n]{2,40})", text)
        if match:
            return match.group(1).strip()
    return ""


def _deadline_from(text: str) -> datetime | None:
    """只采用写明截止、报名或投递的日期。没有就不编一个。"""
    for match in _DATE_IN_TEXT.finditer(text or ""):
        window = (text or "")[max(0, match.start() - 16) : match.end() + 12]
        if not _DEADLINE_HINT.search(window):
            continue
        moment = _date_parts(match.group(1), match.group(2), match.group(3))
        if moment is not None:
            return moment
    return None


def _parse_clock(value) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed.replace(tzinfo=SHANGHAI)
    return None


def _date_parts(year: str, month: str, day: str) -> datetime | None:
    try:
        return datetime(int(year), int(month), int(day), 23, 59, tzinfo=SHANGHAI)
    except ValueError:
        return None


def _apply_url(text: str, source_url: str) -> str | None:
    for match in re.finditer(r"https?://[^\s)）<>\"']+", text or ""):
        url = match.group(0).rstrip(".,;；。")
        if _blocked(url) or url.split("#", 1)[0] == source_url.split("#", 1)[0]:
            continue
        return url
    return None


def _summary_excerpt(text: str) -> str | None:
    body = clean_text(text)
    if not body:
        return None
    line = ""
    for part in body.splitlines():
        part = part.strip()
        if len(part) >= 12:
            line = part
            break
    if not line:
        return None
    return line[:280]
