import type { ContractReview, FlagLevel } from "./api";
import { FLAG_META, FLAG_ORDER } from "./flags";

export function reviewToMarkdown(r: ContractReview): string {
  const out: string[] = [];
  out.push(`# Research Contract Review`);
  out.push("");
  out.push(`**File:** ${r.filename}`);
  out.push(`**Contract type:** ${r.contract_type} (${Math.round(r.contract_type_confidence * 100)}% confidence)`);
  out.push(`**Generated:** ${new Date(r.generated_at).toLocaleString()}`);
  if (r.metrics?.model) {
    out.push(
      `**Model:** ${r.metrics.model} (${r.metrics.backend}) · ` +
        `${r.metrics.total_tokens.toLocaleString()} tokens · ` +
        `$${r.metrics.total_cost_usd.toFixed(4)} · ` +
        `${(r.metrics.latency_ms / 1000).toFixed(1)} s`,
    );
  }
  out.push("");
  out.push(`## Summary`);
  out.push("");
  out.push(r.summary);
  out.push("");
  out.push(`## Counts`);
  out.push("");
  out.push("| Level | Count |");
  out.push("| --- | --- |");
  for (const lvl of FLAG_ORDER) {
    out.push(`| ${FLAG_META[lvl].label} | ${r.counts[lvl] ?? 0} |`);
  }
  out.push("");

  for (const lvl of FLAG_ORDER) {
    const items = r.flags.filter((f) => f.level === lvl);
    out.push(`## ${FLAG_META[lvl].label} — ${FLAG_META[lvl].sub}`);
    out.push("");
    if (items.length === 0) {
      out.push("_No clauses in this category._");
      out.push("");
      continue;
    }
    for (const it of items) {
      out.push(
        `- **Clause ${it.clause_id} — ${it.clause_title || "Untitled"}**` +
          (it.standard_ref ? ` (${it.standard_ref})` : ""),
      );
      out.push(`  - Snippet: "${it.snippet}"`);
      out.push(`  - Rationale: ${it.rationale}`);
    }
    out.push("");
  }
  out.push("---");
  out.push(
    "_This is an automated proof-of-concept review. Final decisions remain " +
      "with the University of Auckland Research Contracts (RGC) team._",
  );
  return out.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^/.]+$/, "") + "-review.md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// silence unused warnings during TS strict mode
export type { FlagLevel };
