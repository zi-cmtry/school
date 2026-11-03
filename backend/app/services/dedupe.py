import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")


def normalize(value: str) -> str:
    """转小写并做 NFKC，去掉空白和标点，保留字母与数字。"""
    text = unicodedata.normalize("NFKC", value).strip().lower()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[^\w]+", "", text, flags=re.UNICODE)
    return text


def deadline_date(value: datetime) -> str:
    """截止时间在亚洲/上海的日历日，格式 YYYY-MM-DD。

    不带时区的时间按上海本地时间理解。
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=SHANGHAI)
    else:
        value = value.astimezone(SHANGHAI)
    return value.strftime("%Y-%m-%d")


def make_dedupe_key(company: str, title: str, deadline_at: datetime) -> str:
    return f"{normalize(company)}|{normalize(title)}|{deadline_date(deadline_at)}"
