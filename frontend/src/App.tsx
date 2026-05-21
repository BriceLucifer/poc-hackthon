import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { UploadCard } from "./components/UploadCard";
import { SamplePicker } from "./components/SamplePicker";
import { ContractTypeBadge } from "./components/ContractTypeBadge";
import { EvalScorecard } from "./components/EvalScorecard";
import { ChatDock } from "./components/ChatDock";
import { Footer } from "./components/Footer";
import { PipelineStatus } from "./components/PipelineStatus";
import { ReviewWorkbench } from "./components/ReviewWorkbench";
import { api, type ClassifyResponse, type ContractReview } from "./lib/api";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "idle" | "uploading" | "classifying" | "reviewing" | "done" | "error";

export default function App() {
  const [llmReady, setLlmReady] = useState(false);
  const [llmStatus, setLlmStatus] = useState("Checking model connection...");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const [filename, setFilename] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassifyResponse | null>(null);
  const [review, setReview] = useState<ContractReview | null>(null);

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

  async function runPipeline(file: File) {
    setError(null);
    setReview(null);
    setClassification(null);
    setFilename(file.name);

    try {
      setPhase("uploading");
      const up = await api.upload(file);
      await runPostUpload(up.document_id);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function runSample(sampleId: string) {
    setError(null);
    setReview(null);
    setClassification(null);

    try {
      setPhase("uploading");
      const up = await api.loadSample(sampleId);
      setFilename(up.filename);
      await runPostUpload(up.document_id);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function runPostUpload(documentId: string) {
    setDocumentId(documentId);

    setPhase("classifying");
    const cls = await api.classify(documentId);
    setClassification(cls);

    setPhase("reviewing");
    const rep = await api.review(documentId);
    setReview(rep);
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setError(null);
    setFilename(null);
    setDocumentId(null);
    setClassification(null);
    setReview(null);
  }

  const busy =
    phase === "uploading" || phase === "classifying" || phase === "reviewing";

  return (
    <div className="app-bg min-h-full">
      <Header llmReady={llmReady} llmStatus={llmStatus} />

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <Hero />

        <div className="mt-2 grid gap-6">
          <UploadCard
            onFile={runPipeline}
            busy={busy}
            filename={filename}
            onClear={review || error ? reset : undefined}
          />

          {!filename && !busy && (
            <SamplePicker onPick={runSample} busy={busy} />
          )}

          <EvalScorecard />

          <AnimatePresence>
            {busy && (
              <PipelineStatus phase={phase} filename={filename} />
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 border-flag-red/30 ring-1 ring-flag-red/20"
            >
              <div className="text-[13px] font-medium text-flag-red">Error</div>
              <div className="text-[13px] text-ink-700 mt-1">{error}</div>
            </motion.div>
          )}

          {classification && (
            <ContractTypeBadge
              type={classification.contract_type}
              confidence={classification.confidence}
              rationale={classification.rationale}
            />
          )}

          {review && (
            <ReviewWorkbench review={review} />
          )}
        </div>
      </main>

      <Footer />
      <ChatDock documentId={documentId} />
    </div>
  );
}
