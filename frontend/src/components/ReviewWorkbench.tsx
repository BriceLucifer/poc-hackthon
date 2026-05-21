import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from "lucide-react";
import type { ContractReview, FlagItem } from "../lib/api";
import { FLAG_META, FLAG_ORDER } from "../lib/flags";
import { FlagSection } from "./FlagSection";
import { SummaryCard } from "./SummaryCard";

interface Props {
  review: ContractReview;
}

export function ReviewWorkbench({ review }: Props) {
  const posture = riskPosture(review);
  const PostureIcon = posture.icon;
  const queue = review.flags
    .filter((flag) => flag.level === "red" || flag.level === "amber")
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <SummaryCard review={review} />
        <aside className="glass rounded-xl p-5 lg:sticky lg:top-20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-ink-500">
                Review posture
              </div>
              <div className="mt-1 flex items-center gap-2">
                <PostureIcon className={`size-4 ${posture.color}`} />
                <span className="font-display text-[18px] font-semibold tracking-tight">
                  {posture.label}
                </span>
              </div>
            </div>
            <span className={`pill ${posture.chip}`}>{posture.badge}</span>
          </div>

          <div className="mt-4 rounded-lg border border-white/80 bg-white/70 p-3">
            <div className="text-[11px] uppercase tracking-wider text-ink-500">
              Contract
            </div>
            <div className="mt-1 flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-flag-blue" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink-900">
                  {review.filename}
                </div>
                <div className="text-[12px] text-ink-500">
                  {review.contract_type} · {review.flags.length} clauses
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] uppercase tracking-wider text-ink-500">
                Reviewer queue
              </div>
              <span className="text-[12px] text-ink-500">
                {queue.length || "clear"}
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="mt-3 rounded-lg border border-flag-green/20 bg-flag-green/10 p-3 text-[13px] leading-relaxed text-ink-700">
                No red or amber items. Review blue items only if the matter is
                material to the deal.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {queue.map((flag, index) => (
                  <QueueItem key={`${flag.level}-${flag.clause_id}-${index}`} flag={flag} />
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {FLAG_ORDER.map((level) => (
          <FlagSection
            key={level}
            level={level}
            items={review.flags.filter((flag) => flag.level === level)}
          />
        ))}
      </div>
    </div>
  );
}

function QueueItem({ flag }: { flag: FlagItem }) {
  const meta = FLAG_META[flag.level];
  return (
    <li>
      <a
        href={`#flag-${flag.level}`}
        className="group block rounded-lg border border-white/80 bg-white/75 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft focus-ring"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
            <span className="truncate text-[12px] font-mono text-ink-500">
              Clause {flag.clause_id}
            </span>
          </div>
          <ArrowRight className="size-3.5 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-ink-700" />
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-ink-900">
          {flag.clause_title || "Untitled clause"}
        </div>
        <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-500">
          {flag.rationale}
        </div>
      </a>
    </li>
  );
}

function riskPosture(review: ContractReview): {
  label: string;
  badge: string;
  color: string;
  chip: string;
  icon: typeof AlertTriangle;
} {
  const red = review.counts.red ?? 0;
  const amber = review.counts.amber ?? 0;
  if (red > 0) {
    return {
      label: "Escalation required",
      badge: `${red} red`,
      color: "text-flag-red",
      chip: FLAG_META.red.chip,
      icon: ShieldAlert,
    };
  }
  if (amber > 0) {
    return {
      label: "Manager review",
      badge: `${amber} amber`,
      color: "text-flag-amber",
      chip: FLAG_META.amber.chip,
      icon: AlertTriangle,
    };
  }
  return {
    label: "Mostly aligned",
    badge: "low risk",
    color: "text-flag-green",
    chip: FLAG_META.green.chip,
    icon: CheckCircle2,
  };
}
