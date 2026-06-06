export type ErrorType =
  | "concept_error"
  | "syntax_habit"
  | "logic_gap"
  | "attention_slip"
  | "missing_prerequisite"
  | null;

const ACCENT_COLORS: Record<NonNullable<ErrorType>, string> = {
  concept_error: "#7B8CDE",
  syntax_habit: "#FFD166",
  logic_gap: "#EF476F",
  attention_slip: "#888888",
  missing_prerequisite: "#C084FC",
};

function formatErrorLabel(errorType: NonNullable<ErrorType>): string {
  return errorType.replace(/_/g, " ");
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export interface FeedbackCardProps {
  errorType: ErrorType;
  feedbackText: string | null;
  triggerType?: "newline" | "run";
  timestamp: number;
  shouldFlag: boolean;
  isLoading?: boolean;
}

export default function FeedbackCard({
  errorType,
  feedbackText,
  triggerType,
  timestamp,
  shouldFlag,
  isLoading = false,
}: FeedbackCardProps) {
  if (isLoading) {
    return (
      <div className="lumiq-fade-in rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] px-3 py-2.5">
        <p className="lumiq-watching font-mono text-[11px] italic text-[#555]">
          Lumiq is watching your approach...
        </p>
      </div>
    );
  }

  if (!shouldFlag) {
    return null;
  }

  const accent =
    errorType !== null ? ACCENT_COLORS[errorType] : "#888888";

  return (
    <div className="lumiq-fade-in rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        {errorType && (
          <span
            className="font-mono text-[10px] uppercase tracking-wide"
            style={{ color: accent }}
          >
            {formatErrorLabel(errorType)}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[#444]">
          {formatRelativeTime(timestamp)}
        </span>
      </div>

      {feedbackText && (
        <p className="font-sans text-[12px] leading-[1.6] text-[#ccc]">
          {feedbackText}
        </p>
      )}
    </div>
  );
}
