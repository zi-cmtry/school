import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


def normalize(value: str) -> str:
    """Lowercase, NFKC, drop whitespace and punctuation. Keep letters and digits."""
    text = unicodedata.normalize("NFKC", value).strip().lower()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[^\w]+", "", text, flags=re.UNICODE)
    return text


def deadline_date(value: datetime) -> str:
    """Calendar date of the deadline in Asia/Shanghai, YYYY-MM-DD.

    Naive datetimes are read as Asia/Shanghai local time.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=SHANGHAI)
    else:
        value = value.astimezone(SHANGHAI)
    return value.strftime("%Y-%m-%d")


def make_dedupe_key(company: str, title: str, deadline_at: datetime) -> str:
    return f"{normalize(company)}|{normalize(title)}|{deadline_date(deadline_at)}"
