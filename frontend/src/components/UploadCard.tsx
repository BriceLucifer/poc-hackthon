import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, UploadCloud, X } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  filename?: string | null;
  onClear?: () => void;
  acceptedExt?: string[];
}

export function UploadCard({
  onFile,
  busy,
  filename,
  onClear,
  acceptedExt = [".pdf", ".docx", ".txt", ".md"],
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-strong rounded-3xl p-1.5"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-[22px] border-2 border-dashed transition-colors p-10 sm:p-14 text-center ${
          drag
            ? "border-flag-blue/60 bg-flag-blue/[0.04]"
            : "border-ink-200 bg-white/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedExt.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={busy}
        />

        {filename ? (
          <div className="flex items-center justify-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-flag-blue/20 to-[#34c759]/20 grid place-items-center">
              <FileText className="size-5 text-flag-blue" />
            </div>
            <div className="text-left">
              <div className="text-[14px] font-medium">{filename}</div>
              <div className="text-[12px] text-ink-500">Loaded · ready to review</div>
            </div>
            {onClear && (
              <button
                onClick={onClear}
                className="ml-2 grid size-7 place-items-center rounded-full bg-white/70 hover:bg-white border border-ink-200 focus-ring"
                aria-label="Clear file"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mx-auto size-12 rounded-2xl bg-gradient-to-br from-flag-blue/15 to-[#34c759]/15 grid place-items-center">
              <UploadCloud className="size-6 text-flag-blue" strokeWidth={2.2} />
            </div>
            <h3 className="mt-4 font-display text-[20px] tracking-tight font-semibold">
              Drop a contract to begin
            </h3>
            <p className="mt-1.5 text-[13px] text-ink-500">
              PDF, DOCX, TXT or Markdown · up to 20 MB
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                className="btn-primary focus-ring"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                {busy ? "Uploading…" : "Choose file"}
              </button>
              <span className="text-[12px] text-ink-500">or drag &amp; drop</span>
            </div>
          </>
        )}

        {busy && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-[22px]">
            <div
              className="h-full bg-gradient-to-r from-flag-blue via-[#34c759] to-flag-blue animate-shimmer"
              style={{ backgroundSize: "200% 100%" }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
