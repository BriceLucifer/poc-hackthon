import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative pt-16 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-white/70 px-3 py-1 text-[12px] text-ink-700 backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-flag-blue" />
          Powered by Azure&nbsp;AI&nbsp;Foundry · Built for the RGC Team
        </div>

        <h1 className="mt-5 font-display text-[44px] leading-[1.05] tracking-[-0.02em] font-semibold sm:text-[56px]">
          Review research contracts{" "}
          <span className="bg-gradient-to-r from-flag-blue to-[#5e5ce6] bg-clip-text text-transparent">
            in seconds.
          </span>
        </h1>

        <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-ink-500 max-w-2xl mx-auto">
          Upload a draft contract. The adviser identifies the contract type,
          compares each clause to UoA standard positions, and surfaces the
          issues your team needs to see — all under human oversight.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4 text-[12px] text-ink-500">
          <Legend dot="bg-flag-green" label="Aligned" />
          <Legend dot="bg-flag-amber" label="Review" />
          <Legend dot="bg-flag-red" label="Conflict" />
          <Legend dot="bg-flag-blue" label="Not covered" />
        </div>
      </motion.div>
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
