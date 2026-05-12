import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FlaskConical, ShieldCheck, ShieldAlert } from "lucide-react";
import { api, type EvalReport, type FlagLevel } from "../lib/api";
import { FLAG_META, FLAG_ORDER } from "../lib/flags";

export function EvalScorecard() {
  const [data, setData] = useState<EvalReport | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.evalLatest().then(setData).catch((e) => setErr((e as Error).message));
  }, []);

  if (err || !data) return null;

  const acc = data.exact_match_accuracy;
  const f1 = data.macro_f1;
  const accColor =
    acc >= 0.85 ? "text-flag-green" : acc >= 0.7 ? "text-flag-amber" : "text-flag-red";
  const f1Color =
    f1 >= 0.7 ? "text-flag-green" : f1 >= 0.55 ? "text-flag-amber" : "text-flag-red";

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass rounded-3xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-5 sm:p-6 flex items-center gap-3 focus-ring"
      >
        <div className="size-9 shrink-0 rounded-xl bg-flag-blue/10 grid place-items-center">
          <FlaskConical className="size-5 text-flag-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[16px] font-semibold tracking-tight">
              Pipeline evaluation
            </span>
            <span className="pill bg-ink-100 text-ink-700 border border-ink-200">
              {data.case}
            </span>
            <span
              className={`pill border ${
                data.contract_type_correct
                  ? "bg-flag-green/10 text-flag-green border-flag-green/20"
                  : "bg-flag-red/10 text-flag-red border-flag-red/20"
              }`}
            >
              {data.contract_type_correct ? (
                <ShieldCheck className="size-3" />
              ) : (
                <ShieldAlert className="size-3" />
              )}
              {data.contract_type_correct ? "type ✓" : "type ✗"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-ink-500">
            <span>
              Accuracy{" "}
              <span className={`font-mono font-medium ${accColor}`}>
                {(acc * 100).toFixed(1)}%
              </span>
            </span>
            <span>
              Macro-F1{" "}
              <span className={`font-mono font-medium ${f1Color}`}>{f1.toFixed(3)}</span>
            </span>
            <span>
              {data.n_clauses} clauses · {data.severity_off_by_one} off-by-one
            </span>
          </div>
        </div>
        <ChevronDown
          className={`size-4 text-ink-500 transition-transform ${
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
            <div className="px-5 sm:px-6 pb-6 space-y-4">
              {/* Per-level table */}
              <div className="rounded-2xl bg-white/80 border border-white/80 overflow-hidden">
                <div className="px-4 py-2.5 text-[12px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  Per-level scores
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-ink-500">
                      <th className="px-4 py-2 font-medium">level</th>
                      <th className="px-2 py-2 font-medium text-right">precision</th>
                      <th className="px-2 py-2 font-medium text-right">recall</th>
                      <th className="px-2 py-2 font-medium text-right">F1</th>
                      <th className="px-4 py-2 font-medium text-right">support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FLAG_ORDER.map((lvl) => {
                      const s = data.per_level[lvl];
                      if (!s) return null;
                      const meta = FLAG_META[lvl];
                      return (
                        <tr key={lvl} className="border-t border-ink-100">
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-2">
                              <span className={`size-1.5 rounded-full ${meta.dot}`} />
                              {lvl}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {s.precision.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {s.recall.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono">
                            {s.f1.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right text-ink-500">
                            {s.support}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resource usage */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="LLM calls" value={data.metrics.n_calls.toString()} />
                <Stat
                  label="Tokens"
                  value={data.metrics.total_tokens.toLocaleString()}
                />
                <Stat
                  label="Latency"
                  value={`${(data.metrics.latency_ms / 1000).toFixed(1)} s`}
                />
                <Stat
                  label="Est. cost"
                  value={`$${data.metrics.total_cost_usd.toFixed(4)}`}
                />
              </div>

              {/* Mismatches */}
              {(() => {
                const mm = data.rows.filter((r) => !r.ok);
                if (mm.length === 0) return null;
                return (
                  <div className="rounded-2xl bg-white/80 border border-white/80 p-4">
                    <div className="text-[12px] uppercase tracking-wider text-ink-500 mb-2">
                      Mismatches ({mm.length})
                    </div>
                    <ul className="space-y-1.5 text-[12.5px] font-mono">
                      {mm.map((r, i) => (
                        <li key={i} className="flex items-baseline gap-2">
                          <Lvl level={r.gold_level} />
                          <span className="text-ink-400">→</span>
                          <Lvl level={r.pred_level} />
                          <span className="text-ink-500 truncate">
                            [{r.topic_id || "—"}] {r.clause_match}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="text-[11px] text-ink-500">
                Last run {new Date(data.ran_at).toLocaleString()} ·{" "}
                <code className="text-ink-700">uv run python eval/run_eval.py --save</code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 border border-white/80 p-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="font-display text-[20px] font-semibold tracking-tight mt-0.5">
        {value}
      </div>
    </div>
  );
}

function Lvl({ level }: { level: FlagLevel | null }) {
  if (!level) {
    return <span className="text-ink-400 w-10 inline-block">none</span>;
  }
  const meta = FLAG_META[level];
  return (
    <span className={`inline-flex items-center gap-1 w-12 ${meta.color}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {level}
    </span>
  );
}
