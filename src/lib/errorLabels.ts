export type ErrorType =
  | "concept_error"
  | "syntax_habit"
  | "logic_gap"
  | "attention_slip"
  | "missing_prerequisite"
  | null;

export const ERROR_LABELS_VI: Record<NonNullable<ErrorType>, string> = {
  concept_error: "lỗi khái niệm",
  syntax_habit: "thói quen cú pháp",
  logic_gap: "lỗi logic",
  attention_slip: "lỗi bất cẩn",
  missing_prerequisite: "thiếu kiến thức nền",
};

export function formatErrorLabelVi(errorType: string | null): string {
  if (!errorType) return "—";
  return (
    ERROR_LABELS_VI[errorType as NonNullable<ErrorType>] ??
    errorType.replace(/_/g, " ")
  );
}
