"""按链接和类别决定 source_name / source_tier。不采用客户端提交的级别。"""

from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "school.yaml"

ALLOWED_TIERS = {"official", "campus_channel", "student_submit", "unverified"}
_PATTERN_KEYS = ("host_labels", "path_markers", "host_suffixes")
_SKIPPED_SUBDOMAIN_LABELS = {"www", "m"}


@lru_cache(maxsize=1)
def load_school() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("sources"), list):
        raise RuntimeError(f"学校配置无效：{CONFIG_PATH}")
    return data


def resolve_source(source_url: str, kind: str) -> tuple[str, str]:
    """按链接和类别返回 (source_name, source_tier)。

    配置里的精确主机只在 applies_to 包含该类别时可信，其余为 unverified。
    企业自己的校招/招聘页（主机形态，或路径段为 campus / campus-recruit）对实习和校招复用
    campus_channel，来源名称用配置里的「企业校招」。更长的单词如 campuses 不算。
    二手聚合站即使长得像校招页，也保持 unverified。空链接同样不是可信来源。
    """
    parsed = urlparse((source_url or "").strip())
    host = (parsed.hostname or "").lower().rstrip(".")
    path = parsed.path or ""
    school = load_school()

    for source in school["sources"]:
        if not _host_listed(host, source.get("hosts") or []):
            continue
        return _from_rule(source, host, kind)

    if _is_aggregator(host, school.get("aggregators") or []):
        return host or "unknown", "unverified"

    for source in school["sources"]:
        if not _has_career_pattern(source):
            continue
        if _career_pattern_matches(host, path, source):
            return _from_rule(source, host, kind)

    return host or "unknown", "unverified"


def _from_rule(source: dict, host: str, kind: str) -> tuple[str, str]:
    tier = source["tier"]
    if tier not in ALLOWED_TIERS:
        raise RuntimeError(f"学校配置中的 source_tier 无法识别：{tier}")
    if kind in (source.get("applies_to") or []):
        return source["name"], tier
    return host or "unknown", "unverified"


def _without_www(host: str) -> str:
    if host.startswith("www."):
        return host[4:]
    return host


def _host_listed(host: str, hosts: list) -> bool:
    if not host:
        return False
    allowed = {str(item).lower().rstrip(".") for item in hosts}
    return host in allowed or _without_www(host) in allowed


def _is_aggregator(host: str, domains: list) -> bool:
    bare = _without_www(host)
    if not bare:
        return False
    for domain in domains:
        domain = str(domain).lower().strip().lstrip(".")
        if not domain:
            continue
        if bare == domain or bare.endswith("." + domain):
            return True
    return False


def _has_career_pattern(source: dict) -> bool:
    return any(source.get(key) for key in _PATTERN_KEYS)


def _career_pattern_matches(host: str, path: str, source: dict) -> bool:
    bare = _without_www(host)
    labels = [part for part in bare.split(".") if part]
    first = labels[0] if labels else ""
    wanted = {str(item).lower() for item in source.get("host_labels") or [] if str(item).strip()}
    if first and first in wanted:
        return True
    for suffix in source.get("host_suffixes") or []:
        if _company_subdomain(bare, str(suffix)):
            return True
    for marker in source.get("path_markers") or []:
        token = str(marker).lower().strip()
        if token and _path_has_marker(path, token):
            return True
    return False


def _path_has_marker(path: str, marker: str) -> bool:
    """路径段本身是 campus，或是 campus-recruit 这种带分隔符的段。

    不再把任意子串当成校招页，避免 campuses、mycampus 一类路径被误收。
    """
    for segment in path.lower().split("/"):
        if not segment:
            continue
        stem = segment.split(".", 1)[0]
        if stem == marker or stem.startswith(marker + "-") or stem.startswith(marker + "_"):
            return True
    return False


def _company_subdomain(host: str, suffix: str) -> bool:
    suffix = suffix.lower().strip()
    if not suffix:
        return False
    if not suffix.startswith("."):
        suffix = "." + suffix
    if not host.endswith(suffix):
        return False
    left = host[: -len(suffix)]
    if not left or left.endswith("."):
        return False
    first = left.split(".", 1)[0]
    return first not in _SKIPPED_SUBDOMAIN_LABELS
