"""Aggregate flags into the final review report."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from models import ContractReview, ContractType, FlagItem, FlagLevel


def build_report(
    document_id: str,
    filename: str,
    contract_type: ContractType,
    confidence: float,
    flags: list[FlagItem],
    summary: str | None = None,
) -> ContractReview:
    counts = Counter(f.level.value for f in flags)
    counts_dict = {level.value: counts.get(level.value, 0) for level in FlagLevel}

    if summary is None:
        summary = _auto_summary(contract_type, counts_dict)

    return ContractReview(
        document_id=document_id,
        filename=filename,
        contract_type=contract_type,
        contract_type_confidence=confidence,
        summary=summary,
        flags=_sort_flags(flags),
        counts=counts_dict,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


_LEVEL_ORDER = {
    FlagLevel.RED: 0,
    FlagLevel.AMBER: 1,
    FlagLevel.BLUE: 2,
    FlagLevel.GREEN: 3,
}


def _sort_flags(flags: list[FlagItem]) -> list[FlagItem]:
    return sorted(
        flags,
        key=lambda f: (_LEVEL_ORDER[f.level], _natural_key(f.clause_id)),
    )


def _natural_key(s: str) -> tuple:
    parts = []
    cur = ""
    for ch in s:
        if ch.isdigit():
            cur += ch
        else:
            if cur:
                parts.append(int(cur))
                cur = ""
            parts.append(ch.lower())
    if cur:
        parts.append(int(cur))
    return tuple(parts)


def _auto_summary(contract_type: ContractType, counts: dict[str, int]) -> str:
    red = counts.get("red", 0)
    amber = counts.get("amber", 0)
    blue = counts.get("blue", 0)
    green = counts.get("green", 0)

    headline_parts = []
    if red:
        headline_parts.append(f"{red} red flag{'s' if red != 1 else ''}")
    if amber:
        headline_parts.append(f"{amber} amber flag{'s' if amber != 1 else ''}")
    if blue:
        headline_parts.append(f"{blue} blue flag{'s' if blue != 1 else ''}")
    if green:
        headline_parts.append(f"{green} aligned clause{'s' if green != 1 else ''}")

    headline = ", ".join(headline_parts) if headline_parts else "no clauses reviewed"
    risk = (
        "Renegotiation likely required before signature."
        if red
        else "Manager review recommended."
        if amber
        else "Broadly aligned with UoA standard positions."
    )
    return (
        f"{contract_type.value}: {headline}. {risk} "
        f"This is a proof-of-concept analysis — final decisions remain with "
        f"the Research Contracts team."
    )
