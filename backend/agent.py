"""
Agent orchestration.

The agent is a thin pipeline:

    upload  →  parse text + clauses
            →  classify contract type   (keyword baseline; LLM refines if configured)
            →  compare clauses to UoA positions  (deterministic; LLM augments if configured)
            →  build report

LLM hooks live in api_clients.py — leave them as-is for the offline demo,
or wire in your provider when ready.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field

from api_clients import CallRecord, call_llm, is_configured, track_usage
from models import (
    Clause,
    ContractReview,
    ContractType,
    FlagItem,
    FlagLevel,
    ReviewMetrics,
)
from services.classifier import classify_by_keywords
from services.comparator import compare_clauses, load_positions
from services.parser import extract_text_async, split_clauses
from services.reporter import build_report
from services.templates import template_filenames_for, template_text_for


@dataclass
class StoredDocument:
    document_id: str
    filename: str
    text: str
    clauses: list[Clause] = field(default_factory=list)
    ingest_calls: list[CallRecord] = field(default_factory=list)


# Tiny in-memory store. Swap for Redis / DB before any real deployment.
_store: dict[str, StoredDocument] = {}


def get_document(document_id: str) -> StoredDocument | None:
    return _store.get(document_id)


async def ingest(filename: str, raw: bytes) -> StoredDocument:
    """Ingest a file. Uses GPT-4o vision OCR for every PDF page (kills both
    scanned-page blackouts and multi-column interleaving)."""
    with track_usage() as ingest_usage:
        text = await extract_text_async(filename, raw)
    clauses = split_clauses(text)
    doc = StoredDocument(
        document_id=uuid.uuid4().hex,
        filename=filename,
        text=text,
        clauses=clauses,
        ingest_calls=list(ingest_usage.calls),
    )
    _store[doc.document_id] = doc
    return doc


# --------------------------------------------------------------------------
# Classification
# --------------------------------------------------------------------------

async def classify(doc: StoredDocument) -> tuple[ContractType, float, str]:
    """Return (contract_type, confidence, rationale)."""
    base_type, base_conf, base_reason = classify_by_keywords(doc.text)

    if not is_configured():
        return base_type, base_conf, base_reason

    valid = ", ".join(t.value for t in ContractType if t != ContractType.UNKNOWN)
    system = (
        "You are a research-contracts triage assistant. Classify the contract "
        "into exactly one of the listed categories. Respond with strict JSON "
        '{"contract_type": <one of the categories>, "confidence": <0..1>, '
        '"rationale": <short reason>}.'
    )
    user = (
        f"Allowed categories: {valid}.\n"
        f"Keyword baseline suggests: {base_type.value} "
        f"(confidence {base_conf}, {base_reason}).\n\n"
        f"Document excerpt:\n---\n{doc.text[:6000]}\n---\n"
    )
    raw = await call_llm(system, user, json_mode=True, label="classify")
    try:
        data = json.loads(raw)
        ct = ContractType(data["contract_type"])
        conf = float(data.get("confidence", base_conf))
        rationale = str(data.get("rationale", base_reason))
        return ct, max(0.0, min(1.0, conf)), rationale
    except (json.JSONDecodeError, KeyError, ValueError):
        return base_type, base_conf, base_reason


# --------------------------------------------------------------------------
# Review
# --------------------------------------------------------------------------

async def review(doc: StoredDocument) -> ContractReview:
    with track_usage() as usage:
        contract_type, confidence, _ = await classify(doc)
        flags = compare_clauses(doc.clauses, contract_type)

        if is_configured():
            flags = await _augment_flags_with_llm(doc, contract_type, flags)

        summary = await _llm_summary(doc, contract_type, flags) if is_configured() else None
        report = build_report(
            document_id=doc.document_id,
            filename=doc.filename,
            contract_type=contract_type,
            confidence=confidence,
            flags=flags,
            summary=summary,
        )

    all_calls = list(doc.ingest_calls) + list(usage.calls)
    sample_call = all_calls[0] if all_calls else None
    report.metrics = ReviewMetrics(
        n_calls=len(all_calls),
        input_tokens=sum(c.input_tokens for c in all_calls),
        output_tokens=sum(c.output_tokens for c in all_calls),
        total_tokens=sum(c.input_tokens + c.output_tokens for c in all_calls),
        latency_ms=round(sum(c.latency_ms for c in all_calls), 1),
        total_cost_usd=round(sum(c.cost_usd for c in all_calls), 6),
        backend=sample_call.backend if sample_call else "",
        model=sample_call.model if sample_call else "",
    )
    report.references_used = (
        ["UoA Preferred Contracting Positions (Sept 2025 draft)"]
        + [f"UoA Template — {f}" for f in template_filenames_for(contract_type)]
    )
    return report


async def _augment_flags_with_llm(
    doc: StoredDocument,
    contract_type: ContractType,
    seed_flags: list[FlagItem],
) -> list[FlagItem]:
    """Ask the LLM to refine / extend the deterministic flags.

    Strategy: send the LLM the seed flags + UoA positions + clauses, ask it
    to revise levels and rationales. If parsing fails, fall back to seeds.
    """
    positions = load_positions()
    relevant_positions = [
        p for p in positions
        if "any" in p.get("applies_to", []) or contract_type.value in p.get("applies_to", [])
    ]
    template_text = template_text_for(contract_type)
    has_template = bool(template_text)

    system = (
        "You are an expert research-contracts reviewer for the University of Auckland (UoA). "
        "You will be given THREE inputs:\n"
        "  1. UoA Preferred Contracting Positions — the cross-type policy (rules).\n"
        "  2. The UoA Standard Template for this contract type — the canonical "
        "wording UoA itself would draft. (Absent for some types.)\n"
        "  3. The clauses extracted from the contract under review, plus candidate "
        "flags from a deterministic comparator.\n\n"
        "Refine the flag list. The flag system maps to the Positions tiers:\n"
        "  • Clause matches Preferred / matches the UoA Template       → green\n"
        "  • Clause matches Acceptable tier (deviation pre-approved)   → amber\n"
        "  • Clause falls outside Acceptable / triggers Escalation OR \n"
        "    materially deviates from the UoA Template wording         → red\n"
        "  • Clause topic not covered by any Position AND no template  → blue\n\n"
        "Important reasoning rules:\n"
        "  • When evaluating liability/indemnity, take any monetary cap into account "
        "(a low cap can convert a literal 'assumes all liability' phrasing from RED "
        "to AMBER if total exposure stays well under NZD$500K).\n"
        "  • When evaluating publication, recognise that 'co-author + acknowledge + "
        "provide a copy' preserves the right to publish and is GREEN.\n"
        "  • When evaluating exclusion of indirect/consequential losses, recognise "
        "phrasings other than 'excluded' (e.g. 'will not extend to', 'shall not include').\n"
        "  • Any Intellectual Property clause (results ownership, IP assignment, "
        "background/foreground IP, patent rights) is AMBER and the rationale must "
        "refer the reader to Auckland UniServices — UoA Positions does not own IP.\n\n"
        "Return strict JSON: "
        '{"flags": [{"level":"green|amber|red|blue","clause_id":"..","clause_title":"..",'
        '"snippet":"..","rationale":"..","standard_ref":"UoA Position #... or UoA Template"}]}. '
        "Rationale should name the topic, name which UoA reference (Position id or "
        "the template) it ties to, state which tier the clause matches, and (for red) "
        "name the escalation route. Be concrete; don't hedge."
    )

    user_parts = [f"Contract type: {contract_type.value}\n"]
    user_parts.append(
        "## UoA Preferred Contracting Positions (only those applicable to this type)\n"
        + json.dumps(relevant_positions, indent=2)
    )
    if has_template:
        user_parts.append(
            "## UoA Standard Template for this contract type (canonical wording)\n"
            + template_text
        )
    else:
        user_parts.append(
            "## UoA Standard Template\n"
            "(No UoA template registered for this contract type — rely on the "
            "Positions document only.)"
        )
    user_parts.append(
        "## Candidate flags from the deterministic comparator (refine as needed)\n"
        + json.dumps([f.model_dump() for f in seed_flags], indent=2)
    )
    user = "\n\n".join(user_parts)
    raw = await call_llm(system, user, json_mode=True, max_tokens=4096, label="augment_flags")
    try:
        data = json.loads(raw)
        refined: list[FlagItem] = []
        for item in data.get("flags", []):
            refined.append(FlagItem(
                level=FlagLevel(item["level"]),
                clause_id=str(item.get("clause_id", "")),
                clause_title=str(item.get("clause_title", "")),
                snippet=str(item.get("snippet", "")),
                rationale=str(item.get("rationale", "")),
                standard_ref=item.get("standard_ref"),
            ))
        return refined or seed_flags
    except (json.JSONDecodeError, KeyError, ValueError):
        return seed_flags


async def _llm_summary(
    doc: StoredDocument,
    contract_type: ContractType,
    flags: list[FlagItem],
) -> str | None:
    if not flags:
        return None
    system = (
        "You write 2-3 sentence executive summaries for a research-contracts "
        "review report. Mention overall risk posture, the headline issues, "
        "and a recommended next step. Plain prose, no bullets."
    )
    user = (
        f"Contract type: {contract_type.value}\n"
        f"Filename: {doc.filename}\n"
        f"Flags: {json.dumps([f.model_dump() for f in flags])}\n"
    )
    text = await call_llm(system, user, max_tokens=400, label="summary")
    return text.strip() or None


# --------------------------------------------------------------------------
# Chat (open-ended Q&A about the loaded document)
# --------------------------------------------------------------------------

async def chat(
    document_id: str | None,
    history: list[dict],
    message: str,
) -> str:
    doc = _store.get(document_id) if document_id else None
    context = ""
    if doc:
        context = (
            f"\nLoaded document: {doc.filename}\n"
            f"Excerpt:\n---\n{doc.text[:4000]}\n---\n"
        )
    if not is_configured():
        return (
            "[mock chat] No LLM provider configured. Set ANTHROPIC_API_KEY in "
            "backend/.env to enable real conversation."
            + context
        )
    system = (
        "You are a research-contracts adviser assistant for the University of "
        "Auckland. Answer concisely. You do NOT provide legal advice. Always "
        "remind the user that final decisions sit with the Research Contracts team."
        + context
    )
    transcript = "\n".join(f"{t['role'].upper()}: {t['content']}" for t in history[-10:])
    user = f"{transcript}\nUSER: {message}"
    return await call_llm(system, user, max_tokens=800)
