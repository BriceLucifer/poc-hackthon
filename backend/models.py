"""Pydantic schemas for the Research Contract Adviser Agent."""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ContractType(str, Enum):
    PUBLIC_RESEARCH = "Public Research Contract"
    COMMERCIAL_RESEARCH = "Commercial Research Contract"
    SUBCONTRACT = "Research Subcontract"
    MTA = "Material Transfer Agreement"
    DTA = "Data Transfer Agreement"
    DAA = "Data Access Agreement"
    COLLABORATION = "Collaboration Agreement"
    CDA = "Confidential Disclosure Agreement"
    MSA = "Master Services Agreement"
    PROVISION_OF_SERVICES = "Provision of Services Agreement"
    CONSULTANCY = "Consultancy Services Agreement"
    CTRA = "Clinical Trial Research Agreement"
    SRA = "Student Research Agreement"
    UNKNOWN = "Unknown"


class FlagLevel(str, Enum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"
    BLUE = "blue"


class Clause(BaseModel):
    """A single clause extracted from the contract."""
    id: str = Field(..., description="Stable id (e.g. clause number)")
    title: str = Field("", description="Heading or short title")
    text: str = Field(..., description="Full clause text")


class FlagItem(BaseModel):
    """One row in the review report."""
    level: FlagLevel
    clause_id: str
    clause_title: str
    snippet: str = Field(..., description="Short representative snippet")
    rationale: str = Field(..., description="Why this clause was flagged")
    standard_ref: str | None = Field(
        None, description="Which UoA position / template this maps to"
    )


class ReviewMetrics(BaseModel):
    """Per-review observability surface for the UI / eval harness."""
    n_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    total_cost_usd: float = 0.0
    backend: str = ""
    model: str = ""


class ContractReview(BaseModel):
    """Full review report returned to the frontend."""
    document_id: str
    filename: str
    contract_type: ContractType
    contract_type_confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    flags: list[FlagItem]
    counts: dict[str, int]
    generated_at: str
    metrics: ReviewMetrics = ReviewMetrics()
    references_used: list[str] = []


class ClassifyResponse(BaseModel):
    document_id: str
    filename: str
    contract_type: ContractType
    confidence: float
    rationale: str


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    char_count: int
    clause_count: int


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    document_id: str | None = None
    history: list[ChatTurn] = []
    message: str


class ChatResponse(BaseModel):
    reply: str
    citations: list[str] = []
