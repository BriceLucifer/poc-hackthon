"""
Azure AI Foundry client — PLACEHOLDERS.

Foundry exposes two compatible surfaces; this module abstracts both so the
rest of the agent stays provider-agnostic:

  1) Azure OpenAI (chat + embeddings) — most common path for GPT-4o / 4.1 /
     o-series and text-embedding-3-large.

  2) Azure AI Foundry "Models as a Service" / serverless endpoints — for
     Llama-3, Mistral Large, Phi, etc. They speak the OpenAI-compatible
     protocol, so `call_llm` works against either.

Each call to `call_llm` records usage in a thread-local Usage tracker so
the agent can attribute token cost / latency to a single request. Use:
    with track_usage() as usage:
        await call_llm(...)
        await call_llm(...)
    print(usage.total_cost_usd, usage.latency_ms, usage.calls)
"""
from __future__ import annotations

import contextvars
import json
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Iterator, Literal

# ---------- Configuration ---------------------------------------------------

# --- Azure OpenAI (preferred for GPT-4o / 4.1 / o-series) ---
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")  # https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")
AZURE_OPENAI_CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "")  # e.g. gpt-4o
AZURE_OPENAI_EMBED_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", "")  # e.g. text-embedding-3-large

# --- Azure AI Foundry serverless / MaaS (Llama, Mistral, Phi, etc.) ---
FOUNDRY_ENDPOINT = os.getenv("FOUNDRY_ENDPOINT", "")  # https://<deployment>.<region>.models.ai.azure.com
FOUNDRY_API_KEY = os.getenv("FOUNDRY_API_KEY", "")
FOUNDRY_MODEL = os.getenv("FOUNDRY_MODEL", "")  # e.g. Mistral-large-2407, Llama-3.1-70B-Instruct

# Which path to prefer when both are set.
PREFERRED_BACKEND: Literal["azure-openai", "foundry-maas", "auto"] = (
    os.getenv("LLM_BACKEND", "auto")  # type: ignore[assignment]
)


def is_configured() -> bool:
    """True if any Foundry surface is configured."""
    return bool(
        (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_CHAT_DEPLOYMENT)
        or (FOUNDRY_ENDPOINT and FOUNDRY_API_KEY)
    )


# ---------- Usage tracking --------------------------------------------------

# GPT-4o pricing (USD per 1M tokens) as of late 2024 — adjust for your tier.
# The agent only consumes these to estimate cost; not used for billing.
_PRICING_PER_M = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "default": (2.50, 10.00),
}


@dataclass
class CallRecord:
    label: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    backend: str = ""
    model: str = ""


@dataclass
class Usage:
    calls: list[CallRecord] = field(default_factory=list)

    @property
    def input_tokens(self) -> int:
        return sum(c.input_tokens for c in self.calls)

    @property
    def output_tokens(self) -> int:
        return sum(c.output_tokens for c in self.calls)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def total_cost_usd(self) -> float:
        return sum(c.cost_usd for c in self.calls)

    @property
    def latency_ms(self) -> float:
        return sum(c.latency_ms for c in self.calls)

    def to_dict(self) -> dict:
        return {
            "calls": [c.__dict__ for c in self.calls],
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "latency_ms": round(self.latency_ms, 1),
            "total_cost_usd": round(self.total_cost_usd, 6),
            "n_calls": len(self.calls),
        }


_current_usage: contextvars.ContextVar[Usage | None] = contextvars.ContextVar(
    "current_usage", default=None
)


@contextmanager
def track_usage() -> Iterator[Usage]:
    usage = Usage()
    token = _current_usage.set(usage)
    try:
        yield usage
    finally:
        _current_usage.reset(token)


def _record(record: CallRecord) -> None:
    u = _current_usage.get()
    if u is not None:
        u.calls.append(record)


def _estimate_cost(model: str, in_tokens: int, out_tokens: int) -> float:
    in_price, out_price = _PRICING_PER_M.get(
        model.lower(), _PRICING_PER_M["default"]
    )
    return (in_tokens * in_price + out_tokens * out_price) / 1_000_000


def _resolve_backend() -> str:
    if PREFERRED_BACKEND == "azure-openai":
        return "azure-openai"
    if PREFERRED_BACKEND == "foundry-maas":
        return "foundry-maas"
    # auto: Azure OpenAI first if configured
    if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_CHAT_DEPLOYMENT:
        return "azure-openai"
    if FOUNDRY_ENDPOINT and FOUNDRY_API_KEY:
        return "foundry-maas"
    return "mock"


# ---------- Public API ------------------------------------------------------

async def call_llm(
    system: str,
    user: str,
    *,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int = 2048,
    label: str = "llm",
) -> str:
    """
    Single-turn completion. Returns a string (JSON-parsable when json_mode=True).

    REPLACE the TODO body with one of:

    --- Option A: Azure OpenAI via the openai SDK -------------------------
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
    )
    resp = await client.chat.completions.create(
        model=AZURE_OPENAI_CHAT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"} if json_mode else None,
    )
    return resp.choices[0].message.content or ""

    --- Option B: Foundry MaaS via azure-ai-inference ---------------------
    from azure.ai.inference.aio import ChatCompletionsClient
    from azure.core.credentials import AzureKeyCredential
    from azure.ai.inference.models import SystemMessage, UserMessage
    client = ChatCompletionsClient(
        endpoint=FOUNDRY_ENDPOINT,
        credential=AzureKeyCredential(FOUNDRY_API_KEY),
    )
    resp = await client.complete(
        model=FOUNDRY_MODEL or None,
        messages=[SystemMessage(system), UserMessage(user)],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"} if json_mode else None,
    )
    return resp.choices[0].message.content or ""
    """
    backend = _resolve_backend()
    if backend == "mock":
        return _mock_response(system, user, json_mode=json_mode)

    started = time.perf_counter()
    text = ""
    in_tok = out_tok = 0
    model = ""

    if backend == "azure-openai":
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
        )
        kwargs: dict = {
            "model": AZURE_OPENAI_CHAT_DEPLOYMENT,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**kwargs)
        text = resp.choices[0].message.content or ""
        if resp.usage:
            in_tok = resp.usage.prompt_tokens
            out_tok = resp.usage.completion_tokens
        model = AZURE_OPENAI_CHAT_DEPLOYMENT

    elif backend == "foundry-maas":
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            base_url=FOUNDRY_ENDPOINT.rstrip("/") + "/v1",
            api_key=FOUNDRY_API_KEY,
        )
        kwargs = {
            "model": FOUNDRY_MODEL or "default",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**kwargs)
        text = resp.choices[0].message.content or ""
        if resp.usage:
            in_tok = resp.usage.prompt_tokens
            out_tok = resp.usage.completion_tokens
        model = FOUNDRY_MODEL or "default"

    else:
        return _mock_response(system, user, json_mode=json_mode)

    latency_ms = (time.perf_counter() - started) * 1000
    _record(CallRecord(
        label=label,
        input_tokens=in_tok,
        output_tokens=out_tok,
        latency_ms=latency_ms,
        cost_usd=_estimate_cost(model, in_tok, out_tok),
        backend=backend,
        model=model,
    ))
    return text


async def call_vision_ocr(
    image_bytes: bytes,
    *,
    label: str = "vision_ocr",
    detail: str = "high",
) -> str:
    """Send a single page image to GPT-4o vision and get a clean transcript.

    Used as an OCR fallback for PDF pages that have no extractable text layer
    (i.e. scanned pages). Returns "" if vision is not available.
    """
    backend = _resolve_backend()
    if backend != "azure-openai":
        return ""

    import base64
    from openai import AsyncAzureOpenAI

    started = time.perf_counter()
    b64 = base64.b64encode(image_bytes).decode("ascii")

    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
    )
    resp = await client.chat.completions.create(
        model=AZURE_OPENAI_CHAT_DEPLOYMENT,
        max_tokens=4096,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "Transcribe this contract page exactly as written. Preserve "
                    "the document's clause numbering (e.g. '1.1', '2.3.4'), "
                    "section headings, and paragraph structure. Output ONLY the "
                    "raw text — no preamble, no commentary, no markdown formatting "
                    "beyond the document's own structure. Do not summarise. "
                    "Do not skip footnotes, page numbers, or signatures (mark "
                    "signatures as '[signature]')."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Transcribe this contract page:"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64}",
                            "detail": detail,
                        },
                    },
                ],
            },
        ],
    )
    text = resp.choices[0].message.content or ""

    latency_ms = (time.perf_counter() - started) * 1000
    in_tok = resp.usage.prompt_tokens if resp.usage else 0
    out_tok = resp.usage.completion_tokens if resp.usage else 0
    _record(CallRecord(
        label=label,
        input_tokens=in_tok,
        output_tokens=out_tok,
        latency_ms=latency_ms,
        cost_usd=_estimate_cost(AZURE_OPENAI_CHAT_DEPLOYMENT, in_tok, out_tok),
        backend="azure-openai",
        model=AZURE_OPENAI_CHAT_DEPLOYMENT,
    ))
    return text


async def embed(texts: list[str]) -> list[list[float]]:
    """
    Embedding endpoint — used for clause-level similarity search against
    standard templates.

    REPLACE with:

    --- Azure OpenAI ------------------------------------------------------
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
    )
    resp = await client.embeddings.create(
        model=AZURE_OPENAI_EMBED_DEPLOYMENT,
        input=texts,
    )
    return [d.embedding for d in resp.data]
    """
    if _resolve_backend() == "mock" or not AZURE_OPENAI_EMBED_DEPLOYMENT:
        return [[float((sum(map(ord, t)) % 997) / 997.0)] * 8 for t in texts]

    from openai import AsyncAzureOpenAI

    client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
    )
    resp = await client.embeddings.create(
        model=AZURE_OPENAI_EMBED_DEPLOYMENT,
        input=texts,
    )
    return [d.embedding for d in resp.data]


# ---------- Mock fallback ---------------------------------------------------

def _mock_response(system: str, user: str, *, json_mode: bool) -> str:
    if json_mode:
        return _MOCK_JSON
    return (
        "[mock] Azure AI Foundry not configured. Set AZURE_OPENAI_ENDPOINT + "
        "AZURE_OPENAI_API_KEY + AZURE_OPENAI_CHAT_DEPLOYMENT in backend/.env "
        "(or FOUNDRY_ENDPOINT + FOUNDRY_API_KEY) to enable real reasoning."
    )


_MOCK_JSON = json.dumps({
    "contract_type": "Commercial Research Contract",
    "confidence": 0.78,
    "rationale": "Mock classifier — wire api_clients.call_llm to Azure AI Foundry.",
    "flags": [
        {
            "level": "green",
            "clause_id": "3.1",
            "clause_title": "Confidentiality",
            "snippet": "Each party shall keep confidential information confidential...",
            "rationale": "Aligns with UoA standard mutual confidentiality position.",
            "standard_ref": "UoA Position #C-01",
        },
        {
            "level": "amber",
            "clause_id": "5.2",
            "clause_title": "Publication",
            "snippet": "Sponsor approval required prior to any publication.",
            "rationale": "Partial alignment; UoA permits 30-day review, not approval.",
            "standard_ref": "UoA Position #P-04",
        },
        {
            "level": "red",
            "clause_id": "7.4",
            "clause_title": "IP Assignment",
            "snippet": "All foreground IP shall vest in Sponsor.",
            "rationale": "Conflicts with UoA standard — university retains background IP and licenses foreground.",
            "standard_ref": "UoA Position #IP-02",
        },
        {
            "level": "blue",
            "clause_id": "11",
            "clause_title": "Export Control",
            "snippet": "Each party shall comply with applicable export laws.",
            "rationale": "Not addressed in current UoA standard positions.",
            "standard_ref": None,
        },
    ],
    "summary": (
        "Mock summary: contract is broadly acceptable with one red-flag IP "
        "clause that must be renegotiated."
    ),
}, indent=2)
