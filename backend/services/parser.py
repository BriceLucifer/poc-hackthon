"""Extract text and clauses from uploaded PDF / DOCX / TXT files."""
from __future__ import annotations

import io
import re
from pathlib import Path

import pdfplumber
from pypdf import PdfReader
import docx

from models import Clause


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def extract_text(filename: str, raw: bytes) -> str:
    """Synchronous text extraction — text-layer only.

    Use `extract_text_async` to additionally OCR scanned pages via GPT-4o vision.
    """
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        try:
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                pages = [(p.extract_text() or "") for p in pdf.pages]
            text = "\n".join(pages).strip()
            if text:
                return text
        except Exception:
            pass
        reader = PdfReader(io.BytesIO(raw))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    if ext == ".docx":
        document = docx.Document(io.BytesIO(raw))
        return "\n".join(p.text for p in document.paragraphs if p.text)
    if ext in {".txt", ".md"}:
        return raw.decode("utf-8", errors="ignore")
    raise ValueError(f"Unsupported file type: {ext}")


async def extract_text_async(filename: str, raw: bytes) -> str:
    """Async extraction — for PDFs, falls back to GPT-4o vision OCR on any
    page that doesn't have an extractable text layer (scanned pages).

    DOCX/TXT/MD don't need OCR; they go through the sync path.
    """
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        from services.vision_ocr import extract_text_with_vision_fallback
        return await extract_text_with_vision_fallback(raw)
    return extract_text(filename, raw)


# Numbered clause openers: "1.", "1.1", "1.1.2", "Article 5", "Section 3", "Clause 4".
# Require a trailing punctuation/space pattern so footnote markers ("Laws 2 ,")
# don't match.
_NUMBERED_HEAD = re.compile(
    r"""
    ^\s*
    (
        (?:Clause|Article|Section)\s+\d+(?:\.\d+)*       # Article 5 / Clause 4.2
        |
        \d+(?:\.\d+){1,3}                                 # 1.2 / 1.2.3 (must have a dot)
        |
        \d{1,2}\.                                         # 1. / 17.
        |
        \(\d{1,3}\)                                       # (1) / (12)
    )
    \s+
    (.{1,120}?)$
    """,
    re.IGNORECASE | re.MULTILINE | re.VERBOSE,
)

# ALL-CAPS section heads as used in UoA templates: "PARTIES", "DEFINITIONS
# AND INTERPRETATION", "GENERAL TERMS", "CONFIDENTIALITY". Min 4 chars,
# allows ampersands, slashes and parentheses, must be alone on the line.
_CAPS_HEAD = re.compile(
    r"""
    ^\s*
    (
        [A-Z][A-Z0-9 \&/\(\)\-,]{3,80}
    )
    \s*$
    """,
    re.MULTILINE | re.VERBOSE,
)


def split_clauses(text: str) -> list[Clause]:
    """Split a contract into clauses.

    Tries (in order):
      1. Numbered clause headings — preferred, used by most external contracts.
      2. ALL-CAPS section headings — used by the UoA templates themselves.
      3. Paragraph fall-back — guarantees the UI always has something to show.
    """
    text = re.sub(r"\r\n?", "\n", text).strip()
    if not text:
        return []

    numbered = list(_NUMBERED_HEAD.finditer(text))
    if len(numbered) >= 3:
        return _slice_by_matches(
            text, numbered,
            id_from_match=lambda m: m.group(1).strip().rstrip(".").strip("()"),
        )

    caps = [
        m for m in _CAPS_HEAD.finditer(text)
        # Reject obvious noise: lines that are mostly digits / punctuation.
        if sum(c.isalpha() for c in m.group(1)) >= 4
    ]
    if len(caps) >= 3:
        return _slice_by_matches(
            text, caps,
            id_from_match=lambda m, i=[0]: (i.__setitem__(0, i[0] + 1), str(i[0]))[1],
            title_from_match=lambda m: m.group(1).strip(),
        )

    # Final fall-back: paragraph chunks.
    chunks = [c.strip() for c in re.split(r"\n\s*\n", text) if c.strip()]
    return [
        Clause(id=str(i + 1), title=_first_line(c), text=c)
        for i, c in enumerate(chunks)
    ]


def _slice_by_matches(text, matches, *, id_from_match, title_from_match=None) -> list[Clause]:
    clauses: list[Clause] = []
    for i, m in enumerate(matches):
        cid = id_from_match(m)
        if title_from_match:
            title = title_from_match(m).strip(" .:-—")
        else:
            # numbered case: group(2) is the inline title (may be empty)
            title = (m.group(2) or "").strip(" .:-—") if m.lastindex and m.lastindex >= 2 else ""
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        full = f"{title}\n{body}".strip() if title else body
        if not full:
            continue
        clauses.append(Clause(id=cid, title=title, text=full))
    return clauses


def _first_line(s: str, limit: int = 80) -> str:
    line = s.strip().split("\n", 1)[0]
    return line[:limit]
