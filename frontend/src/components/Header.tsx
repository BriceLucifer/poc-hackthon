import { Sparkles, ShieldCheck } from "lucide-react";

interface Props {
  llmReady: boolean;
  llmStatus: string;
}

export function Header({ llmReady, llmStatus }: Props) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/60 border-b border-white/60">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-gradient-to-br from-flag-blue to-[#34c759] grid place-items-center shadow-soft">
            <Sparkles className="size-4 text-white" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">
              Research Contract Adviser
            </div>
            <div className="text-[11px] text-ink-500 -mt-0.5">
              University of Auckland · POC
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`pill ${
              llmReady
                ? "bg-flag-green/10 text-flag-green border border-flag-green/20"
                : "bg-flag-red/10 text-flag-red border border-flag-red/20"
            }`}
            title={llmStatus}
          >
            <span
              className={`size-1.5 rounded-full ${
                llmReady ? "bg-flag-green" : "bg-flag-red"
              }`}
            />
            {llmReady ? "Foundry connected" : "Foundry issue"}
          </div>
          <div className="pill bg-white/70 border border-white/70 text-ink-700">
            <ShieldCheck className="size-3.5" />
            Human-in-the-loop
          </div>
        </div>
      </div>
    </header>
  );
}
