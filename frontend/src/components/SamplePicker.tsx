import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, FileText } from "lucide-react";
import { api, type SampleEntry } from "../lib/api";

interface Props {
  onPick: (sampleId: string) => void;
  busy: boolean;
}

export function SamplePicker({ onPick, busy }: Props) {
  const [samples, setSamples] = useState<SampleEntry[]>([]);

  useEffect(() => {
    api.samples().then((r) => setSamples(r.samples)).catch(() => {});
  }, []);

  if (samples.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
        <Sparkles className="size-3.5" />
        Or try a sample:
      </span>
      {samples.map((s) => (
        <button
          key={s.id}
          onClick={() => onPick(s.id)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 hover:bg-white border border-white/80 px-3 py-1 text-[12px] font-medium text-ink-700 shadow-soft transition active:scale-[0.98] disabled:opacity-50 focus-ring"
          title={s.description}
        >
          <FileText className="size-3.5 text-flag-blue" />
          {s.label}
        </button>
      ))}
    </motion.div>
  );
}
