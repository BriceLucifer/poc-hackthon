import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import type { ContractReview, FlagLevel } from "../lib/api";
import { FLAG_META, FLAG_ORDER } from "../lib/flags";
import { FlagSection } from "./FlagSection";
import { SummaryCard } from "./SummaryCard";

interface Props {
  review: ContractReview;
}

export function ReviewWorkbench({ review }: Props) {
  const posture = riskPosture(review);
  const PostureIcon = posture.icon;
  const [activeLevel, setActiveLevel] = useState<FlagLevel>(() =>
    preferredLevel(review),
  );

  useEffect(() => {
    setActiveLevel(preferredLevel(review));
  }, [review.document_id, review.generated_at]);

  const activeItems = review.flags.filter((flag) => flag.level === activeLevel);

  return (
    <div className="space-y-4 pt-2">
      <SummaryCard review={review} />

      <section className="rounded-xl border border-ink-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
          <div className="flex items-center gap-2">
            <PostureIcon className={`size-4 ${posture.color}`} />
            <div className="text-[13px] font-semibold text-ink-900">
              {posture.label}
            </div>
          </div>
          <span className={`pill ${posture.chip}`}>{posture.badge}</span>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          {FLAG_ORDER.map((level) => (
            <RiskTab
              key={level}
              level={level}
              count={review.counts[level] ?? 0}
              active={level === activeLevel}
              onClick={() => setActiveLevel(level)}
            />
          ))}
        </div>
      </section>

      <motion.div
        key={`${review.document_id}-${review.generated_at}-${activeLevel}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        <FlagSection level={activeLevel} items={activeItems} />
      </motion.div>
    </div>
  );
}

function RiskTab({
  level,
  count,
  active,
  onClick,
}: {
  level: FlagLevel;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
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
    <button
      onClick={onClick}
      className={`relative flex min-h-16 items-center justify-between overflow-hidden rounded-lg border px-3 py-2.5 text-left transition focus-ring ${
        active
          ? "border-ink-900 text-white"
          : "border-ink-200 bg-white text-ink-800 hover:bg-ink-50"
      }`}
    >
      {active && (
        <motion.span
          layoutId="review-risk-tab-active"
          className="absolute inset-0 rounded-lg bg-ink-900"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      <span className="relative flex min-w-0 items-center gap-2">
        <Icon className={`size-4 shrink-0 ${active ? "text-white" : meta.color}`} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">
            {meta.label}
          </span>
          <span className={`block truncate text-[11px] ${active ? "text-white/65" : "text-ink-500"}`}>
            {meta.sub}
          </span>
        </span>
      </span>
      <span
        className={`relative ml-3 rounded-full px-2 py-0.5 text-[12px] font-medium ${
          active ? "bg-white/14 text-white" : "bg-ink-100 text-ink-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function preferredLevel(review: ContractReview): FlagLevel {
  for (const level of FLAG_ORDER) {
    if ((review.counts[level] ?? 0) > 0) {
      return level;
    }
  }
  return "green";
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
