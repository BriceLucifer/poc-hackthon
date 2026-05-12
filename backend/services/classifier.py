"""Identify the type of contract.

Two-track approach:
  1) Fast keyword scoring — works offline, no API needed.
  2) LLM refinement — called from agent.py when an API key is configured.

Keep both. The keyword pass gives a deterministic floor and a fallback when
the LLM is unavailable.
"""
from __future__ import annotations

import re

from models import ContractType


# Each entry: (type, keywords with weights). Lowercased, word-boundary match.
_RULES: list[tuple[ContractType, dict[str, float]]] = [
    (ContractType.SRA, {
        "student research agreement": 4.5,
        "student researcher": 3.0,
        "thesis": 2.0,
        "dissertation": 2.0,
        "supervisor": 1.5,
        "phd candidate": 2.5,
        "postgraduate student": 2.5,
        "academic programme": 2.0,
        "school of graduate studies": 3.0,
    }),
    (ContractType.CTRA, {
        "clinical trial": 4.0,
        "clinical research": 3.0,
        "ctra": 4.0,
        "indemnity and compensation agreement": 3.5,
        "principal investigator": 1.0,
        "trial subjects": 2.5,
        "ethics approval": 1.5,
        "nzacre": 4.0,
    }),
    (ContractType.MTA, {
        "material transfer": 4.5,
        "original materials": 3.5,
        "biological material": 2.0,
        "research material": 1.5,
        "recipient institution": 3.0,
        "provider institution": 3.0,
        "recipient scientist": 2.5,
        "provider scientist": 2.5,
        "mta": 3.0,
    }),
    (ContractType.DTA, {
        "data transfer agreement": 4.5,
        "data transfer": 3.0,
        "data sharing": 2.0,
        "data controller": 2.0,
        "data processor": 2.0,
        "dta": 3.0,
    }),
    (ContractType.DAA, {
        "data access agreement": 4.5,
        "data access": 2.5,
        "access to data": 2.0,
        "daa": 3.0,
    }),
    (ContractType.CDA, {
        "non-disclosure agreement": 4.0,
        "confidential disclosure": 4.0,
        "confidentiality agreement": 3.0,
        "two way confidentiality": 3.5,
        "mutual confidentiality": 3.0,
        "nda": 3.5,
        "cda": 3.0,
    }),
    (ContractType.COLLABORATION, {
        "collaboration agreement": 4.5,
        "joint research": 2.5,
        "consortium": 2.0,
        "joint steering committee": 2.0,
    }),
    (ContractType.SUBCONTRACT, {
        "subcontract": 4.0,
        "prime contract": 3.0,
        "flow-down": 2.0,
        "flow down": 2.0,
        "head contract": 2.5,
    }),
    (ContractType.MSA, {
        "master services agreement": 4.5,
        "msa": 2.5,
        "statement of work": 2.5,
        "schedule of services": 2.0,
    }),
    (ContractType.CONSULTANCY, {
        "consultancy services agreement": 4.5,
        "consultancy services": 3.0,
        "consultant": 2.0,
        "consultancy fee": 2.5,
    }),
    (ContractType.PROVISION_OF_SERVICES, {
        "provision of services": 4.5,
        "services agreement": 2.5,
        "services to be provided": 1.5,
    }),
    (ContractType.COMMERCIAL_RESEARCH, {
        "sponsored research": 3.0,
        "commercial research": 4.0,
        "industry partner": 2.0,
        "milestone payment": 1.5,
        "sponsor": 0.5,
    }),
    (ContractType.PUBLIC_RESEARCH, {
        "marsden": 3.0,
        "hrc": 2.0,
        "mbie": 3.0,
        "endeavour fund": 3.0,
        "public funding": 2.5,
        "government funding": 2.0,
        "crown research": 2.5,
    }),
]


def classify_by_keywords(text: str) -> tuple[ContractType, float, str]:
    """Return (contract_type, confidence, rationale).

    Confidence is normalised 0-1 by the winning score over the next-best
    score (margin), so a clear winner reads close to 1.0 and a tie reads ~0.5.
    """
    if not text.strip():
        return ContractType.UNKNOWN, 0.0, "Empty document."

    lower = text.lower()
    scores: dict[ContractType, float] = {}
    hits: dict[ContractType, list[str]] = {}

    for ctype, kws in _RULES:
        s = 0.0
        h: list[str] = []
        for kw, weight in kws.items():
            occurrences = len(re.findall(rf"\b{re.escape(kw)}\b", lower))
            if occurrences:
                s += weight * occurrences
                h.append(f"{kw} ×{occurrences}")
        if s:
            scores[ctype] = s
            hits[ctype] = h

    if not scores:
        return (
            ContractType.UNKNOWN,
            0.0,
            "No diagnostic keywords matched any standard contract type.",
        )

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    top_type, top_score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0.0
    margin = (top_score - runner_up) / top_score
    confidence = round(min(0.5 + margin / 2, 0.95), 2)
    rationale = "Matched: " + ", ".join(hits[top_type])
    return top_type, confidence, rationale
