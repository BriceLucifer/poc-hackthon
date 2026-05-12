import { motion } from "framer-motion";
import { Download, BookMarked } from "lucide-react";
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
      className="glass-strong rounded-3xl p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-wider text-ink-500">
            Executive summary
          </div>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-800">
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
                className="rounded-full bg-white/70 border border-white/70 px-2 py-0.5 text-[11px]"
                title={r}
              >
                {r.length > 50 ? r.slice(0, 50) + "…" : r}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="divider my-6" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

function CountTile({ level, count }: { level: FlagLevel; count: number }) {
  const meta = FLAG_META[level];
  return (
    <div className="rounded-2xl bg-white/70 border border-white/70 p-4 hover:bg-white transition">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${meta.dot}`} />
        <span className="text-[12px] font-medium text-ink-700">{meta.label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className={`font-display text-[28px] font-semibold ${meta.color}`}>
          {count}
        </div>
        <div className="text-[11px] text-ink-500">{meta.sub}</div>
      </div>
    </div>
  );
}
