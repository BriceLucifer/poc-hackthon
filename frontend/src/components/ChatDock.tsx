import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

  async function send(nextMessage?: string) {
    const message = (nextMessage ?? input).trim();
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
              className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(460px,100vw)] flex-col overflow-hidden border-l border-ink-200 bg-white shadow-soft md:right-[52px] md:z-40 md:w-[min(460px,calc(100vw-52px))]"
            >
            <div className="flex h-16 items-center justify-between border-b border-ink-200 px-4">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink-900">
                  <Sparkles className="size-4 text-ink-500" />
                  Advisor
                </div>
                <div className="mt-0.5 text-[12px] text-ink-500">
                  {documentId ? "Document loaded" : "Ask anything"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-full text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 focus-ring"
                aria-label="Close chat"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
              {history.length === 0 && (
                <EmptyState documentLoaded={Boolean(documentId)} onPrompt={send} />
              )}
              <div className="space-y-5">
                {history.map((t, i) => (
                  <Bubble key={i} role={t.role}>
                    {t.content}
                  </Bubble>
                ))}
                {busy && (
                  <Bubble role="assistant">
                    <span className="inline-flex gap-1 px-1 py-2">
                      <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
                    </span>
                  </Bubble>
                )}
              </div>
            </div>

            <div className="border-t border-ink-100 bg-white px-4 py-3">
              <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-white p-2 shadow-[0_2px_12px_rgba(15,17,21,0.06)] transition focus-within:border-ink-300 focus-within:shadow-[0_4px_20px_rgba(15,17,21,0.08)]">
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
                  className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[14px] leading-5 text-ink-900 outline-none placeholder:text-ink-400"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || busy}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-white transition hover:bg-black disabled:bg-ink-200 disabled:text-ink-400 focus-ring"
                  aria-label="Send"
                >
                  <Send className="size-4" strokeWidth={2.2} />
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

function EmptyState({
  documentLoaded,
  onPrompt,
}: {
  documentLoaded: boolean;
  onPrompt: (message: string) => void;
}) {
  const prompts = documentLoaded
    ? [
        "Summarise the main risks",
        "Which clauses need escalation?",
        "Compare this with UoA positions",
      ]
    : ["What can I ask?", "Explain UoA positions", "How should I read a clause?"];

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="grid size-11 place-items-center rounded-full bg-ink-900 text-white">
        <Sparkles className="size-5" />
      </div>
      <div className="mt-4 text-[18px] font-semibold tracking-tight text-ink-900">
        Ask about this contract
      </div>
      <div className="mt-1 text-[13px] text-ink-500">
        {documentLoaded ? "Document context is attached" : "Start with a review or a general question"}
      </div>
      <div className="mt-5 flex max-w-[340px] flex-wrap justify-center gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12.5px] text-ink-700 transition hover:bg-ink-50 focus-ring"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
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
        className={`max-w-[86%] whitespace-pre-wrap text-[14px] leading-relaxed ${
          isUser
            ? "rounded-2xl bg-ink-100 px-3.5 py-2 text-ink-900"
            : "px-1 py-1 text-ink-900"
        }`}
      >
        {!isUser && typeof children === "string" ? (
          <div className="advisor-markdown">
            <ReactMarkdown>{children}</ReactMarkdown>
          </div>
        ) : (
          children
        )}
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
