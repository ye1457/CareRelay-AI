from __future__ import annotations

import re
from collections.abc import Iterable


_PREFIX_RE = re.compile(r"^(?:记住|保存|建议保存|长期记住|长期记忆|可保存为长期记忆)[：:\s]*")
_SPACE_RE = re.compile(r"\s+")

_SHORT_TERM_RE = re.compile(
    r"(今天|今日|今晚|明天|明早|明晚|后天|本周|这周|这次|本次|刚刚|现在|马上|尽快|稍后|待会儿|待会|"
    r"下一次|下次|早上|上午|中午|下午|晚上|"
    r"\d{1,2}\s*(?:点|:|：)\s*\d{0,2}|"
    r"\d{4}[-/年]\d{1,2}|"
    r"\d{1,2}[月/]\d{1,2}|"
    r"周[一二三四五六日天])"
)
_BOUNDED_PERIOD_RE = re.compile(
    r"((?:未来|接下来|连续)\s*\d+\s*(?:天|周|月)|"
    r"(?:未来|接下来|连续)[一二三四五六七八九十]+(?:天|周|月))"
)
_ONE_OFF_RE = re.compile(r"(待确认|还没|未确认|确认是否|有没有|发到家人群|转发|今天已|已完成|已做|临时|一次)")
_META_RE = re.compile(r"(交接模板|固定格式|接龙模板|补原文|原始记录|凭猜测|信息质量|对象\+时间|统一格式)")
_INCOMPLETE_RE = re.compile(r"(前|后|时|需要|确认|准备|观察|记录)$")

_DURABLE_RE = re.compile(
    r"(每次|每当|每天|每日|每晚|每早|每周|每月|固定|长期|通常|一般|经常|习惯|规律|偏好|"
    r"喜欢|不喜欢|过敏|忌口|禁忌|避免|不能|不要|少盐|少油|少糖|"
    r"睡前|饭前|饭后|起床后|复诊前|复查前|复诊后|复查后|外出前|喂药后|洗澡后|入睡前|"
    r"安抚方式|奶量范围|食物偏好|排泄规律|医保卡|病历本|航空箱|处方单)"
)
_HARD_RECURRING_RE = re.compile(
    r"(每次|每当|每天|每日|每晚|每早|每周|每月|固定|长期|通常|一般|经常|习惯|规律|偏好)"
)


def normalize_memory_text(text: str) -> str:
    value = _SPACE_RE.sub(" ", str(text or "")).strip(" \t\r\n。；;，,")
    while True:
        cleaned = _PREFIX_RE.sub("", value).strip(" \t\r\n。；;，,")
        if cleaned == value:
            return cleaned
        value = cleaned


def has_short_term_marker(text: str) -> bool:
    value = normalize_memory_text(text)
    return bool(_SHORT_TERM_RE.search(value) or _BOUNDED_PERIOD_RE.search(value) or _ONE_OFF_RE.search(value))


def has_durable_marker(text: str) -> bool:
    return bool(_DURABLE_RE.search(normalize_memory_text(text)))


def is_short_term_todo_text(text: str) -> bool:
    value = normalize_memory_text(text)
    if not value:
        return False
    if _BOUNDED_PERIOD_RE.search(value) and not _HARD_RECURRING_RE.search(value):
        return True
    return has_short_term_marker(value) and not _HARD_RECURRING_RE.search(value)


def is_reusable_memory_text(text: str) -> bool:
    value = normalize_memory_text(text)
    if len(value) < 4:
        return False
    if _META_RE.search(value) or _INCOMPLETE_RE.search(value):
        return False
    if is_short_term_todo_text(value):
        return False
    return has_durable_marker(value)


def filter_reusable_memory_suggestions(items: Iterable[str]) -> list[str]:
    suggestions: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = normalize_memory_text(str(item or ""))
        if not value or not is_reusable_memory_text(value):
            continue
        key = value.casefold()
        if key in seen:
            continue
        suggestions.append(value)
        seen.add(key)
    return suggestions[:6]
