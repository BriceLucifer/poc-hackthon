import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, FolderOpen, Search } from "lucide-react";
import { api, type SampleEntry } from "../lib/api";

interface Props {
  onPick: (sampleId: string) => void;
  busy: boolean;
}

export function SamplePicker({ onPick, busy }: Props) {
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    api.samples().then((r) => setSamples(r.samples)).catch(() => {});
  }, []);

  const types = useMemo(
    () => ["All", ...Array.from(new Set(samples.map((s) => s.contract_type_hint))).sort()],
    [samples]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return samples.filter((sample) => {
      const matchesType = type === "All" || sample.contract_type_hint === type;
      const matchesQuery =
        !needle ||
        sample.label.toLowerCase().includes(needle) ||
        sample.contract_type_hint.toLowerCase().includes(needle);
      return matchesType && matchesQuery;
    });
  }, [query, samples, type]);

  if (samples.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="glass rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-flag-blue/10">
            <FolderOpen className="size-4 text-flag-blue" />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-ink-900">
              Sample contracts
            </div>
            <div className="text-[11.5px] text-ink-500">
              {samples.length} files from data/sample
            </div>
          </div>
        </div>

        <label className="relative block w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search samples"
            className="h-9 w-full rounded-lg border border-ink-200 bg-white/80 pl-8 pr-3 text-[13px] outline-none transition focus:border-flag-blue/40 focus:ring-2 focus:ring-flag-blue/15"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
              type === t
                ? "border-flag-blue/25 bg-flag-blue/10 text-flag-blue"
                : "border-white/80 bg-white/70 text-ink-600 hover:bg-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            disabled={busy}
            className="group flex min-h-20 items-start gap-3 rounded-lg border border-white/80 bg-white/75 p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-50 focus-ring"
            title={s.description}
          >
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-flag-blue ring-1 ring-ink-100 group-hover:bg-flag-blue/10">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-900">
                {s.label}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                <span className="rounded-full bg-ink-100 px-2 py-0.5">
                  {s.contract_type_hint}
                </span>
                <span>{formatBytes(s.size_bytes)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
