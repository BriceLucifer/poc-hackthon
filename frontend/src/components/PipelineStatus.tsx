import { motion } from "framer-motion";
import { CheckCircle2, FileSearch, FileUp, Scale, Timer } from "lucide-react";

type Phase = "idle" | "uploading" | "classifying" | "reviewing" | "done" | "error";

interface Props {
  phase: Phase;
  filename?: string | null;
}

const STEPS = [
  { phase: "uploading", label: "Parse", icon: FileUp },
  { phase: "classifying", label: "Type", icon: FileSearch },
  { phase: "reviewing", label: "Review", icon: Scale },
  { phase: "done", label: "Report", icon: CheckCircle2 },
] as const;

const PROGRESS: Record<Phase, number> = {
  idle: 0,
  uploading: 18,
  classifying: 45,
  reviewing: 76,
  done: 100,
  error: 100,
};

export function PipelineStatus({ phase, filename }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.phase === phase);
  const resolvedIndex = phase === "done" ? STEPS.length - 1 : Math.max(activeIndex, 0);
  const isBusy = phase === "uploading" || phase === "classifying" || phase === "reviewing";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="glass rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider text-ink-500">
            <Timer className="size-3.5" />
            Processing
          </div>
          <div className="mt-1 truncate text-[14px] font-medium text-ink-900">
            {statusText(phase, filename)}
          </div>
        </div>
        {isBusy && (
          <div className="relative size-8 shrink-0">
            <div className="absolute inset-0 rounded-full border border-ink-200" />
            <div className="absolute inset-0 rounded-full border-2 border-flag-blue border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-ink-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${PROGRESS[phase]}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full ${phase === "error" ? "bg-flag-red" : "bg-gradient-to-r from-flag-blue via-flag-green to-flag-amber"}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const complete = phase === "done" || index < resolvedIndex;
          const active = index === resolvedIndex && phase !== "done" && phase !== "error";
          return (
            <div
              key={step.phase}
              className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] ring-1 ${
                complete
                  ? "bg-flag-green/10 text-flag-green ring-flag-green/20"
                  : active
                    ? "bg-flag-blue/10 text-flag-blue ring-flag-blue/20"
                    : "bg-white/70 text-ink-500 ring-white/80"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

function statusText(phase: Phase, filename?: string | null) {
  const name = filename ? ` ${filename}` : "";
  if (phase === "uploading") return `Extracting text from${name || " document"}`;
  if (phase === "classifying") return "Identifying contract type";
  if (phase === "reviewing") return "Comparing clauses against UoA positions";
  if (phase === "done") return "Report ready";
  if (phase === "error") return "Processing stopped";
  return "Ready";
}
