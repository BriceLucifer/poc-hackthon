import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { UploadCard } from "./components/UploadCard";
import { SamplePicker } from "./components/SamplePicker";
import { ContractTypeBadge } from "./components/ContractTypeBadge";
import { EvalScorecard } from "./components/EvalScorecard";
import { ChatDock } from "./components/ChatDock";
import { AdvisorSidebar } from "./components/AdvisorSidebar";
import { Footer } from "./components/Footer";
import { PipelineStatus } from "./components/PipelineStatus";
import { ReviewWorkbench } from "./components/ReviewWorkbench";
import { api, type ClassifyResponse, type ContractReview } from "./lib/api";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "idle" | "uploading" | "classifying" | "reviewing" | "done" | "error";
const REVIEW_SESSIONS_KEY = "research-contract-review-sessions";
type ReviewPhase = Exclude<Phase, "idle">;

interface ReviewSession {
  id: string;
  filename: string;
  documentId: string | null;
  classification: ClassifyResponse | null;
  review: ContractReview | null;
  createdAt: string;
  phase: ReviewPhase;
  error: string | null;
}

export default function App() {
  const [llmReady, setLlmReady] = useState(false);
  const [llmStatus, setLlmStatus] = useState("Checking model connection...");
  const [advisorCollapsed, setAdvisorCollapsed] = useState(false);
  const [reviewSessions, setReviewSessions] = useState<ReviewSession[]>(loadStoredReviewSessions);
  const [activeReviewSessionId, setActiveReviewSessionId] = useState<string | null>(
    () => loadStoredReviewSessions()[0]?.id ?? null,
  );

  useEffect(() => {
    api.health()
      .then((h) => {
        setLlmReady(h.llm_configured);
        setLlmStatus(h.llm_status);
      })
      .catch(() => {
        setLlmReady(false);
        setLlmStatus("Backend health check failed.");
      });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      REVIEW_SESSIONS_KEY,
      JSON.stringify(
        reviewSessions
          .filter((session) => session.phase === "done" && session.review)
          .slice(0, 20),
      ),
    );
  }, [reviewSessions]);

  async function runPipeline(file: File) {
    const sessionId = createReviewSession(file.name);

    try {
      const up = await api.upload(file);
      updateReviewSession(sessionId, {
        documentId: up.document_id,
        filename: up.filename,
        phase: "classifying",
      });
      await runPostUpload(sessionId, up.document_id, up.filename);
    } catch (e) {
      markReviewError(sessionId, e);
    }
  }

  async function runSample(sampleId: string) {
    const sessionId = createReviewSession("Sample contract");

    try {
      const up = await api.loadSample(sampleId);
      updateReviewSession(sessionId, {
        documentId: up.document_id,
        filename: up.filename,
        phase: "classifying",
      });
      await runPostUpload(sessionId, up.document_id, up.filename);
    } catch (e) {
      markReviewError(sessionId, e);
    }
  }

  async function runPostUpload(sessionId: string, documentId: string, loadedFilename: string) {
    const cls = await api.classify(documentId);
    updateReviewSession(sessionId, {
      classification: cls,
      filename: loadedFilename || cls.filename,
      phase: "reviewing",
    });

    const rep = await api.review(documentId);
    updateReviewSession(sessionId, {
      filename: loadedFilename || rep.filename,
      documentId,
      review: rep,
      createdAt: rep.generated_at,
      phase: "done",
    });
  }

  function reset() {
    setActiveReviewSessionId(null);
  }

  function selectReviewSession(sessionId: string) {
    const session = reviewSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveReviewSessionId(session.id);
  }

  function createReviewSession(filename: string) {
    const sessionId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: ReviewSession = {
      id: sessionId,
      filename,
      documentId: null,
      classification: null,
      review: null,
      createdAt: new Date().toISOString(),
      phase: "uploading",
      error: null,
    };
    setReviewSessions((sessions) => [session, ...sessions].slice(0, 20));
    setActiveReviewSessionId(sessionId);
    return sessionId;
  }

  function updateReviewSession(sessionId: string, patch: Partial<ReviewSession>) {
    setReviewSessions((sessions) =>
      sessions.map((session) => {
        if (session.id !== sessionId) return session;
        const next = { ...session, ...patch };
        return "error" in patch ? next : { ...next, error: null };
      }),
    );
  }

  function markReviewError(sessionId: string, error: unknown) {
    updateReviewSession(sessionId, {
      phase: "error",
      error: (error as Error).message,
    });
  }

  const activeSession = activeReviewSessionId
    ? reviewSessions.find((session) => session.id === activeReviewSessionId) ?? null
    : null;
  const activePhase: Phase = activeSession?.phase ?? "idle";
  const activeBusy = Boolean(activeSession && isBusyPhase(activeSession.phase));

  return (
    <div className="app-bg min-h-full">
      <AdvisorSidebar
        collapsed={advisorCollapsed}
        onToggle={() => setAdvisorCollapsed((collapsed) => !collapsed)}
        onNewReview={reset}
        reviews={reviewSessions.map((session) => ({
          id: session.id,
          filename: session.filename,
          contractType:
            session.review?.contract_type ?? session.classification?.contract_type ?? null,
          counts: session.review?.counts ?? null,
          createdAt: session.createdAt,
          phase: session.phase,
          error: session.error,
        }))}
        activeReviewId={activeReviewSessionId}
        onSelectReview={selectReviewSession}
      />

      <div
        className={`min-h-full transition-[padding] duration-200 ease-out md:pr-[52px] ${
          advisorCollapsed ? "lg:pl-[72px]" : "lg:pl-72"
        }`}
      >
        <Header llmReady={llmReady} llmStatus={llmStatus} />

        <main className="mx-auto max-w-6xl px-6 pb-24">
          <Hero />

          <div className="mt-2 grid gap-6">
            <UploadCard
              onFile={runPipeline}
              busy={false}
              filename={null}
            />

            {!activeSession && (
              <SamplePicker onPick={runSample} busy={false} />
            )}

            <EvalScorecard />

            <AnimatePresence>
              {activeBusy && (
                <PipelineStatus phase={activePhase} filename={activeSession?.filename} />
              )}
            </AnimatePresence>

            {activeSession?.error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-4 border-flag-red/30 ring-1 ring-flag-red/20"
              >
                <div className="text-[13px] font-medium text-flag-red">Error</div>
                <div className="text-[13px] text-ink-700 mt-1">{activeSession.error}</div>
              </motion.div>
            )}

            {activeSession?.classification && (
              <ContractTypeBadge
                type={activeSession.classification.contract_type}
                confidence={activeSession.classification.confidence}
                rationale={activeSession.classification.rationale}
              />
            )}

            {activeSession?.review && (
              <ReviewWorkbench review={activeSession.review} />
            )}
          </div>
        </main>

        <Footer />
      </div>
      <ChatDock documentId={activeSession?.documentId ?? null} />
    </div>
  );
}

function isBusyPhase(phase: ReviewPhase) {
  return phase === "uploading" || phase === "classifying" || phase === "reviewing";
}

function loadStoredReviewSessions(): ReviewSession[] {
  try {
    const raw = window.localStorage.getItem(REVIEW_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReviewSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((session) => session?.review)
      .map((session) => ({
        ...session,
        phase: "done" as const,
        error: null,
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}
