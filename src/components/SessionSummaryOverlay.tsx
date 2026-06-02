"use client";

import { useEffect, useState } from "react";

export type OverlayState = "loading" | "ready" | "error";

export interface SessionStats {
  triggerCount: number;
  flaggedCount: number;
  topErrorType: string | null;
  sessionDuration: { mins: number; secs: number };
}

interface Props {
  state: OverlayState;
  summaryText?: string;
  stats?: SessionStats;
  exerciseId?: string;
  onTryAnother: () => void;
  onDone: () => void;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  concept_error: "Concept Error",
  syntax_habit: "Syntax Habit",
  logic_gap: "Logic Gap",
  attention_slip: "Attention Slip",
  missing_prerequisite: "Missing Prerequisite",
};

function PulsingDot() {
  return (
    <span className="relative mx-auto flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#444] opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#555]" />
    </span>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[18px] font-semibold text-white">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#444]">
        {label}
      </span>
    </div>
  );
}

function StatsRow({ stats }: { stats: SessionStats }) {
  const { triggerCount, flaggedCount, topErrorType, sessionDuration } = stats;
  const timeStr =
    sessionDuration.mins > 0
      ? `${sessionDuration.mins}m ${sessionDuration.secs}s`
      : `${sessionDuration.secs}s`;

  return (
    <div className="flex justify-between border border-[#1a1a1a] px-6 py-4">
      <StatItem label="Triggers" value={String(triggerCount)} />
      <StatItem label="Flagged" value={String(flaggedCount)} />
      <StatItem
        label="Top Error"
        value={
          topErrorType
            ? (ERROR_TYPE_LABELS[topErrorType] ?? topErrorType)
            : "—"
        }
      />
      <StatItem label="Time Coding" value={timeStr} />
    </div>
  );
}

export default function SessionSummaryOverlay({
  state,
  summaryText,
  stats,
  exerciseId,
  onTryAnother,
  onDone,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="session-summary-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d0d] px-6 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="w-full max-w-[600px] space-y-6">
        {/* ── STATE A: Loading ── */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <PulsingDot />
            <p className="font-mono text-[14px] italic text-[#555]">
              Lumiq is thinking...
            </p>
          </div>
        )}

        {/* ── STATE B: Summary ready ── */}
        {state === "ready" && stats && (
          <>
            <h1
              className="text-center text-[28px] text-white"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Session Complete
            </h1>

            <StatsRow stats={stats} />

            <div className="border-t border-[#1a1a1a]" />

            <p className="font-mono text-[14px] leading-[1.8] text-[#ccc]">
              {summaryText}
            </p>

            {exerciseId && (
              <div className="inline-flex items-center gap-2 rounded border border-[#2a2a2a] px-3 py-1.5 font-mono text-[12px] text-[#666]">
                <span className="text-[#4caf50]">✓</span>
                <span>{exerciseId}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onTryAnother}
                className="flex-1 rounded border border-[#333] bg-[#111] py-2.5 font-mono text-[12px] text-[#aaa] hover:border-[#555] hover:text-white"
              >
                Try Another Exercise
              </button>
              <button
                type="button"
                onClick={onDone}
                className="flex-1 rounded border border-[#2a6a2a] bg-[#0d1f0d] py-2.5 font-mono text-[12px] text-[#4caf50] hover:border-[#4caf50]"
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* ── STATE C: Error / fallback ── */}
        {state === "error" && (
          <>
            <h1
              className="text-center text-[28px] text-white"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Session Complete
            </h1>

            {stats && <StatsRow stats={stats} />}

            <p className="font-mono text-[13px] italic text-[#555]">
              Session data saved.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onTryAnother}
                className="flex-1 rounded border border-[#333] bg-[#111] py-2.5 font-mono text-[12px] text-[#aaa] hover:border-[#555] hover:text-white"
              >
                Try Another Exercise
              </button>
              <button
                type="button"
                onClick={onDone}
                className="flex-1 rounded border border-[#2a6a2a] bg-[#0d1f0d] py-2.5 font-mono text-[12px] text-[#4caf50] hover:border-[#4caf50]"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
