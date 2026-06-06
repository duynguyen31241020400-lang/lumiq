import { ERROR_LABELS_VI, type ErrorType } from "@/src/lib/errorLabels";

export type { ErrorType };

const ACCENT_COLORS: Record<NonNullable<ErrorType>, string> = {
  concept_error: "#7B8CDE",
  syntax_habit: "#FFD166",
  logic_gap: "#EF476F",
  attention_slip: "#888888",
  missing_prerequisite: "#C084FC",
};

const LUMIQ_ANSWER_ACCENT = "#E8E0D0";

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}p trước`;
  const hours = Math.floor(minutes / 60);
  return `${hours}g trước`;
}

export interface FeedbackCardProps {
  errorType: ErrorType;
  feedbackText: string | null;
  triggerType?: "newline" | "run";
  timestamp: number;
  shouldFlag: boolean;
  isLoading?: boolean;
  variant?: "observation" | "answer";
}

export default function FeedbackCard({
  errorType,
  feedbackText,
  timestamp,
  shouldFlag,
  isLoading = false,
  variant = "observation",
}: FeedbackCardProps) {
  if (isLoading) {
    const loadingText =
      variant === "answer"
        ? "Lumiq đang suy nghĩ..."
        : "Lumiq đang theo dõi cách bạn tiếp cận...";

    return (
      <div className="lumiq-fade-in rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] px-3 py-2.5">
        <p className="lumiq-watching font-mono text-[11px] italic text-[#555]">
          {loadingText}
        </p>
      </div>
    );
  }

  if (variant === "observation" && !shouldFlag) {
    return null;
  }

  const isAnswer = variant === "answer";
  const accent =
    isAnswer
      ? LUMIQ_ANSWER_ACCENT
      : errorType !== null
        ? ACCENT_COLORS[errorType]
        : "#888888";

  const label = isAnswer
    ? "Lumiq trả lời"
    : errorType
      ? ERROR_LABELS_VI[errorType]
      : null;

  return (
    <div
      className="lumiq-fade-in rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] p-3"
      aria-label={isAnswer ? "Lumiq trả lời" : label ?? "Phản hồi Lumiq"}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        {label && (
          <span
            className="font-mono text-[10px] uppercase tracking-wide"
            style={{ color: accent }}
          >
            {label}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[#444]">
          {formatRelativeTime(timestamp)}
        </span>
      </div>

      {feedbackText ? (
        <p className="font-sans text-[12px] leading-[1.6] text-[#ccc]">
          {feedbackText}
        </p>
      ) : isAnswer ? (
        <p className="font-sans text-[12px] italic text-[#555]">
          Không nhận được phản hồi. Thử lại nhé.
        </p>
      ) : null}
    </div>
  );
}
