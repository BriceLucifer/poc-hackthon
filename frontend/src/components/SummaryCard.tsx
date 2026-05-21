import { motion } from "framer-motion";
import { Download, BookMarked, AlertTriangle, CheckCircle2, CircleAlert, HelpCircle } from "lucide-react";
import type { ContractReview, FlagLevel } from "../lib/api";
import { FLAG_META, FLAG_ORDER } from "../lib/flags";
import { MetricsStrip } from "./MetricsStrip";
import { downloadMarkdown, reviewToMarkdown } from "../lib/exportReport";

interface Props {
  review: ContractReview;
}

export function SummaryCard({ review }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-wider text-ink-500">
            Executive summary
          </div>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-800">
            {review.summary}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() =>
              downloadMarkdown(review.filename, reviewToMarkdown(review))
            }
            className="btn-ghost focus-ring text-[12.5px] py-1.5 px-3"
            title="Download Markdown report"
          >
            <Download className="size-3.5" />
            Download report
          </button>
          <div className="text-[11px] text-ink-500">
            Generated {new Date(review.generated_at).toLocaleString()}
          </div>
        </div>
      </div>

      {review.metrics?.model && (
        <div className="mt-4">
          <MetricsStrip metrics={review.metrics} />
        </div>
      )}

      {review.references_used && review.references_used.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-[12px] text-ink-500">
          <BookMarked className="size-3.5 mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            <span className="text-ink-700 font-medium">Compared against:</span>
            {review.references_used.map((r) => (
              <span
                key={r}
                className="rounded-full bg-white border border-ink-200 px-2 py-0.5 text-[11px]"
                title={r}
              >
                {r.length > 50 ? r.slice(0, 50) + "…" : r}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="divider my-5" />

      <RiskBar review={review} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {FLAG_ORDER.map((lvl) => (
          <CountTile
            key={lvl}
            level={lvl}
            count={review.counts[lvl] ?? 0}
          />
        ))}
      </div>
    </motion.div>
  );
}

function RiskBar({ review }: { review: ContractReview }) {
  const total = Math.max(1, review.flags.length);
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-[12px] text-ink-500">
        <span>Risk distribution</span>
        <span>{review.flags.length} reviewed clauses</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-ink-100">
        {FLAG_ORDER.map((lvl) => {
          const count = review.counts[lvl] ?? 0;
          if (!count) return null;
          return (
            <div
              key={lvl}
              className={FLAG_META[lvl].dot}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${FLAG_META[lvl].label}: ${count}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function CountTile({ level, count }: { level: FlagLevel; count: number }) {
  const meta = FLAG_META[level];
  const Icon =
    level === "red"
      ? AlertTriangle
      : level === "amber"
        ? CircleAlert
        : level === "green"
          ? CheckCircle2
          : HelpCircle;
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 transition hover:bg-ink-50">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={`size-3.5 shrink-0 ${meta.color}`} />
        <span className="truncate text-[12px] font-medium text-ink-700">
          {meta.label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className={`font-display text-[24px] font-semibold ${meta.color}`}>
          {count}
        </div>
        <div className="text-[11px] text-ink-500">{meta.sub}</div>
      </div>
    </div>
  );
}
