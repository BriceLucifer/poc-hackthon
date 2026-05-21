"""Run the review pipeline against gold-labelled cases and report metrics.

Usage:
    uv run python eval/run_eval.py                   # run all cases
    uv run python eval/run_eval.py --case mta_example_1
    uv run python eval/run_eval.py --save            # write report to eval/reports/
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Make backend importable
ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from agent import ingest, review                 # noqa: E402
from lib.metrics import score, render_terminal    # noqa: E402


def _data_source(filename: str) -> Path:
    for path in (ROOT / "data" / "sample" / filename, ROOT / "data" / filename):
        if path.exists():
            return path
    return ROOT / "data" / "sample" / filename


# Map gold case file → source contract file (under poc/data/)
CASES = {
    "mta_example_1": {
        "source": _data_source("MTA Example 1.pdf"),
        "gold":   ROOT / "eval" / "golden" / "mta_example_1.json",
    },
}


def _align(gold_label: dict, predicted_flags: list) -> dict | None:
    """Find the predicted flag whose snippet contains the gold's clause_match."""
    needle = gold_label["clause_match"].lower().replace("\n", " ")
    needle = " ".join(needle.split())
    for f in predicted_flags:
        hay = f"{f.clause_title} {f.snippet}".lower().replace("\n", " ")
        hay = " ".join(hay.split())
        if needle in hay:
            return {"level": f.level.value, "flag": f}
    return None


async def evaluate_case(name: str, *, save: bool) -> dict:
    cfg = CASES[name]
    raw = cfg["source"].read_bytes()
    gold = json.loads(cfg["gold"].read_text(encoding="utf-8"))

    started = time.perf_counter()
    doc = await ingest(cfg["source"].name, raw)
    rep = await review(doc)
    wall_ms = (time.perf_counter() - started) * 1000

    # Align each gold label to a predicted flag.
    pairs = []
    rows = []
    for entry in gold["labels"]:
        match = _align(entry, rep.flags)
        gold_lvl = entry["expected_level"]
        pred_lvl = match["level"] if match else None
        pairs.append((gold_lvl, pred_lvl))
        rows.append({
            "gold_level": gold_lvl,
            "pred_level": pred_lvl,
            "topic_id": entry["topic_id"],
            "clause_match": entry["clause_match"][:80],
            "ok": pred_lvl == gold_lvl,
        })

    sc = score(pairs)
    sc.case = gold["case"]
    sc.contract_type_correct = (
        rep.contract_type.value == gold["expected_contract_type"]
    )
    sc.metrics_snapshot = {
        **rep.metrics.model_dump(),
        "wall_ms": round(wall_ms, 1),
    }

    print(render_terminal(sc))
    print()

    # Show mis-aligned rows for quick eyeballing
    mismatches = [r for r in rows if not r["ok"]]
    if mismatches:
        print(f"  Mismatches ({len(mismatches)}):")
        for r in mismatches:
            arrow = f"{r['gold_level']:>5} → {r['pred_level'] or 'NONE':<5}"
            print(f"    {arrow}  [{r['topic_id'] or '—':<7}]  {r['clause_match']}")
        print()

    out = {
        "case": gold["case"],
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "contract_type_predicted": rep.contract_type.value,
        "contract_type_expected": gold["expected_contract_type"],
        "contract_type_correct": sc.contract_type_correct,
        "n_clauses": sc.n_clauses,
        "n_matched": sc.n_matched,
        "n_unmatched": sc.n_unmatched,
        "exact_match_accuracy": round(sc.accuracy, 4),
        "macro_f1": round(sc.macro_f1, 4),
        "severity_off_by_one": sc.severity_off_by_one,
        "per_level": {
            lvl: {
                "precision": round(s.precision, 4),
                "recall": round(s.recall, 4),
                "f1": round(s.f1, 4),
                "support": s.support,
            }
            for lvl, s in sc.per_level.items()
        },
        "confusion": sc.confusion,
        "rows": rows,
        "metrics": sc.metrics_snapshot,
        "predicted_counts": rep.counts,
        "summary": rep.summary,
    }

    if save:
        slug = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        out_path = ROOT / "eval" / "reports" / f"{name}__{slug}.json"
        out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
        # Also overwrite a "latest" alias for the frontend
        latest = ROOT / "eval" / "reports" / "latest.json"
        latest.write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(f"  Saved → {out_path.relative_to(ROOT)}")
        print(f"  Alias → {latest.relative_to(ROOT)}")
    return out


async def amain(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Eval the contract adviser pipeline")
    p.add_argument("--case", choices=list(CASES.keys()), default=None)
    p.add_argument("--save", action="store_true", help="Persist report under eval/reports/")
    args = p.parse_args(argv)

    cases = [args.case] if args.case else list(CASES.keys())
    for name in cases:
        await evaluate_case(name, save=args.save)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(amain(sys.argv[1:])))
