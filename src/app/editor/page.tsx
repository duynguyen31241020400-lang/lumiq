"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CodeEditor, { getEditorValue } from "@/src/components/CodeEditor";
import FeedbackCard, { type ErrorType } from "@/src/components/FeedbackCard";
import SessionSummary, {
  type SessionStats,
} from "@/src/components/SessionSummary";
import { eventBuffer } from "@/src/lib/eventBuffer";
import { exercises, type Exercise } from "@/src/lib/exercises";
import { pauseDetector } from "@/src/lib/pauseDetector";
import { triggerSystem } from "@/src/lib/triggerSystem";
import type { TriggerPayload } from "@/src/lib/triggerSystem";
import type { SessionFeedbackEntry } from "@/src/lib/deepseek";

type FeedbackEntry = {
  errorType: ErrorType;
  feedbackText: string | null;
  triggerType: "newline" | "run";
  timestamp: number;
  shouldFlag: boolean;
};

interface AnalyzeResponse {
  errorType: ErrorType;
  feedbackText: string | null;
  shouldFlag: boolean;
}

const MAX_HISTORY = 10;
const TRIGGERS_TO_LEVEL_UP = 10;
const CONSECUTIVE_PATTERN_THRESHOLD = 3;

const ERROR_LABELS: Record<string, string> = {
  concept_error: "concept",
  syntax_habit: "syntax",
  logic_gap: "logic",
  attention_slip: "attention",
  missing_prerequisite: "prerequisite",
};

export default function EditorPage() {
  const router = useRouter();
  const [currentExercise, setCurrentExercise] = useState<Exercise>(exercises[0]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3>(1);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [summaryState, setSummaryState] = useState<
    "hidden" | "loading" | "ready" | "failed"
  >("hidden");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<SessionStats | null>(null);

  const scaffoldLevelRef = useRef<1 | 2 | 3>(scaffoldLevel);
  scaffoldLevelRef.current = scaffoldLevel;

  const sessionId = useRef(crypto.randomUUID());
  const sessionStartedAt = useRef(Date.now());
  const triggersSinceLastFlag = useRef(0);
  const consecutiveFlagType = useRef<ErrorType>(null);
  const consecutiveFlagCount = useRef(0);
  const notedPattern = useRef<ErrorType>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const exerciseIndex = exercises.findIndex((e) => e.id === currentExercise.id);

  const scrollFeedToBottom = useCallback(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeedToBottom();
  }, [feedbackHistory, isAnalyzing, scrollFeedToBottom]);

  const selectExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setFeedbackHistory([]);
    eventBuffer.clear();
    pauseDetector.stop();
    setSummaryState("hidden");
  };

  const handleTrigger = async (payload: TriggerPayload) => {
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId.current,
        },
        body: JSON.stringify({
          code: payload.code,
          triggerType: payload.triggerType,
          stats: payload.stats,
          scaffoldLevel: scaffoldLevelRef.current,
          triggerCount: payload.triggerCount,
          exerciseId: payload.exerciseId,
          exerciseTitle: currentExercise.title,
          exerciseDescription: currentExercise.description,
          targetConcepts: currentExercise.targetConcepts,
        }),
      });

      if (res.status === 429 || !res.ok) return;

      const data = (await res.json()) as AnalyzeResponse;

      if (data.shouldFlag) {
        triggersSinceLastFlag.current = 0;

        const errorType = data.errorType;
        if (errorType && errorType === consecutiveFlagType.current) {
          consecutiveFlagCount.current += 1;
        } else {
          consecutiveFlagType.current = errorType;
          consecutiveFlagCount.current = 1;
        }

        if (consecutiveFlagCount.current >= CONSECUTIVE_PATTERN_THRESHOLD) {
          notedPattern.current = errorType;
          consecutiveFlagCount.current = 0;
        }

        const entry: FeedbackEntry = {
          errorType: data.errorType,
          feedbackText: data.feedbackText,
          triggerType: payload.triggerType,
          timestamp: Date.now(),
          shouldFlag: true,
        };

        setFeedbackHistory((prev) => [...prev, entry].slice(-MAX_HISTORY));
      } else {
        consecutiveFlagType.current = null;
        consecutiveFlagCount.current = 0;

        triggersSinceLastFlag.current += 1;
        if (triggersSinceLastFlag.current >= TRIGGERS_TO_LEVEL_UP) {
          setScaffoldLevel((level) => {
            if (level >= 3) return level;
            return (level + 1) as 1 | 2 | 3;
          });
          triggersSinceLastFlag.current = 0;
        }
      }
    } catch {
      // silent
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    const payload = triggerSystem.onRunPressed(
      getEditorValue(),
      currentExercise.id,
    );
    void handleTrigger(payload);
  };

  const handleEndSession = async () => {
    setSummaryState("loading");

    const historyForApi: SessionFeedbackEntry[] = feedbackHistory.map((e) => ({
      errorType: e.errorType,
      feedbackText: e.feedbackText,
      timestamp: e.timestamp,
      triggerType: e.triggerType,
    }));

    const triggerCount = eventBuffer.getTriggerCount();

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          exerciseId: currentExercise.id,
          exerciseTitle: currentExercise.title,
          feedbackHistory: historyForApi,
          triggerCount,
          sessionStartedAt: sessionStartedAt.current,
          scaffoldLevel: scaffoldLevelRef.current,
        }),
      });

      const data = (await res.json()) as {
        status: string;
        summary: string | null;
        stats: SessionStats | null;
      };

      if (data.status === "ready" && data.summary && data.stats) {
        setSummaryText(data.summary);
        setSummaryStats(data.stats);
        setSummaryState("ready");
      } else {
        setSummaryStats(data.stats);
        setSummaryState("failed");
      }
    } catch {
      setSummaryState("failed");
    }
  };

  const scaffoldLabel =
    notedPattern.current
      ? `L${scaffoldLevel} · pattern: ${ERROR_LABELS[notedPattern.current] ?? notedPattern.current}`
      : `L${scaffoldLevel} scaffold`;

  const showEmptyState = feedbackHistory.length === 0 && !isAnalyzing;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <header className="grid h-11 shrink-0 grid-cols-3 items-center border-b-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-4">
        <span className="font-mono text-[13px] font-medium text-[#e8e8e8]">
          Lumiq
        </span>

        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={exerciseIndex <= 0}
            onClick={() => selectExercise(exercises[exerciseIndex - 1])}
            className="px-1.5 font-mono text-[11px] text-[#555] hover:text-[#999] disabled:opacity-25"
            aria-label="Previous exercise"
          >
            ←
          </button>
          <span className="max-w-[220px] truncate font-mono text-[11px] text-[#999]">
            {currentExercise.title}
          </span>
          <button
            type="button"
            disabled={exerciseIndex >= exercises.length - 1}
            onClick={() => selectExercise(exercises[exerciseIndex + 1])}
            className="px-1.5 font-mono text-[11px] text-[#555] hover:text-[#999] disabled:opacity-25"
            aria-label="Next exercise"
          >
            →
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="rounded border-[0.5px] border-[#2a2a2a] bg-[#141414] px-3 py-1 font-mono text-[11px] text-[#E8E0D0] hover:border-[#444] disabled:opacity-40"
          >
            ▶ Analyze
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded border-[0.5px] border-[#2a2a2a] px-3 py-1 font-mono text-[11px] text-[#555] hover:text-[#999]"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Main panels */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left — IDE */}
        <div className="flex h-full w-[62%] flex-col overflow-hidden border-r-[0.5px] border-[#1e1e1e]">
          <div className="flex h-8 shrink-0 items-center border-b-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-4">
            <span className="font-mono text-[11px] text-[#555]">
              {currentExercise.filename}
            </span>
            <span className="ml-3 font-mono text-[10px] text-[#333]">
              {currentExercise.description}
            </span>
          </div>

          <div className="min-h-0 flex-1 bg-[#0a0a0a]">
            <CodeEditor
              key={currentExercise.id}
              starterCode={currentExercise.starterCode}
              exerciseId={currentExercise.id}
              onTrigger={handleTrigger}
              onCursorChange={(line, col) => setCursorPos({ line, col })}
            />
          </div>

          <div className="flex h-7 shrink-0 items-center justify-between border-t-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-4 font-mono text-[10px] text-[#555]">
            <span>Python</span>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="text-[#4ade80]">● observing</span>
          </div>
        </div>

        {/* Right — Observer */}
        <aside className="flex h-full w-[38%] flex-col overflow-hidden bg-[#0f0f0f]">
          <div className="shrink-0 border-b-[0.5px] border-[#1e1e1e] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#555]">
              Lumiq Observer
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-[#333]">
              {scaffoldLabel}
            </p>
          </div>

          <div
            ref={feedRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {showEmptyState && (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-center font-mono text-[12px] italic text-[#333]">
                  Start coding. Lumiq is watching how you think.
                </p>
              </div>
            )}

            {!showEmptyState && (
              <>
                {feedbackHistory.map((entry, index) => (
                  <FeedbackCard
                    key={`${entry.timestamp}-${index}`}
                    errorType={entry.errorType}
                    feedbackText={entry.feedbackText}
                    triggerType={entry.triggerType}
                    timestamp={entry.timestamp}
                    shouldFlag={entry.shouldFlag}
                  />
                ))}
                {isAnalyzing && (
                  <FeedbackCard
                    errorType={null}
                    feedbackText={null}
                    timestamp={Date.now()}
                    shouldFlag={false}
                    isLoading
                  />
                )}
              </>
            )}
          </div>

          <div className="shrink-0 border-t-[0.5px] border-[#1e1e1e] px-4 py-2.5">
            <p className="font-mono text-[10px] text-[#333]">
              Lumiq observes as you code
            </p>
          </div>
        </aside>
      </div>

      {summaryState !== "hidden" && (
        <SessionSummary
          state={
            summaryState === "loading"
              ? "loading"
              : summaryState === "ready"
                ? "ready"
                : "failed"
          }
          summary={summaryText}
          stats={summaryStats}
          exercise={currentExercise}
          onTryAnother={() => {
            setSummaryState("hidden");
            const nextIdx = (exerciseIndex + 1) % exercises.length;
            selectExercise(exercises[nextIdx]);
            sessionId.current = crypto.randomUUID();
            sessionStartedAt.current = Date.now();
          }}
          onDone={() => router.push("/")}
        />
      )}
    </div>
  );
}
