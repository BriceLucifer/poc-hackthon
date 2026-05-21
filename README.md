# Research Contract Adviser Agent — POC

University of Auckland · COMPSCI 714 hackathon · Powered by Azure AI Foundry

An agent that reviews research contracts against the University's standard
contracting positions and emits a four-flag report (🟢 Green / 🟡 Amber /
🔴 Red / 🔵 Blue) for human reviewers.

> **Brief in one sentence**: replace the manual, repetitive part of the RGC
> team's contract-review workflow with an auditable, type-aware agent that
> produces the same four-flag report a Contract Manager would draft —
> faster, repeatable, and with a paper trail.

```
poc/
├── backend/    FastAPI + Azure OpenAI agent + eval observability
├── frontend/   React + Vite + Tailwind (OpenAI-style review workspace)
├── data/       UoA Positions PDF + UoA templates + redacted examples
└── eval/       Golden labels + run_eval.py + reports/
```

---

## What's working today

The system end-to-end:

1. **Start one or more reviews** — upload a PDF/DOCX/TXT/MD or run a sample contract.
2. **Parse** — pdfplumber for text-layer pages; **GPT-4o vision OCR fallback** for scanned pages.
3. **Classify** — keyword baseline + LLM refinement against 13 contract types (MTA, CTRA, SRA, CDA, DTA, DAA, MSA, …).
4. **Compare** — clause-by-clause against the **21 UoA Preferred Contracting Positions** (Sept 2025 draft) plus the matching UoA template DOCX.
5. **Refine** — GPT-4o re-grades the deterministic flags using the full Positions JSON + template wording.
6. **Report** — executive summary + animated Red/Amber/Blue/Green tabs + per-clause rationale + escalation route.

### Eval baseline (MTA Example 1, hand-labelled gold)

| | text-only | + UoA template | + vision-fallback OCR |
|---|---|---|---|
| Accuracy | 75.0% | 81.2% | **81.25%** |
| Macro-F1 | 0.554 | 0.733 | **0.733** |
| Per-level F1 (G/A/R/B) | .00/.62/.67/.93 | .67/.67/.67/.93 | .67/.67/.67/.93 |
| Mismatches | 5 | 4 | **4** |
| Cost / review | $0.047 | $0.067 | $0.087 |
| Latency | 32 s | 39 s | 121 s |
| LLM calls | 3 | 3 | 5 |

Numbers reproduced via `uv run python eval/run_eval.py --save`.

### Runtime characteristics

- **Deterministic** — `temperature=0` on every LLM call so re-runs match.
- **Cost-attributable** — every API call (classify, review, summary, vision OCR) records tokens / latency / USD; surfaced in the UI's metrics chip.
- **Auditable** — each flag carries `clause_id`, `standard_ref` (e.g. `UoA Position #POS-08`), and a rationale that names the escalation route.
- **Multi-review UI** — reviews can run concurrently; the left sidebar behaves like a ChatGPT-style Recents list so reviewers can switch between in-flight and completed reports.

---

## Architecture

```
 ┌──────────┐  upload   ┌────────────┐  classify   ┌─────────────┐
 │  React   │──────────▶│  FastAPI   │────────────▶│  Azure AI   │
 │ frontend │◀──────────│   agent    │◀────────────│   Foundry   │
 └──────────┘  report   └────────────┘   refine    └─────────────┘
                              │
                              ├─▶ services/parser.py  + vision_ocr.py
                              ├─▶ services/classifier.py
                              ├─▶ services/comparator.py
                              ├─▶ services/templates.py
                              └─▶ data/uoa_positions.json   (21 positions, 3-tier)
```

**Why no RAG, no LangGraph, no agent framework**: the bottleneck for this
domain is encoded knowledge (21 UoA positions + 11 templates), not orchestration.
Positions JSON + matching template fits in 8K tokens — a single multimodal
prompt to GPT-4o is more accurate, more debuggable, and cheaper than chunked
retrieval. Thin home-grown orchestration (~200 LOC) lets us audit every prompt
and every $0.001 spent — the hard requirement for human-in-the-loop review.

### How the four flags map to UoA's 3-tier policy

The Positions document is structured as **Preferred → Acceptable → Required Escalation**. We map this directly:

| UoA tier | Flag | Meaning |
|---|---|---|
| Matches Preferred / matches UoA Template | 🟢 Green | Aligned, no action |
| Matches Acceptable (deviation pre-approved) | 🟡 Amber | Manager review |
| Outside Acceptable / triggers Escalation | 🔴 Red | Named approver required |
| Topic not covered by any Position | 🔵 Blue | Out-of-scope, manual decision |

**IP is special**: the Positions doc explicitly defers IP to Auckland UniServices.
Any IP clause is auto-flagged 🟡 Amber with a rationale that refers the reviewer
to the Head of IP at UniServices.

---

## 1. Backend — `backend/`

### Setup (uv)

```bash
cd backend
uv sync --extra azure-openai          # GPT-4o chat + embeddings + vision
cp .env.example .env                  # then edit .env (see below)
```

### `.env` — minimum for Azure OpenAI

```bash
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBED_DEPLOYMENT=text-embedding-3-large
LLM_BACKEND=auto
```

Alternative path (Foundry MaaS — Llama / Mistral / Phi):

```bash
FOUNDRY_ENDPOINT=https://<name>.<region>.models.ai.azure.com
FOUNDRY_API_KEY=<key>
FOUNDRY_MODEL=Mistral-large-2407
```

### Run

```bash
uv run serve                          # → http://localhost:8000
# or:  uv run uvicorn main:app --reload --port 8000
```

OpenAPI docs: <http://localhost:8000/docs>

### API surface

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/health` | Status + whether Foundry is configured |
| `POST` | `/api/upload` | Multipart file upload (PDF/DOCX/TXT/MD) |
| `POST` | `/api/classify/{document_id}` | Identify contract type |
| `POST` | `/api/review/{document_id}` | Full 4-flag review with metrics |
| `POST` | `/api/chat` | Free-form Q&A about the loaded document |
| `GET`  | `/api/samples` | List pre-loaded sample contracts |
| `POST` | `/api/samples/{id}/load` | One-shot load a sample |
| `GET`  | `/api/templates` | Diagnostic template coverage by contract type |
| `GET`  | `/api/eval/latest` | Latest eval run (for the scorecard) |

---

## 2. Frontend — `frontend/`

```bash
cd frontend
npm install
npm run dev                           # → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`.

### What you'll see

- **OpenAI-style left sidebar** — New review plus a Recents list of every review session. In-flight reviews show their current phase; completed reviews show contract type and risk count.
- **Concurrent review flow** — start another review while one is still processing, then switch between reports from the sidebar.
- **Clean report page** — once processing completes, the upload hero disappears and the page keeps only the final report.
- **Executive summary** with references used, model/cost/tokens/latency metrics, and a Markdown download.
- **Animated risk tabs** — Red / Amber / Blue / Green tabs share one source of truth (`FLAG_META`). Green renders as `Green Flags` / `Aligned with UoA Position`.
- **Expandable clause rows** — each clause exposes snippet, rationale, and standard reference.
- **Advisor rail** — right-side assistant panel with Markdown-rendered responses for follow-up Q&A about the selected document.
- **Pipeline evaluation** scorecard — latest eval metrics for the gold case.

### Stack

React 18 + TypeScript + Vite · TailwindCSS (OpenAI-style white/grey surfaces, restrained borders, four-flag colour system) · `framer-motion` for tab and panel motion · `react-markdown` for Advisor replies · `lucide-react` icons.

---

## 3. Eval — `eval/`

```bash
uv run python eval/run_eval.py --save        # → eval/reports/<timestamp>.json
uv run python eval/run_eval.py --case mta_example_1
```

### What's in the harness

- `eval/golden/mta_example_1.json` — 17 hand-labelled clauses with expected level + topic_id + reasoning notes.
- `eval/lib/metrics.py` — per-level precision/recall/F1, confusion matrix, severity off-by-one.
- `eval/run_eval.py` — runs the full pipeline against gold, prints a coloured terminal report, persists JSON to `reports/`, and overwrites `reports/latest.json` so the frontend's eval scorecard always reflects the most recent run.

### Adding a new gold case

1. Drop the source file under `data/`.
2. Create `eval/golden/<case>.json` with the same shape as `mta_example_1.json`.
3. Add it to `CASES` in `eval/run_eval.py`.

---

## 4. Data — `data/`

| File | Role |
|---|---|
| `Contracting Positions - Approvals and Escalation Protocol_Final_Sept_25.pdf` | Source policy document — informs `backend/data/uoa_positions.json` |
| `UoA-Material_Transfer_Agreement incoming-Aug 2024.docx` | UoA standard MTA template (incoming) |
| `UoA-Material_Transfer_Agreement_outgoing_Aug 2024.docx` | UoA standard MTA template (outgoing) |
| `UoA-Student Research Agreement Template (April 2018).docx` | UoA standard SRA template |
| `MTA Example 1.pdf` | Real anonymised MTA — used for eval |
| `Student Research Agreement Example 1.pdf` | Real anonymised SRA — eval-ready, gold labels TBD |

`backend/data/uoa_positions.json` is the structured form of the Positions PDF: 21 numbered topics × {Preferred, Acceptable, Escalation, Reference Documents, Applies-to, Keywords}. Plus a `POS-IP` synthetic position that auto-routes any IP clause to UniServices.

---

## 5. Model selection — what runs behind the agent

| Need | Pick | Path |
|---|---|---|
| Classification + flag refinement + summary | **GPT-4o** (or **GPT-4.1** when available in your region) | Azure OpenAI |
| Vision OCR for scanned PDF pages | **GPT-4o** (multimodal) | Azure OpenAI |
| Cheaper batch / dev iteration | **GPT-4o-mini** | Azure OpenAI |
| Open-weight option (data-residency / cost) | **Mistral Large 2407** or **Llama 3.1 70B Instruct** | Foundry MaaS |
| Embeddings (clause similarity vs templates) | **text-embedding-3-large** | Azure OpenAI |

Default and recommended starting point: **GPT-4o + text-embedding-3-large**. Swap to MaaS only if cost or data-residency forces it.

---

## 6. Responsible AI — what the brief asks for, and how we deliver it

| Brief requirement | Implementation |
|---|---|
| Confidential handling of contract information | All requests go to your Azure Foundry resource — no public LLM API. Documents stored only in-memory during a session. |
| Transparency in how issues are identified | Every flag carries `standard_ref` (e.g. `UoA Position #POS-08`) and a rationale. `references_used` field on every report names the source documents (Positions PDF + the specific UoA template). |
| Strong human oversight | The system **never approves**. Every report ends with "final decisions remain with the Research Contracts team." Red flags name the named-approver escalation route from the Positions document. |
| Auditability | Eval harness with per-level F1, cost/latency/token attribution per call, deterministic temperature=0 so a re-run matches a stored report. |

---

## 7. What's "in scope" vs. parked

In line with the brief:

- ✅ Recognise contract type
- ✅ Compare clauses to standard positions
- ✅ Highlight deviations
- ✅ Flag risks under the four-section report
- ❌ Provide legal advice (out of scope by design)
- ❌ Approve contracts or integrate with live CMS (out of scope)

---

## 8. Limitations & next steps

| Known limitation | Path forward |
|---|---|
| Multi-column PDFs (e.g. SRA Example 1) interleave text on the text-layer pages, slightly noising the per-clause attribution. Always-on vision was tried; it hurt MTA F1 by paraphrasing legal wording. | Column-aware extraction via pdfplumber bounding boxes — preserves exact wording AND fixes reading order. |
| Two MTA mismatches (POS-10 warranty disclaimer, POS-IP "retains ownership of materials") are missed by the comparator's keyword cues. | Expand keyword cues; or replace deterministic comparator with embedding-based topic matching using `text-embedding-3-large`. |
| Gold labels exist only for MTA Example 1. SRA / CDA / Collaboration eval pending. | Hand-label 1-2 more cases per type — ~30 min each. |
| Reviewer feedback loop not yet wired (no thumbs-up/down → prompt update). | Add a small `/api/feedback` endpoint that captures level corrections; replay against eval. |

---

## 9. Quick-start (TL;DR)

```bash
# Backend
cd backend && uv sync --extra azure-openai
cp .env.example .env  # fill AZURE_OPENAI_* keys
uv run serve

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Open http://localhost:5173 → click "Try MTA Example"

# Re-run eval
cd backend && uv run python ../eval/run_eval.py --save
```
