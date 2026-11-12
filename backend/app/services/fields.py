"""岗位摘录字段。原文没有的内容用「未提供」，专业对不上用「通用」。"""

from __future__ import annotations

import re

MISSING = "未提供"
GENERIC_MAJOR = "通用"

# 四川省地级行政区。用于判断工作地，不用于猜测未写明的城市。
SICHUAN_CITIES: tuple[str, ...] = (
    "成都",
    "绵阳",
    "德阳",
    "宜宾",
    "南充",
    "泸州",
    "乐山",
    "自贡",
    "攀枝花",
    "眉山",
    "资阳",
    "遂宁",
    "内江",
    "广元",
    "广安",
    "达州",
    "巴中",
    "雅安",
    "阿坝",
    "甘孜",
    "凉山",
)

_LOCATION_LABEL = re.compile(
    r"(?:工作地点|工作地|上班地点|工作城市|招聘城市)\s*[:：为]?\s*([^\n。；;]{1,80})"
)


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    text = value.replace("\u3000", " ").replace("\xa0", " ")
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def missing_if_blank(value: str | None) -> str:
    text = clean_text(value)
    return text if text else MISSING


def sichuan_cities_in(text: str) -> list[str]:
    """返回原文里写到的四川省内城市。

    「成都理工大学」单独出现时，只有句子里没有另一座省内城市，才把本校校区记为成都。
    「成都理工大学宜宾校区」记为宜宾。
    """
    raw = text or ""
    others = [city for city in SICHUAN_CITIES if city != "成都" and city in raw]
    found: list[str] = []
    if "成都" in raw.replace("成都理工大学", ""):
        found.append("成都")
    elif "成都理工" in raw and not others and "宜宾" not in raw:
        found.append("成都")
    for city in others:
        if city not in found:
            found.append(city)
    return found


def extract_work_location(text: str) -> str:
    """只从写明工作地的句子里摘四川省内城市。没有就返回「未提供」。"""
    cities: list[str] = []
    for match in _LOCATION_LABEL.finditer(text or ""):
        for city in sichuan_cities_in(match.group(1)):
            if city not in cities:
                cities.append(city)
    if not cities:
        return MISSING
    cities.sort(key=lambda city: (city != "成都", SICHUAN_CITIES.index(city)))
    return "、".join(cities)


def venue_work_location(text: str) -> str:
    """从会场、括号地点里摘省内城市。校名里的成都不单独算工作地。"""
    cities = sichuan_cities_in(text or "")
    if not cities:
        if "四川省" in (text or ""):
            return "四川"
        return MISSING
    cities.sort(key=lambda city: (city != "成都", SICHUAN_CITIES.index(city)))
    return "、".join(cities)


def location_rank(work_location: str | None) -> int:
    """0 成都，1 其他四川，2 未提供或省外。数字越小越靠前。"""
    text = missing_if_blank(work_location)
    if text == MISSING:
        return 2
    cities = [part for part in re.split(r"[、,，/\s]+", text) if part]
    if any(part.startswith("成都") for part in cities):
        return 0
    if any(city in text for city in SICHUAN_CITIES) or text.startswith("四川"):
        return 1
    return 2


def job_in_sichuan(work_location: str | None) -> bool:
    return location_rank(work_location) < 2


def resolved_place(work_location: str | None, location: str | None = None) -> str:
    """列表用来判断工作地。work_location 写了就用它，否则回退到 location。都没有是「未提供」。"""
    primary = missing_if_blank(work_location)
    if primary != MISSING:
        return primary
    return missing_if_blank(location)


def employment_outside_sichuan(work_location: str | None, location: str | None = None) -> bool:
    """工作地已经写明，并且不在四川省。没写工作地不算省外。"""
    text = resolved_place(work_location, location)
    if text == MISSING:
        return False
    return not job_in_sichuan(text)


def excerpt_section(text: str, labels: tuple[str, ...], limit: int = 800) -> str:
    """从原文连续摘一段。找不到小标题就返回「未提供」，不改写。"""
    body = clean_text(text)
    if not body:
        return MISSING
    for label in labels:
        index = body.find(label)
        if index < 0:
            continue
        chunk = body[index + len(label) :]
        chunk = chunk.lstrip(" ：: \n")
        stop = len(chunk)
        for marker in ("岗位职责", "工作职责", "任职要求", "任职资格", "专业要求", "招聘专业", "需求专业", "报名方式", "联系方式", "薪资福利"):
            if marker == label:
                continue
            pos = chunk.find(marker)
            if pos > 0:
                stop = min(stop, pos)
        chunk = chunk[:stop].strip()
        if not chunk:
            continue
        if len(chunk) > limit:
            chunk = chunk[:limit].rstrip()
        return chunk
    return MISSING


def extract_major_tags(major_requirements: str, requirements: str) -> list[str]:
    """专业标签只来自专业要求或任职要求里的专业名称，不看职位名。"""
    source = "\n".join(
        part
        for part in (major_requirements, requirements)
        if part and part != MISSING
    )
    if not source:
        return [GENERIC_MAJOR]
    tags: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r"[^。；;\n]{0,120}专业[^。；;\n]{0,40}", source):
        sentence = match.group(0)
        if "不限专业" in sentence and "、" not in sentence.split("不限专业")[0][-8:]:
            continue
        head = re.split(r"等?相关专业|专业方向|专业要求|专业", sentence, maxsplit=1)[0]
        for part in re.split(r"[、,，/]", head):
            name = part.strip(" （）()【】[]0123456789.、:：及与")
            name = re.sub(r"^(大学本科|研究生|本科及以上学历|硕士及以上学历|本科|硕士|博士)+", "", name)
            name = name.strip(" （）()【】[]:：及与")
            if not _looks_like_major(name):
                continue
            if name not in seen:
                seen.add(name)
                tags.append(name)
    return tags or [GENERIC_MAJOR]


def _looks_like_major(name: str) -> bool:
    if not name or name in {GENERIC_MAJOR, MISSING, "不限", "相关", "等", "及以上"}:
        return False
    if len(name) < 2 or len(name) > 30:
        return False
    if any(word in name for word in ("以上", "优先", "学历", "毕业生", "岗位", "熟悉", "具备")):
        return False
    return True


def major_matches(major: str | None, major_tags: list[str] | None, major_requirements: str | None) -> bool:
    """学生专业只和原文专业标签、专业要求比对。「通用」不算对口，也不看职位名。"""
    needle = clean_text(major)
    if not needle or needle in {GENERIC_MAJOR, MISSING}:
        return False
    for tag in major_tags or []:
        text = clean_text(tag)
        if not text or text in {GENERIC_MAJOR, MISSING}:
            continue
        if needle == text or needle in text:
            return True
    requirements = missing_if_blank(major_requirements)
    if requirements == MISSING:
        return False
    return needle in requirements
