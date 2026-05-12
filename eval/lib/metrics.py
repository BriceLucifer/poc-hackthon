"""Per-flag-level precision/recall/F1, plus a coloured terminal report."""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable

LEVELS = ("green", "amber", "red", "blue")


@dataclass
class LevelScore:
    tp: int = 0
    fp: int = 0
    fn: int = 0

    @property
    def precision(self) -> float:
        d = self.tp + self.fp
        return self.tp / d if d else 0.0

    @property
    def recall(self) -> float:
        d = self.tp + self.fn
        return self.tp / d if d else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0

    @property
    def support(self) -> int:
        return self.tp + self.fn


@dataclass
class EvalScore:
    n_clauses: int = 0
    n_matched: int = 0           # clauses where we found a prediction
    n_unmatched: int = 0         # clauses in gold without any prediction
    exact_match: int = 0
    severity_off_by_one: int = 0
    per_level: dict[str, LevelScore] = field(default_factory=dict)
    confusion: dict[str, dict[str, int]] = field(default_factory=dict)
    case: str = ""
    contract_type_correct: bool | None = None
    metrics_snapshot: dict | None = None  # raw cost/latency/tokens

    @property
    def accuracy(self) -> float:
        return self.exact_match / self.n_matched if self.n_matched else 0.0

    @property
    def macro_f1(self) -> float:
        scores = [s.f1 for s in self.per_level.values() if s.support]
        return sum(scores) / len(scores) if scores else 0.0


# Severity ordering — used to compute "off by one" tolerance.
_SEVERITY_RANK = {"green": 0, "blue": 1, "amber": 2, "red": 3}


def score(pairs: Iterable[tuple[str, str]]) -> EvalScore:
    """`pairs` is an iterable of (gold_level, predicted_level)."""
    out = EvalScore()
    confusion: dict[str, dict[str, int]] = defaultdict(lambda: Counter())
    per_level = {lvl: LevelScore() for lvl in LEVELS}

    for gold, pred in pairs:
        out.n_clauses += 1
        if pred is None:
            out.n_unmatched += 1
            per_level[gold].fn += 1
            continue
        out.n_matched += 1
        confusion[gold][pred] += 1
        if pred == gold:
            out.exact_match += 1
            per_level[gold].tp += 1
        else:
            per_level[pred].fp += 1
            per_level[gold].fn += 1
            if abs(_SEVERITY_RANK.get(pred, 99) - _SEVERITY_RANK.get(gold, 99)) == 1:
                out.severity_off_by_one += 1

    out.per_level = per_level
    out.confusion = {k: dict(v) for k, v in confusion.items()}
    return out


def render_terminal(score: EvalScore) -> str:
    """Pretty terminal report. ANSI colours optional."""
    lines = []
    lines.append(f"\n  Case: {score.case}")
    if score.contract_type_correct is not None:
        ok = "✓" if score.contract_type_correct else "✗"
        lines.append(f"  Contract-type detected correctly: {ok}")
    lines.append(
        f"  Clauses: {score.n_clauses}   matched: {score.n_matched}   "
        f"unmatched: {score.n_unmatched}"
    )
    lines.append(
        f"  Accuracy (exact-match): {score.accuracy:.1%}   "
        f"Macro-F1: {score.macro_f1:.3f}   "
        f"Off-by-one severity: {score.severity_off_by_one}"
    )

    lines.append("")
    lines.append("  Per-level scores")
    lines.append(f"  {'level':<8}{'precision':>11}{'recall':>9}{'F1':>7}{'support':>10}")
    lines.append("  " + "─" * 45)
    for lvl in LEVELS:
        s = score.per_level.get(lvl, LevelScore())
        lines.append(
            f"  {lvl:<8}{s.precision:>11.2f}{s.recall:>9.2f}{s.f1:>7.2f}"
            f"{s.support:>10d}"
        )

    lines.append("")
    lines.append("  Confusion (gold → predicted)")
    header = "         " + " ".join(f"{lvl:>7}" for lvl in LEVELS) + "    none"
    lines.append("  " + header)
    for gold in LEVELS:
        row = score.confusion.get(gold, {})
        cells = " ".join(f"{row.get(p, 0):>7}" for p in LEVELS)
        none_cell = score.per_level[gold].fn - sum(
            v for k, v in row.items() if k != gold
        )
        lines.append(f"  {gold:<8}{cells}{none_cell:>8}")

    if score.metrics_snapshot:
        m = score.metrics_snapshot
        lines.append("")
        lines.append("  Resource usage")
        lines.append(
            f"    LLM calls   : {m.get('n_calls', 0)}"
        )
        lines.append(
            f"    Tokens      : {m.get('input_tokens', 0):,} in  /  "
            f"{m.get('output_tokens', 0):,} out  =  "
            f"{m.get('total_tokens', 0):,} total"
        )
        lines.append(
            f"    Latency     : {m.get('latency_ms', 0):.0f} ms total"
        )
        lines.append(
            f"    Est. cost   : ${m.get('total_cost_usd', 0):.4f}"
        )
    return "\n".join(lines)
