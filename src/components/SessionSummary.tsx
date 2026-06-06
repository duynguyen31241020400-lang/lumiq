"use client";

import { formatErrorLabelVi } from "@/src/lib/errorLabels";
import type { Exercise } from "@/src/lib/exercises";

export interface SessionStats {
  triggerCount: number;
  flagCount: number;
  dominantErrorType: string | null;
  durationMinutes: number;
  scaffoldLevel: number;
}

interface SessionSummaryProps {
  state: "loading" | "ready" | "failed";
  summary: string | null;
  stats: SessionStats | null;
  exercise: Exercise;
  onTryAnother: () => void;
  onDone: () => void;
}

export default function SessionSummary({
  state,
  summary,
  stats,
  exercise,
  onTryAnother,
  onDone,
}: SessionSummaryProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-sm lumiq-overlay-in">
      <div className="mx-4 w-full max-w-lg rounded-lg border-[0.5px] border-[#2a2a2a] bg-[#0f0f0f] p-8">
        {state === "loading" && (
          <div className="text-center">
            <p className="lumiq-watching font-serif text-[22px] text-[#e8e8e8]">
              Đang tổng kết phiên...
            </p>
            <p className="mt-3 font-mono text-[11px] text-[#555]">
              Lumiq đang xem lại cách bạn tư duy
            </p>
          </div>
        )}

        {state === "failed" && (
          <div className="text-center">
            <p className="font-serif text-[22px] text-[#e8e8e8]">
              Phiên kết thúc
            </p>
            <p className="mt-3 font-sans text-[13px] text-[#999]">
              Có lỗi xảy ra. Dữ liệu đã được lưu.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                onClick={onTryAnother}
                className="rounded border border-[#2a2a2a] bg-[#141414] px-4 py-2 font-mono text-[12px] text-[#E8E0D0] hover:border-[#444]"
              >
                Thử bài khác
              </button>
              <button
                type="button"
                onClick={onDone}
                className="rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[12px] text-[#999] hover:text-[#ccc]"
              >
                Xong
              </button>
            </div>
          </div>
        )}

        {state === "ready" && stats && (
          <div className="lumiq-summary-stagger">
            <h2 className="font-serif text-[28px] text-[#e8e8e8]">
              Phiên kết thúc
            </h2>

            <div className="mt-6 grid grid-cols-4 gap-3 border-y border-[#1e1e1e] py-4">
              <div>
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  lần phân tích
                </p>
                <p className="mt-1 font-mono text-[18px] text-[#e8e8e8]">
                  {stats.triggerCount}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  phát hiện
                </p>
                <p className="mt-1 font-mono text-[18px] text-[#e8e8e8]">
                  {stats.flagCount}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  lỗi phổ biến
                </p>
                <p className="mt-1 font-mono text-[12px] text-[#999]">
                  {formatErrorLabelVi(stats.dominantErrorType)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  thời gian code
                </p>
                <p className="mt-1 font-mono text-[18px] text-[#e8e8e8]">
                  {stats.durationMinutes}p
                </p>
              </div>
            </div>

            {summary && (
              <p className="mt-5 font-sans text-[13px] leading-[1.7] text-[#999]">
                {summary}
              </p>
            )}

            <p className="mt-4 inline-block rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 font-mono text-[10px] text-[#555]">
              {exercise.title} · L{stats.scaffoldLevel}
            </p>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={onTryAnother}
                className="rounded border border-[#2a2a2a] bg-[#141414] px-4 py-2 font-mono text-[12px] text-[#E8E0D0] hover:border-[#444]"
              >
                Thử bài khác
              </button>
              <button
                type="button"
                onClick={onDone}
                className="rounded border border-[#2a2a2a] px-4 py-2 font-mono text-[12px] text-[#999] hover:text-[#ccc]"
              >
                Xong
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
