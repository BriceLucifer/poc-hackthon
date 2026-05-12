import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  documentId: string | null;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export function ChatDock({ documentId }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history, open]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await api.chat({
        document_id: documentId ?? undefined,
        history,
        message,
      });
      setHistory((h) => [...h, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: `⚠️ ${(e as Error).message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 size-12 rounded-full bg-gradient-to-br from-flag-blue to-[#5e5ce6] text-white grid place-items-center shadow-glass hover:scale-105 active:scale-95 transition"
        aria-label="Open chat"
      >
        <MessageCircle className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-6 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(560px,70vh)] glass-strong rounded-3xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold tracking-tight">
                  Adviser
                </div>
                <div className="text-[11px] text-ink-500">
                  {documentId ? "Document loaded" : "Ask anything"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded-full bg-white/80 hover:bg-white border border-ink-200 focus-ring"
                aria-label="Close chat"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 && (
                <div className="text-center text-[13px] text-ink-500 mt-6 px-4">
                  Ask the adviser about a clause, the contract type, or UoA
                  standard positions. The adviser does not provide legal advice.
                </div>
              )}
              {history.map((t, i) => (
                <Bubble key={i} role={t.role}>
                  {t.content}
                </Bubble>
              ))}
              {busy && (
                <Bubble role="assistant">
                  <span className="inline-flex gap-1">
                    <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                  </span>
                </Bubble>
              )}
            </div>

            <div className="p-3 border-t border-ink-100 bg-white/50">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask about a clause, risk, or standard…"
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-ink-200 bg-white px-4 py-2.5 text-[14px] focus-ring max-h-32"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || busy}
                  className="btn-primary size-10 !p-0 focus-ring"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-flag-blue text-white rounded-br-md"
            : "bg-white border border-ink-200 text-ink-800 rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
      className="size-1.5 rounded-full bg-ink-400"
    />
  );
}
