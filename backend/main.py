"""FastAPI entrypoint — Research Contract Adviser Agent."""
from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Load .env BEFORE importing modules that read env vars
load_dotenv(Path(__file__).parent / ".env")

from agent import chat as agent_chat
from agent import get_document, ingest, review
from api_clients import is_configured
from models import (
    ChatRequest,
    ChatResponse,
    ClassifyResponse,
    ContractReview,
    UploadResponse,
)
from services.parser import SUPPORTED_EXTENSIONS

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = REPO_ROOT / "data"
EVAL_REPORT = REPO_ROOT / "eval" / "reports" / "latest.json"

# Curated samples surfaced in the UI's "Try sample" pill.
SAMPLE_REGISTRY = [
    {
        "id": "mta_example_1",
        "label": "MTA — Example 1",
        "description": "Real anonymised Material Transfer Agreement.",
        "filename": "MTA Example 1.pdf",
    },
]

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
CORS_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",") if o.strip()
]

app = FastAPI(
    title="Research Contract Adviser Agent",
    description=(
        "POC backend for the UoA Research Contracts Adviser. "
        "Upload a contract → receive a four-flag review report."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "llm_configured": is_configured(),
        "supported_uploads": sorted(SUPPORTED_EXTENSIONS),
        "max_upload_mb": MAX_UPLOAD_MB,
    }


@app.post("/api/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            400,
            f"Unsupported file type {suffix!r}. "
            f"Allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit.")
    try:
        doc = await ingest(file.filename or "contract", raw)
    except Exception as e:  # noqa: BLE001 — surface parse errors to the client
        raise HTTPException(400, f"Could not parse document: {e}") from e

    return UploadResponse(
        document_id=doc.document_id,
        filename=doc.filename,
        char_count=len(doc.text),
        clause_count=len(doc.clauses),
    )


@app.post("/api/classify/{document_id}", response_model=ClassifyResponse)
async def classify_route(document_id: str) -> ClassifyResponse:
    doc = get_document(document_id)
    if not doc:
        raise HTTPException(404, "Document not found.")
    from agent import classify as _classify
    contract_type, confidence, rationale = await _classify(doc)
    return ClassifyResponse(
        document_id=doc.document_id,
        filename=doc.filename,
        contract_type=contract_type,
        confidence=confidence,
        rationale=rationale,
    )


@app.post("/api/review/{document_id}", response_model=ContractReview)
async def review_route(document_id: str) -> ContractReview:
    doc = get_document(document_id)
    if not doc:
        raise HTTPException(404, "Document not found.")
    return await review(doc)


@app.get("/api/samples")
async def list_samples() -> dict:
    available = []
    for s in SAMPLE_REGISTRY:
        path = SAMPLES_DIR / s["filename"]
        if path.exists():
            available.append({**s, "size_bytes": path.stat().st_size})
    return {"samples": available}


@app.post("/api/samples/{sample_id}/load", response_model=UploadResponse)
async def load_sample(sample_id: str) -> UploadResponse:
    sample = next((s for s in SAMPLE_REGISTRY if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(404, "Unknown sample.")
    path = SAMPLES_DIR / sample["filename"]
    if not path.exists():
        raise HTTPException(
            404,
            f"Sample file missing on disk: {path.relative_to(REPO_ROOT)}",
        )
    raw = path.read_bytes()
    doc = await ingest(sample["filename"], raw)
    return UploadResponse(
        document_id=doc.document_id,
        filename=doc.filename,
        char_count=len(doc.text),
        clause_count=len(doc.clauses),
    )


@app.get("/api/eval/latest")
async def eval_latest() -> dict:
    if not EVAL_REPORT.exists():
        raise HTTPException(
            404,
            "No eval report yet. Run `uv run python eval/run_eval.py --save`.",
        )
    return json.loads(EVAL_REPORT.read_text(encoding="utf-8"))


@app.post("/api/chat", response_model=ChatResponse)
async def chat_route(req: ChatRequest) -> ChatResponse:
    history = [t.model_dump() for t in req.history]
    reply = await agent_chat(req.document_id, history, req.message)
    return ChatResponse(reply=reply, citations=[])


def run() -> None:
    """Entrypoint for `uv run serve`."""
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", "8000")),
        reload=True,
    )


if __name__ == "__main__":
    run()
