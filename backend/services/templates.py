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

from functools import lru_cache
from pathlib import Path

from models import ContractType
from services.parser import extract_text


_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# Contract type → list of filenames under data/. The first matching file
# that exists is used. Multiple entries support the in/out-bound variants
# (incoming + outgoing MTA, etc.) — they're concatenated when both apply.
_REGISTRY: dict[ContractType, list[str]] = {
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
        "UoA-Data Transfer Agreement Template (incoming) April 2024.docx",
        "UoA-Data Transfer Agreement Template (outgoing) April 2024.docx",
    ],
    ContractType.DAA: [
        "UoA-Data Access Agreement Agency Template (incoming).docx",
        "UoA-Data Access Agreement Template (outgoing) May 2024.docx",
    ],
    ContractType.MSA: [
        "UoA-Master Services Agreement Template (1).docx",
    ],
    ContractType.PROVISION_OF_SERVICES: [
        "UoA-Provision of Services Agreement (Agency)_June 2024.docx",
    ],
    ContractType.COLLABORATION: [
        "UoA-Research Collaboration Agreement Template (1).docx",
    ],
}

# Cap length per template to keep the LLM context budget sane.
_MAX_TEMPLATE_CHARS = 30_000


@lru_cache(maxsize=64)
def template_text_for(contract_type: ContractType) -> str:
    """Return concatenated UoA template text for the given contract type.

    Returns an empty string if no template is registered or files are missing.
    """
    filenames = _REGISTRY.get(contract_type, [])
    blocks: list[str] = []
    for name in filenames:
        path = _DATA_DIR / name
        if not path.exists():
            continue
        try:
            text = extract_text(name, path.read_bytes())
        except Exception:
            continue
        if text.strip():
            blocks.append(f"### {name}\n\n{text.strip()}")
    if not blocks:
        return ""
    joined = "\n\n---\n\n".join(blocks)
    if len(joined) > _MAX_TEMPLATE_CHARS:
        joined = joined[:_MAX_TEMPLATE_CHARS] + "\n\n[…template truncated…]"
    return joined


def template_filenames_for(contract_type: ContractType) -> list[str]:
    """Return filenames that actually exist on disk for this type."""
    return [
        name
        for name in _REGISTRY.get(contract_type, [])
        if (_DATA_DIR / name).exists()
    ]
