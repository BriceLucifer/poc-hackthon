"""Compare contract clauses against the UoA Preferred Contracting Positions.

Strategy
--------
The UoA Positions document is structured in three tiers per topic:
  1. Preferred  — fully aligned                              → GREEN
  2. Acceptable — deviates from preferred but pre-approved   → AMBER
  3. Escalation — outside acceptable; named approver needed  → RED
                  (or Blue when topic is simply not addressed)

The deterministic comparator below is intentionally conservative — it only
emits GREEN/AMBER/RED when it has a clear textual signal, and leaves the
nuanced calls to the LLM augmentation pass in `agent.py`. Topics it
recognises but can't decide on stay AMBER ("requires manager review") so
the report never silently downgrades risk.

IP-related clauses are special: the UoA Positions document explicitly does
NOT cover IP (those positions are owned by Auckland UniServices). Any IP
clause is auto-flagged AMBER with a "refer to UniServices" rationale,
regardless of wording.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from models import Clause, ContractType, FlagItem, FlagLevel


_DATA_FILE = Path(__file__).parent.parent / "data" / "uoa_positions.json"


def load_positions() -> list[dict]:
    return json.loads(_DATA_FILE.read_text(encoding="utf-8"))["positions"]


def _position_applies(position: dict, contract_type: ContractType) -> bool:
    applies = position.get("applies_to", [])
    if "any" in applies:
        return True
    return contract_type.value in applies


# ---- Topic detection ------------------------------------------------------
# We score each clause against each position's keyword bag. The clause is
# assigned to the position with the highest score above a small threshold;
# else the clause is BLUE (uncovered).

def detect_topic(clause: Clause, positions: list[dict]) -> dict | None:
    blob = (clause.title + " " + clause.text).lower()
    best: tuple[float, dict] | None = None
    for p in positions:
        score = 0.0
        for kw in p.get("keywords", []):
            kw_re = r"\b" + r"\s+".join(re.escape(w) for w in kw.split()) + r"\b"
            if re.search(kw_re, blob):
                score += 1.0 + 0.5 * len(kw.split())  # multi-word cues weigh more
        if score > 0 and (best is None or score > best[0]):
            best = (score, p)
    return best[1] if best else None


# ---- Deviation / alignment heuristics -------------------------------------
# Each position gets a small set of regex cues that suggest which tier the
# clause likely lands in. These are deliberately narrow — when no cue fires
# the clause is left AMBER for human review.

_RED_CUES: dict[str, list[str]] = {
    "POS-07": [  # Liability — red if uncapped or assumes-all
        r"\bunlimited\s+liability",
        r"\bliable\s+for\s+all\b",
        r"\bassumes?\s+all\s+liability\b",
        r"\bhold\s+(harmless|the\s+\w+\s+harmless)\b",
        r"\bin\s+full\s+against\s+all\s+liability",
    ],
    "POS-08": [  # Indemnities — red if uni indemnifies "in full"/"defend"
        r"\bshall\s+indemnify[^.]{0,80}\bin\s+full\b",
        r"\bdefend\s+and\s+indemnify\b",
        r"\bindemnify[^.]{0,120}\binfringement\b",
    ],
    "POS-10": [  # Warranties — red if implied warranties of fitness/merchantability
        r"\bfitness\s+for\s+(a\s+)?particular\s+purpose\b",
        r"\bfit\s+for\s+(a\s+)?(particular|the\s+sponsor['’]s?\s+commercial)\s+purpose\b",
        r"\bmerchantab",
        r"\bnon[- ]infringement\b",
    ],
    "POS-12": [  # Publication — red if approval/veto (vs review)
        r"\b(prior\s+)?(written\s+)?approval[^.]{0,80}\bpublication\b",
        r"\bsponsor['’]?s?\s+consent[^.]{0,40}publication\b",
        r"\bveto\s+publication\b",
        r"\bindefinite[^.]{0,40}publication\b",
    ],
    "POS-16": [  # Governing law — red if not NZ/AU/UK/EU/SG/US-state
        r"\bgoverned\s+by\s+the\s+laws?\s+of\s+(?!new\s+zealand|nz|australia|the\s+united\s+kingdom|england|scotland|wales|singapore|france|germany|netherlands|ireland|sweden|denmark|finland|norway|spain|italy|switzerland|the\s+state\s+of)",
    ],
    "POS-19": [  # Termination — red if termination at sole convenience without payment
        r"\bterminate\s+at\s+(its\s+)?(sole\s+)?convenience\s+without\s+(any\s+)?(payment|compensation|notice)",
    ],
    "POS-20": [  # Disrepute — red if no academic-freedom carve-out alongside
        r"\bdisrepute\b",
        r"\bnon[- ]disparagement\b",
    ],
}

_GREEN_CUES: dict[str, list[str]] = {
    "POS-04": [r"\bnzd\b", r"\bnew\s+zealand\s+dollars?\b"],
    "POS-07": [
        r"\blimited\s+to\s+(the\s+)?(lesser\s+of|amount\s+paid|contract\s+(value|price))",
        r"\bnzd\$?\s*500[,.]?000\b",
        r"\bexcluded?\b[^.]{0,40}\bconsequential\b",
        r"\bexcluded?\b[^.]{0,40}\bindirect\s+loss",
        r"\bwill\s+not\s+extend\s+to\b[^.]{0,80}\b(consequential|indirect)\b",
        r"\bshall\s+not\s+include\b[^.]{0,80}\b(consequential|indirect)\b",
    ],
    "POS-10": [r"\bas\s+is\b", r"\bno\s+other\s+warranties\b"],
    "POS-11": [
        r"\b(5|five)\s*(\(5\))?\s*years?\b[^.]{0,40}confidential",
        r"\bmutual\s+(non[- ]disclosure|confidentiality)\b",
    ],
    "POS-12": [
        r"\b(60|sixty)\s*(\(60\))?\s*days?\b[^.]{0,80}publish",
        r"\bright\s+to\s+publish\b",
    ],
    "POS-15": [r"\b20th\b[^.]{0,40}\bmonth\b"],
    "POS-16": [
        r"\bgoverned\s+by\s+the\s+laws?\s+of\s+new\s+zealand\b",
        r"\bnew\s+zealand\s+courts?\b",
    ],
    "POS-17": [r"\benglish\b[^.]{0,40}\bprevails?\b"],
}

_AMBER_CUES: dict[str, list[str]] = {
    "POS-12": [
        r"\b(12|twelve)\s*(\(12\))?\s*months?\b[^.]{0,80}embargo",
        r"\bstand[- ]down[^.]{0,80}publication\b",
    ],
    "POS-16": [
        r"\bgoverned\s+by\s+the\s+laws?\s+of\s+(australia|the\s+united\s+kingdom|england|scotland|wales|singapore|the\s+state\s+of)",
    ],
}


def _matches_any(text: str, patterns: list[str]) -> str | None:
    for p in patterns:
        m = re.search(p, text, flags=re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def _truncate(text: str, n: int = 220) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1] + "…"


def _short_position_summary(position: dict) -> str:
    """Compact line describing the UoA position (used in rationales)."""
    pieces = [f"Preferred: {position['preferred']}"]
    if position.get("acceptable"):
        pieces.append(f"Acceptable: {position['acceptable']}")
    if position.get("escalation_to"):
        pieces.append(f"Escalation: {position['escalation_to']}")
    return " | ".join(pieces)


def compare_clauses(
    clauses: list[Clause],
    contract_type: ContractType,
) -> list[FlagItem]:
    positions = load_positions()
    relevant = [
        p for p in positions
        if _position_applies(p, contract_type) or contract_type == ContractType.UNKNOWN
    ]
    flags: list[FlagItem] = []

    for clause in clauses:
        position = detect_topic(clause, relevant)
        if position is None:
            flags.append(FlagItem(
                level=FlagLevel.BLUE,
                clause_id=clause.id,
                clause_title=clause.title or "Untitled",
                snippet=_truncate(clause.text),
                rationale="Topic not addressed in the UoA Preferred Contracting Positions.",
                standard_ref=None,
            ))
            continue

        # IP gets the special treatment — always refer to UniServices.
        if position["id"] == "POS-IP":
            flags.append(FlagItem(
                level=FlagLevel.AMBER,
                clause_id=clause.id,
                clause_title=clause.title or position["topic"],
                snippet=_truncate(clause.text),
                rationale=(
                    "Intellectual Property — UoA Contracting Positions does not "
                    "cover IP. All IP clauses must be referred to Auckland "
                    "UniServices (Head of IP) for review."
                ),
                standard_ref=f"UoA Position #{position['id']}",
            ))
            continue

        body = clause.text
        pid = position["id"]
        red_hit = _matches_any(body, _RED_CUES.get(pid, []))
        green_hit = _matches_any(body, _GREEN_CUES.get(pid, []))
        amber_hit = _matches_any(body, _AMBER_CUES.get(pid, []))

        # Priority: red > amber > green > unclassified-amber
        if red_hit:
            level = FlagLevel.RED
            why = (
                f"Conflicts with UoA position on {position['topic']} — "
                f"detected pattern \"{red_hit}\". {_short_position_summary(position)}"
            )
        elif amber_hit:
            level = FlagLevel.AMBER
            why = (
                f"Deviates from preferred position on {position['topic']} but "
                f"likely within acceptable range — \"{amber_hit}\". "
                f"{_short_position_summary(position)}"
            )
        elif green_hit:
            level = FlagLevel.GREEN
            why = (
                f"Aligns with UoA preferred position on {position['topic']} — "
                f"matches \"{green_hit}\". Preferred: {position['preferred']}"
            )
        else:
            level = FlagLevel.AMBER
            why = (
                f"Touches the UoA-sensitive topic of {position['topic']}; exact "
                f"alignment is not obvious from the clause text. Contract Manager "
                f"should confirm against: {_short_position_summary(position)}"
            )

        flags.append(FlagItem(
            level=level,
            clause_id=clause.id,
            clause_title=clause.title or position["topic"],
            snippet=_truncate(clause.text),
            rationale=why,
            standard_ref=f"UoA Position #{position['id']}",
        ))

    return flags
