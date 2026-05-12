"""PDF text extraction with GPT-4o vision OCR fallback for image-only pages.

For each page:
  - Try pdfplumber first.
  - If the result is shorter than MIN_TEXT_CHARS (likely a scanned page),
    render the page to PNG and transcribe via GPT-4o vision.
  - Pages OCR in parallel for speed.

Why fallback (not always-on): empirically, vision OCR on text-layer pages
slightly paraphrases the legal wording, which loses the precise keyword
hooks the comparator and LLM rely on (e.g. "indemnify in full" → "be
responsible for indemnification"). On clean text PDFs that hurts F1.
Use vision strictly to recover content we can't read otherwise.

Set PDF_VISION_OCR=off to skip vision entirely (handy in dev / unit tests).
"""
from __future__ import annotations

import asyncio
import io
import os

import pdfplumber

from api_clients import call_vision_ocr, is_configured

VISION_MODE = os.getenv("PDF_VISION_OCR", "on").lower()
MIN_TEXT_CHARS = 50  # below this, treat the page as image-only and OCR it
RENDER_RESOLUTION = 150  # DPI — print quality, ~5 image tiles per A4 page


async def extract_text_with_vision_fallback(raw: bytes) -> str:
    pages_text: list[str | None] = []
    ocr_jobs: list[tuple[int, bytes]] = []

    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = (page.extract_text() or "").strip()
            if len(text) >= MIN_TEXT_CHARS:
                pages_text.append(text)
                continue

            # Page has no usable text layer — schedule a vision OCR (or
            # accept the empty result if vision is disabled).
            if VISION_MODE == "off" or not is_configured():
                pages_text.append(text)
                continue

            try:
                pil_image = page.to_image(resolution=RENDER_RESOLUTION).original
            except Exception:
                pages_text.append(text)
                continue

            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            ocr_jobs.append((i, buf.getvalue()))
            pages_text.append(None)

    if ocr_jobs:
        results = await asyncio.gather(
            *[
                call_vision_ocr(img, label=f"vision_ocr_p{idx + 1}")
                for idx, img in ocr_jobs
            ]
        )
        for (idx, _), text in zip(ocr_jobs, results):
            pages_text[idx] = (text or "").strip()

    return "\n\n".join(p for p in pages_text if p)
