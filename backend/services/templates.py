"""UoA template registry — loads the standard UoA template(s) for each
contract type and exposes their text to the agent.

The Positions PDF is the *meta-policy* (cross-type rules like Liability,
Indemnity, Publication). The templates are the *type-specific* gold
standard wording. To review a real contract well the LLM needs both:
  - the Positions JSON (rules)
  - the matching UoA template (canonical clause language)

Templates live under ../data/ as DOCX/PDF. They are loaded lazily and
cached on first access.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from models import ContractType
from services.parser import extract_text


_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# Contract type → list of filenames under data/. The first matching file
# that exists is used. Multiple entries support the in/out-bound variants
# (incoming + outgoing MTA, etc.) — they're concatenated when both apply.
_REGISTRY: dict[ContractType, list[str]] = {
    ContractType.PUBLIC_RESEARCH: [
        "UoA-Public Research Contract Template.docx",
        "UoA-Public Funding Agreement Template.docx",
        "UoA-Research Contract Template.docx",
    ],
    ContractType.COMMERCIAL_RESEARCH: [
        "UoA-Commercial Research Contract Template.docx",
        "UoA-Research Contract Template.docx",
    ],
    ContractType.SUBCONTRACT: [
        "UoA-Research Subcontract Template.docx",
        "UoA-Subcontract Agreement Template.docx",
    ],
    ContractType.MTA: [
        "UoA-Material_Transfer_Agreement incoming-Aug 2024.docx",
        "UoA-Material_Transfer_Agreement_outgoing_Aug 2024.docx",
        "UoA-MTA_Outbound for Key Materials-April 2018.docx",
    ],
    ContractType.SRA: [
        "UoA-Student Research Agreement Template (April 2018).docx",
    ],
    ContractType.CDA: [
        "UoA-CDA Two Way Template.docx",
    ],
    ContractType.DTA: [
        "UoA-Data Transfer Agreement Template (incoming) April 2024 .docx",
        "UoA-Data Transfer Agreement Template (incoming) April 2024.docx",
        "UoA-Data Transfer Agreement Template (outgoing) April 2024.docx",
    ],
    ContractType.DAA: [
        "UoA-Data Access Agreement Agency Template (incoming) May 2024 (1).docx",
        "UoA-Data Access Agreement Agency Template (incoming).docx",
        "UoA-Data Access Agreement Template (outgoing) May 2024.docx",
    ],
    ContractType.COLLABORATION: [
        "UoA-Research Collaboration Agreement Template (1).docx",
        "UoA-Research Collaboration Agreement Template.docx",
        "UoA-Collaboration Agreement Template.docx",
    ],
    ContractType.MSA: [
        "UoA-Master Services Agreement Template (1).docx",
    ],
    ContractType.PROVISION_OF_SERVICES: [
        "UoA-Provision of Services Agreement (Agency)_June 2024.docx",
        "UoA-Provision of Services Agreement Template.docx",
    ],
    ContractType.CONSULTANCY: [
        "UoA-Consultancy Services Agreement Template.docx",
        "UoA-Consultancy Agreement Template.docx",
    ],
    ContractType.CTRA: [
        "UoA-Clinical Trial Research Agreement Template.docx",
        "NZACRes Clinical Research Contract Template.docx",
        "NZACRe Clinical Research Contract Template.docx",
    ],
    ContractType.UNKNOWN: [],
}

_FALLBACK_REGISTRY: dict[ContractType, list[str]] = {
    ContractType.COMMERCIAL_RESEARCH: [
        "UoA-Master Services Agreement Template (1).docx",
    ],
    ContractType.PROVISION_OF_SERVICES: [
        "UoA-Master Services Agreement Template (1).docx",
    ],
    ContractType.CONSULTANCY: [
        "UoA-Master Services Agreement Template (1).docx",
    ],
}

# Cap length per template to keep the LLM context budget sane.
_MAX_TEMPLATE_CHARS = 30_000


def _normalise_filename(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", Path(name).stem.lower())


@lru_cache(maxsize=128)
def _resolve_template_path(name: str) -> Path | None:
    exact = _DATA_DIR / name
    if exact.exists():
        return exact

    target = _normalise_filename(name)
    for path in _DATA_DIR.iterdir():
        if path.is_file() and _normalise_filename(path.name) == target:
            return path
    return None


@lru_cache(maxsize=64)
def template_text_for(contract_type: ContractType) -> str:
    """Return concatenated UoA template text for the given contract type.

    Returns an empty string if no template is registered or files are missing.
    """
    filenames = _template_names_for(contract_type)
    blocks: list[str] = []
    for name in filenames:
        path = _resolve_template_path(name)
        if path is None:
            continue
        try:
            text = extract_text(path.name, path.read_bytes())
        except Exception:
            continue
        if text.strip():
            blocks.append(f"### {path.name}\n\n{text.strip()}")
    if not blocks:
        return ""
    joined = "\n\n---\n\n".join(blocks)
    if len(joined) > _MAX_TEMPLATE_CHARS:
        joined = joined[:_MAX_TEMPLATE_CHARS] + "\n\n[…template truncated…]"
    return joined


def template_filenames_for(contract_type: ContractType) -> list[str]:
    """Return filenames that actually exist on disk for this type."""
    names: list[str] = []
    for name in _template_names_for(contract_type):
        path = _resolve_template_path(name)
        if path is not None and path.name not in names:
            names.append(path.name)
    return names


def template_coverage() -> list[dict]:
    """Return per-contract-type template coverage for API/UI diagnostics."""
    rows: list[dict] = []
    for contract_type in ContractType:
        if contract_type == ContractType.UNKNOWN:
            continue
        primary = _resolved_names(_REGISTRY.get(contract_type, []))
        fallback = [
            name for name in _resolved_names(_FALLBACK_REGISTRY.get(contract_type, []))
            if name not in primary
        ]
        missing = [
            name for name in _REGISTRY.get(contract_type, [])
            if _resolve_template_path(name) is None
        ]
        rows.append({
            "contract_type": contract_type.value,
            "template_files": primary,
            "fallback_files": fallback,
            "missing_candidates": missing,
            "has_template": bool(primary or fallback),
        })
    return rows


def _template_names_for(contract_type: ContractType) -> list[str]:
    names = list(_REGISTRY.get(contract_type, []))
    for name in _FALLBACK_REGISTRY.get(contract_type, []):
        if name not in names:
            names.append(name)
    return names


def _resolved_names(names: list[str]) -> list[str]:
    resolved: list[str] = []
    for name in names:
        path = _resolve_template_path(name)
        if path is not None and path.name not in resolved:
            resolved.append(path.name)
    return resolved
