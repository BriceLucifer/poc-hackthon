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
from collections.abc import Sequence

import pdfplumber
from PIL import ImageOps

from api_clients import call_vision_ocr, is_configured

VISION_MODE = os.getenv("PDF_VISION_OCR", "on").lower()
MIN_TEXT_CHARS = 50  # below this, treat the page as image-only and OCR it
RENDER_RESOLUTION = int(os.getenv("PDF_VISION_RENDER_DPI", "105"))
IMAGE_QUALITY = int(os.getenv("PDF_VISION_IMAGE_QUALITY", "78"))
OCR_MAX_CONCURRENCY = int(os.getenv("PDF_VISION_OCR_CONCURRENCY", "4"))
VISION_DETAIL = os.getenv("PDF_VISION_DETAIL", "high").lower()


async def extract_text_with_vision_fallback(raw: bytes) -> str:
    pages_text: list[str | None] = []
    ocr_jobs: list[tuple[int, bytes]] = []
    render_failures: list[str] = []
    ocr_failures: list[str] = []
    page_count = 0

    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        page_count = len(pdf.pages)
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

            image_bytes, error = _render_page_image(raw, i, page)
            if image_bytes is None:
                if error:
                    render_failures.append(f"page {i + 1}: {error}")
                pages_text.append(text)
                continue

            ocr_jobs.append((i, image_bytes))
            pages_text.append(None)

    if ocr_jobs:
        semaphore = asyncio.Semaphore(max(1, OCR_MAX_CONCURRENCY))

        async def run_ocr(idx: int, img: bytes) -> str:
            try:
                async with semaphore:
                    return await call_vision_ocr(
                        img,
                        label=f"vision_ocr_p{idx + 1}",
                        detail=VISION_DETAIL,
                    )
            except Exception as e:  # surface after all pages finish/cancel cleanly
                ocr_failures.append(f"page {idx + 1}: {type(e).__name__}: {e}")
                return ""

        results = await asyncio.gather(
            *[run_ocr(idx, img) for idx, img in ocr_jobs]
        )
        for (idx, _), text in zip(ocr_jobs, results):
            pages_text[idx] = (text or "").strip()

    extracted = "\n\n".join(p for p in pages_text if p)
    if not extracted.strip() and page_count:
        if ocr_failures:
            raise RuntimeError(
                "No contract text could be extracted. The PDF appears to be scanned, "
                "and GPT-4o vision OCR failed. First error: "
                + _first(ocr_failures)
            )
        if render_failures:
            raise RuntimeError(
                "No contract text could be extracted. The PDF appears to be scanned, "
                "and page rendering failed before OCR. First error: "
                + _first(render_failures)
            )
        if VISION_MODE == "off":
            raise RuntimeError(
                "No contract text could be extracted. This PDF appears to be scanned "
                "and PDF_VISION_OCR is off."
            )
        if not is_configured():
            raise RuntimeError(
                "No contract text could be extracted. This PDF appears to be scanned "
                "and no GPT-4o vision backend is configured."
            )
    return extracted


def _render_page_image(
    raw: bytes,
    index: int,
    page: pdfplumber.page.Page,
) -> tuple[bytes | None, str | None]:
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(raw)
        pdf_page = pdf[index]
        bitmap = pdf_page.render(scale=RENDER_RESOLUTION / 72)
        return _encode_for_vision(bitmap.to_pil()), None
    except Exception as first_error:
        try:
            pil_image = page.to_image(resolution=RENDER_RESOLUTION).original
            return _encode_for_vision(pil_image), None
        except Exception as second_error:
            return (
                None,
                f"{type(first_error).__name__}: {first_error}; "
                f"pdfplumber fallback {type(second_error).__name__}: {second_error}",
            )


def _first(values: Sequence[str]) -> str:
    return values[0] if values else "unknown failure"


def _encode_for_vision(image) -> bytes:
    image = image.convert("RGB")
    image = _crop_white_margin(image)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=IMAGE_QUALITY, optimize=True)
    return buf.getvalue()


def _crop_white_margin(image):
    gray = ImageOps.grayscale(image)
    mask = gray.point(lambda pixel: 255 if pixel < 245 else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return image
    margin = max(8, int(RENDER_RESOLUTION * 0.12))
    left, top, right, bottom = bbox
    return image.crop((
        max(0, left - margin),
        max(0, top - margin),
        min(image.width, right + margin),
        min(image.height, bottom + margin),
    ))
