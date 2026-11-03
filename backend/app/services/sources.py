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
        raise RuntimeError(f"invalid school config: {CONFIG_PATH}")
    return data


def resolve_source(source_url: str, kind: str) -> tuple[str, str]:
    """Return (source_name, source_tier) for a URL and opportunity kind.

    A configured host is trusted only when the kind is in that source's applies_to.
    Anything else is unverified. The tier is never taken from the client.
    """
    host = (urlparse(source_url).hostname or "").lower()
    for source in load_school()["sources"]:
        hosts = [item.lower() for item in source.get("hosts", [])]
        if host not in hosts:
            continue
        tier = source["tier"]
        if tier not in ALLOWED_TIERS:
            raise RuntimeError(f"unknown source tier in school config: {tier}")
        if kind in source.get("applies_to", []):
            return source["name"], tier
        return host or "unknown", "unverified"
    return host or "unknown", "unverified"
