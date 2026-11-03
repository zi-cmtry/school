from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import yaml

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "school.yaml"

ALLOWED_TIERS = {"official", "campus_channel", "student_submit", "unverified"}


@lru_cache(maxsize=1)
def load_school() -> dict:
    with CONFIG_PATH.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("sources"), list):
        raise RuntimeError(f"学校配置无效：{CONFIG_PATH}")
    return data


def resolve_source(source_url: str, kind: str) -> tuple[str, str]:
    """按链接和类别返回 (source_name, source_tier)。

    配置过的主机只在 applies_to 包含该类别时可信，其余为 unverified。
    级别不采用客户端提交的值。
    """
    host = (urlparse(source_url).hostname or "").lower()
    for source in load_school()["sources"]:
        hosts = [item.lower() for item in source.get("hosts", [])]
        if host not in hosts:
            continue
        tier = source["tier"]
        if tier not in ALLOWED_TIERS:
            raise RuntimeError(f"学校配置中的 source_tier 无法识别：{tier}")
        if kind in source.get("applies_to", []):
            return source["name"], tier
        return host or "unknown", "unverified"
    return host or "unknown", "unverified"
