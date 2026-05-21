import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, PanelRightClose, Send, X } from "lucide-react";
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
          content: `Error: ${(e as Error).message}`,
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
        className="fixed bottom-0 right-0 top-0 z-50 hidden w-[52px] border-l border-ink-200 bg-[#f7f7f4]/95 text-ink-700 backdrop-blur md:flex md:items-start md:justify-center md:pt-4"
        aria-label={open ? "Close advisor rail" : "Open advisor rail"}
        title="Advisor"
      >
        <span
          className={`grid size-9 place-items-center rounded-lg transition ${
            open
              ? "bg-ink-900 text-white"
              : "bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50"
          }`}
        >
          <MessageCircle className="size-4" />
        </span>
      </button>

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-11 items-center gap-2 rounded-full border border-ink-200 bg-ink-900 px-4 text-[13px] font-medium text-white shadow-soft transition hover:bg-black active:scale-[0.98] md:hidden"
        aria-label="Open chat"
      >
        <MessageCircle className="size-4" />
        Advisor
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-ink-900/10 md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close advisor overlay"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(420px,100vw)] flex-col overflow-hidden border-l border-ink-200 bg-white shadow-soft md:right-[52px] md:z-40 md:w-[min(420px,calc(100vw-52px))]"
            >
            <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
                  <PanelRightClose className="size-4 text-ink-500" />
                  Advisor
                </div>
                <div className="text-[11px] text-ink-500">
                  {documentId ? "Document loaded" : "Ask anything"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-white hover:bg-ink-50 border border-ink-200 focus-ring"
                aria-label="Close chat"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 && (
                <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4 text-[13px] leading-relaxed text-ink-600">
                  Ask about a clause, risk, escalation route, or UoA standard
                  position. Final decisions remain with the Research Contracts team.
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

            <div className="p-3 border-t border-ink-200 bg-white">
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
                  className="flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[14px] focus-ring max-h-32"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || busy}
                  className="btn-primary size-10 !rounded-lg !p-0 focus-ring"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
            </motion.aside>
          </>
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
            ? "bg-ink-900 text-white rounded-br-sm"
            : "bg-white border border-ink-200 text-ink-800 rounded-bl-sm"
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
