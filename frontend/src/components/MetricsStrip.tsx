import { motion } from "framer-motion";
import { Activity, Coins, Clock, Cpu, Hash } from "lucide-react";
import type { ReviewMetrics } from "../lib/api";

interface Props {
  metrics: ReviewMetrics;
}

export function MetricsStrip({ metrics }: Props) {
  const seconds = (metrics.latency_ms / 1000).toFixed(1);
  const cost = `$${metrics.total_cost_usd.toFixed(4)}`;
  const tokens = `${metrics.total_tokens.toLocaleString()}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="flex flex-wrap items-center gap-1.5"
    >
      <Pill icon={<Cpu className="size-3.5" />}>{metrics.model || "—"}</Pill>
      <Pill icon={<Activity className="size-3.5" />}>{metrics.n_calls} calls</Pill>
      <Pill icon={<Hash className="size-3.5" />}>{tokens} tokens</Pill>
      <Pill icon={<Clock className="size-3.5" />}>{seconds}s</Pill>
      <Pill icon={<Coins className="size-3.5" />}>{cost}</Pill>
    </motion.div>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-white/70 px-2.5 py-1 text-[11.5px] text-ink-700">
      <span className="text-ink-500">{icon}</span>
      {children}
    </span>
  );
}
