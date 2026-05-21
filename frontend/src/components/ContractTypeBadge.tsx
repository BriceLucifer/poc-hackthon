import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import type { ContractType } from "../lib/api";

interface Props {
  type: ContractType;
  confidence: number;
  rationale?: string;
}

export function ContractTypeBadge({ type, confidence, rationale }: Props) {
  const pct = Math.round(confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass rounded-lg p-5 flex items-start gap-4"
    >
      <div className="size-9 shrink-0 rounded-md bg-ink-100 grid place-items-center">
        <FileSearch className="size-5 text-ink-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] uppercase tracking-wider text-ink-500">
          Identified contract type
        </div>
        <div className="mt-1 flex items-center flex-wrap gap-2">
          <span className="font-display text-[19px] font-semibold tracking-tight">
            {type}
          </span>
          <span className="pill bg-ink-100 text-ink-700 border border-ink-200">
            {pct}% confidence
          </span>
        </div>
        {rationale && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500 line-clamp-2">
            {rationale}
          </p>
        )}
      </div>
      <div className="hidden sm:block w-32 shrink-0">
        <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full bg-ink-900"
          />
        </div>
      </div>
    </motion.div>
  );
}
