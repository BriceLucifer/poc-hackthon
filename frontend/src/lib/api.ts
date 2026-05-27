/**
 * Thin API client for the FastAPI backend. The dev server proxies /api → :8000
 * (see vite.config.ts), so all calls below are relative.
 */

export type ContractType =
  | "Public Research Contract"
  | "Commercial Research Contract"
  | "Research Subcontract"
  | "Material Transfer Agreement"
  | "Data Transfer Agreement"
  | "Data Access Agreement"
  | "Collaboration Agreement"
  | "Confidential Disclosure Agreement"
  | "Master Services Agreement"
  | "Provision of Services Agreement"
  | "Consultancy Services Agreement"
  | "Clinical Trial Research Agreement"
  | "Student Research Agreement"
  | "Unknown";

export type FlagLevel = "green" | "amber" | "red" | "blue";

export interface FlagItem {
  level: FlagLevel;
  clause_id: string;
  clause_title: string;
  snippet: string;
  rationale: string;
  standard_ref: string | null;
}

export interface ReviewMetrics {
  n_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  total_cost_usd: number;
  backend: string;
  model: string;
}

export interface ContractReview {
  document_id: string;
  filename: string;
  contract_type: ContractType;
  contract_type_confidence: number;
  summary: string;
  flags: FlagItem[];
  counts: Record<FlagLevel, number>;
  generated_at: string;
  metrics: ReviewMetrics;
  references_used: string[];
}

export interface SampleEntry {
  id: string;
  label: string;
  description: string;
  filename: string;
  contract_type_hint: string;
  size_bytes: number;
}

export interface EvalReport {
  case: string;
  ran_at: string;
  contract_type_predicted: string;
  contract_type_expected: string;
  contract_type_correct: boolean;
  n_clauses: number;
  n_matched: number;
  n_unmatched: number;
  exact_match_accuracy: number;
  macro_f1: number;
  severity_off_by_one: number;
  per_level: Record<
    FlagLevel,
    { precision: number; recall: number; f1: number; support: number }
  >;
  confusion: Record<string, Record<string, number>>;
  rows: {
    gold_level: FlagLevel;
    pred_level: FlagLevel | null;
    topic_id: string | null;
    clause_match: string;
    ok: boolean;
  }[];
  metrics: ReviewMetrics & { wall_ms: number };
  predicted_counts: Record<FlagLevel, number>;
  summary: string;
}

export interface UploadResponse {
  document_id: string;
  filename: string;
  char_count: number;
  clause_count: number;
}

export interface ClassifyResponse {
  document_id: string;
  filename: string;
  contract_type: ContractType;
  confidence: number;
  rationale: string;
}

export interface HealthResponse {
  status: "ok";
  llm_configured: boolean;
  llm_status: string;
  supported_uploads: string[];
  max_upload_mb: number;
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function jfetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => jfetch<HealthResponse>("/health"),

  upload: async (file: File): Promise<UploadResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    return jfetch<UploadResponse>("/upload", { method: "POST", body: fd });
  },

  classify: (documentId: string) =>
    jfetch<ClassifyResponse>(`/classify/${documentId}`, { method: "POST" }),

  review: (documentId: string) =>
    jfetch<ContractReview>(`/review/${documentId}`, { method: "POST" }),

  samples: () => jfetch<{ samples: SampleEntry[] }>("/samples"),

  loadSample: (sampleId: string) =>
    jfetch<UploadResponse>(`/samples/${sampleId}/load`, { method: "POST" }),

  evalLatest: () => jfetch<EvalReport>("/eval/latest"),

  chat: (body: {
    document_id?: string;
    history: { role: "user" | "assistant"; content: string }[];
    message: string;
  }) =>
    jfetch<{ reply: string; citations: string[] }>("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
