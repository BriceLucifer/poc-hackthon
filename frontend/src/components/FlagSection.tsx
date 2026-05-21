import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, HelpCircle, Quote } from "lucide-react";
import { useState } from "react";
import type { FlagItem, FlagLevel } from "../lib/api";
import { FLAG_META } from "../lib/flags";

interface Props {
  level: FlagLevel;
  items: FlagItem[];
}

export function FlagSection({ level, items }: Props) {
  const meta = FLAG_META[level];
  const empty = items.length === 0;

  return (
    <section
      id={`flag-${level}`}
      className="overflow-hidden scroll-mt-24 rounded-xl border border-ink-200 bg-white shadow-soft"
    >
      <header className="flex items-center justify-between border-b border-ink-200 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-ink-50">
            <SectionIcon level={level} className={`size-4 ${meta.color}`} />
          </div>
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-tight">
              {meta.label}
            </h2>
            <p className="text-[12px] text-ink-500">{meta.sub}</p>
          </div>
        </div>
        <span className={`pill ${meta.chip}`}>
          {items.length} {items.length === 1 ? "clause" : "clauses"}
        </span>
      </header>

      {empty ? (
        <div className="px-5 pb-5 pt-4 text-[13px] text-ink-500">
          No clauses in this category.
        </div>
      ) : (
        <ul className="space-y-2 p-3">
          {items.map((it, i) => (
            <FlagRow key={`${it.clause_id}-${i}`} item={it} level={level} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FlagRow({ item, level }: { item: FlagItem; level: FlagLevel }) {
  const [open, setOpen] = useState(false);
  const meta = FLAG_META[level];

  return (
    <motion.li
      layout
      className="rounded-lg border border-ink-200 bg-white transition hover:bg-ink-50"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-lg p-4 text-left focus-ring"
      >
        <span className={`mt-1 h-10 w-1 rounded-full ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[12px] font-mono text-ink-500">
              Clause {item.clause_id}
            </span>
            <span className="min-w-0 flex-1 text-[14.5px] font-medium text-ink-900">
              {item.clause_title || "Untitled clause"}
            </span>
            {item.standard_ref && (
              <span className={`pill ${meta.chip}`}>{item.standard_ref}</span>
            )}
          </div>
          <p className="mt-1.5 text-[13.5px] text-ink-700 line-clamp-2">
            {item.snippet}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-ink-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 pt-1">
              <div className="rounded-lg border border-ink-100 bg-ink-50 p-4">
                <div className="flex items-start gap-2 text-[12px] text-ink-500">
                  <Quote className="size-3.5 mt-0.5" />
                  <span className="font-medium uppercase tracking-wider">
                    Snippet
                  </span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-800 italic">
                  “{item.snippet}”
                </p>
              </div>
              <div className="mt-3">
                <div className="text-[12px] uppercase tracking-wider text-ink-500">
                  Rationale
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-800">
                  {item.rationale}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function SectionIcon({
  level,
  className,
}: {
  level: FlagLevel;
  className: string;
}) {
  if (level === "red") return <AlertTriangle className={className} />;
  if (level === "amber") return <CircleAlert className={className} />;
  if (level === "green") return <CheckCircle2 className={className} />;
  return <HelpCircle className={className} />;
}
