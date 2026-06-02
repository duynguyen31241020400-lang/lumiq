"use client";

import { useRef, useState } from "react";
import CodeEditor, { type CodeEditorHandle } from "@/src/components/CodeEditor";
import SessionSummaryOverlay, {
  type OverlayState,
  type SessionStats,
} from "@/src/components/SessionSummaryOverlay";
import type { AnalyzeResult } from "@/src/lib/deepseek";

const EXERCISE_ID = "exercise_01";

function newSessionId() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : `demo-session-${Date.now()}`;
}

interface FeedbackHistoryEntry {
  timestamp: number;
  errorType: string | null;
  feedbackText: string | null;
  shouldFlag: boolean;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  concept_error: "Concept",
  syntax_habit: "Syntax",
  logic_gap: "Logic",
  attention_slip: "Attention",
  missing_prerequisite: "Prerequisite",
};

export default function EditorPage() {
  const triggerRef = useRef<CodeEditorHandle | null>(null);

  // Per-session state — all reset together on "Try Another Exercise"
  const [sessionId, setSessionId] = useState(newSessionId);
  const [sessionKey, setSessionKey] = useState(0);
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistoryEntry[]>([]);

  // Overlay
  const [overlayState, setOverlayState] = useState<OverlayState | "hidden">("hidden");
  const [summaryText, setSummaryText] = useState<string | undefined>(undefined);
  const [summaryStats, setSummaryStats] = useState<SessionStats | undefined>(undefined);

  const handleFeedback = (result: AnalyzeResult | null) => {
    setFeedback(result);
    if (result) {
      const entry: FeedbackHistoryEntry = {
        timestamp: Date.now(),
        errorType: result.errorType,
        feedbackText: result.feedbackText,
        shouldFlag: result.shouldFlag,
      };
      setTriggerCount((c) => c + 1);
      setFeedbackHistory((h) => [...h, entry]);
    }
  };

  const handleEndSession = async () => {
    setOverlayState("loading");

    // Build client-side fallback stats so error state still has numbers
    const duration = Date.now() - sessionStart;
    const totalSec = Math.round(duration / 1000);
    const fallbackStats: SessionStats = {
      triggerCount,
      flaggedCount: feedbackHistory.filter((e) => e.shouldFlag).length,
      topErrorType: null,
      sessionDuration: { mins: Math.floor(totalSec / 60), secs: totalSec % 60 },
    };

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          exerciseId: EXERCISE_ID,
          triggerCount,
          sessionDuration: duration,
          feedbackHistory,
        }),
      });

      if (!res.ok) throw new Error("summary api error");

      const data = (await res.json()) as {
        summaryText: string;
        stats: SessionStats;
        exerciseId: string;
      };

      setSummaryText(data.summaryText);
      setSummaryStats(data.stats);
      setOverlayState("ready");
    } catch {
      setSummaryStats(fallbackStats);
      setOverlayState("error");
    }
  };

  const handleReset = () => {
    setSessionId(newSessionId());
    setSessionKey((k) => k + 1);
    setSessionStart(Date.now());
    setFeedback(null);
    setFeedbackHistory([]);
    setTriggerCount(0);
    setSummaryText(undefined);
    setSummaryStats(undefined);
    setOverlayState("hidden");
  };

  const handleDone = () => {
    setOverlayState("hidden");
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d0d]">
      <header className="grid h-10 shrink-0 grid-cols-3 items-center border-b border-[#1e1e1e] bg-[#111] px-4">
        <span className="font-mono text-[13px] text-white">Lumiq</span>
        <span className="text-center font-mono text-[12px] text-[#555]">
          {EXERCISE_ID} — conditional.py
        </span>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => triggerRef.current?.triggerRun()}
            disabled={analyzing}
            className="rounded border border-[#2a6a2a] bg-[#0d1f0d] px-3 py-1 font-mono text-[11px] text-[#4caf50] hover:border-[#4caf50] disabled:opacity-40"
          >
            {analyzing ? "Analyzing…" : "▶ Run"}
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded border border-[#333] bg-[#111] px-3 py-1 font-mono text-[11px] text-[#888] hover:text-[#aaa]"
          >
            End Session
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="h-full w-[65%] overflow-hidden bg-[#0a0a0a]">
          <CodeEditor
            key={sessionKey}
            sessionId={sessionId}
            exerciseId={EXERCISE_ID}
            scaffoldLevel={1}
            onFeedback={handleFeedback}
            onAnalyzing={setAnalyzing}
            triggerRef={triggerRef}
          />
        </div>

        <aside className="sidebar flex h-full w-[35%] flex-col overflow-hidden border-l-[0.5px] border-[#1e1e1e] bg-[#0f0f0f]">
          <div className="shrink-0 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#444]">
            AI Observer
          </div>

          <div className="flex flex-1 flex-col justify-start overflow-y-auto px-4 pb-4">
            {analyzing && (
              <p className="font-mono text-[12px] italic text-[#555]">
                Analyzing…
              </p>
            )}

            {!analyzing && feedback === null && (
              <p className="font-mono text-[12px] italic text-[#333]">
                Start coding. Lumiq will watch.
              </p>
            )}

            {!analyzing && feedback !== null && (
              <div className="space-y-3">
                {feedback.errorType && (
                  <span className="inline-block rounded border border-[#2a2a2a] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#888]">
                    {ERROR_TYPE_LABELS[feedback.errorType] ?? feedback.errorType}
                  </span>
                )}
                {feedback.feedbackText ? (
                  <p className="font-mono text-[13px] leading-relaxed text-[#ccc]">
                    {feedback.feedbackText}
                  </p>
                ) : (
                  <p className="font-mono text-[12px] italic text-[#444]">
                    Looking good — keep going.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {overlayState !== "hidden" && (
        <SessionSummaryOverlay
          state={overlayState}
          summaryText={summaryText}
          stats={summaryStats}
          exerciseId={EXERCISE_ID}
          onTryAnother={handleReset}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
