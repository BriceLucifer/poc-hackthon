import { Sparkles, ShieldCheck } from "lucide-react";

interface Props {
  llmReady: boolean;
  llmStatus: string;
}

export function Header({ llmReady, llmStatus }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-md bg-ink-900 grid place-items-center shadow-soft">
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
                ? "bg-white text-ink-700 border border-ink-200"
                : "bg-white text-flag-red border border-ink-200"
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
          <div className="pill bg-white border border-ink-200 text-ink-700">
            <ShieldCheck className="size-3.5" />
            Human-in-the-loop
          </div>
        </div>
      </div>
    </header>
  );
}
