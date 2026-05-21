import {
  FolderOpen,
  MessageSquarePlus,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

type ReviewCounts = Record<"green" | "amber" | "red" | "blue", number>;

interface ReviewTab {
  id: string;
  filename: string;
  contractType: string | null;
  counts: ReviewCounts | null;
  createdAt: string;
  phase: "uploading" | "classifying" | "reviewing" | "done" | "error";
  error: string | null;
}

interface Props {
  collapsed: boolean;
  reviews: ReviewTab[];
  activeReviewId: string | null;
  onToggle: () => void;
  onNewReview: () => void;
  onSelectReview: (reviewId: string) => void;
}

export function AdvisorSidebar({
  collapsed,
  reviews,
  activeReviewId,
  onToggle,
  onNewReview,
  onSelectReview,
}: Props) {
  const railWidth = collapsed ? "w-[72px]" : "w-72";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden ${railWidth} flex-col border-r border-white/10 bg-[#050505] text-white transition-[width] duration-200 ease-out lg:flex`}
    >
      <div className={`flex h-14 items-center ${collapsed ? "justify-center" : "justify-between px-3"}`}>
        {!collapsed && (
          <div className="min-w-0 px-2 text-[15px] font-semibold tracking-tight">
            Contract Advisor
          </div>
        )}
        <button
          onClick={onToggle}
          className="grid size-9 place-items-center rounded-[14px] text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand advisor sidebar" : "Collapse advisor sidebar"}
          title={collapsed ? "Expand advisor" : "Collapse advisor"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <div className="space-y-1 px-3 py-3">
        <button
          onClick={onNewReview}
          className={`flex h-11 w-full items-center rounded-[14px] bg-white/15 text-[14px] font-medium text-white transition hover:bg-white/20 ${
            collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"
          }`}
          title="New review"
        >
          <MessageSquarePlus className="size-4" />
          {!collapsed && "New review"}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 px-5 text-[12px] font-semibold text-white/60">
          Reviews
        </div>
      )}
      <div className={`mt-2 ${collapsed ? "px-3" : "px-3"}`}>
        <div className="space-y-1">
          {reviews.length === 0 && !collapsed && (
            <div className="px-3 py-2 text-[13px] text-white/42">
              No reviews yet
            </div>
          )}
          {reviews.map((review) => {
            const active = review.id === activeReviewId;
            const riskCount = review.counts
              ? review.counts.red + review.counts.amber
              : 0;
            return (
              <button
                key={review.id}
                onClick={() => onSelectReview(review.id)}
                className={`group flex w-full rounded-[14px] text-left text-[13px] transition ${
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "items-start gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-white/14 text-white"
                    : "text-white/78 hover:bg-white/10 hover:text-white"
                }`}
                title={review.filename}
              >
                <MessageSquareText
                  className={`mt-0.5 size-4 shrink-0 ${
                    active ? "text-white" : "text-white/48 group-hover:text-white/80"
                  }`}
                />
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {compactTitle(review.filename)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/46">
                      {review.contractType ?? statusLabel(review.phase)}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-white/42">
                      <span>{formatTime(review.createdAt)}</span>
                      {review.phase !== "done" && review.phase !== "error" && (
                        <span className="rounded-[10px] bg-white/10 px-1.5 py-0.5 text-white/62">
                          {statusLabel(review.phase)}
                        </span>
                      )}
                      {review.phase === "error" && (
                        <span className="rounded-[10px] bg-red-500/15 px-1.5 py-0.5 text-red-200">
                          failed
                        </span>
                      )}
                      {riskCount > 0 && (
                        <span className="rounded-[10px] bg-white/10 px-1.5 py-0.5 text-white/62">
                          {riskCount} risk
                        </span>
                      )}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      <div className="border-t border-white/10 p-3">
        <div
          className={`flex items-center rounded-[14px] py-2.5 transition hover:bg-white/10 ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
          title="RGC workspace"
        >
          <div className="grid size-8 place-items-center rounded-full bg-white/12">
            <FolderOpen className="size-4 text-white/75" />
          </div>
          {!collapsed && <div className="min-w-0">
            <div className="text-[13px] font-medium">RGC workspace</div>
            <div className="text-[12px] text-white/50">UoA proof of concept</div>
          </div>}
        </div>
      </div>
    </aside>
  );
}

function compactTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(phase: ReviewTab["phase"]) {
  if (phase === "uploading") return "Uploading";
  if (phase === "classifying") return "Classifying";
  if (phase === "reviewing") return "Reviewing";
  if (phase === "error") return "Failed";
  return "Report ready";
}
