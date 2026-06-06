"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AskLumiqInput from "@/src/components/AskLumiqInput";
import CodeEditor, { getEditorValue } from "@/src/components/CodeEditor";
import FeedbackCard from "@/src/components/FeedbackCard";
import PythonTerminal from "@/src/components/PythonTerminal";
import type { ErrorType } from "@/src/lib/errorLabels";
import SessionSummary, {
  type SessionStats,
} from "@/src/components/SessionSummary";
import UserQuestionBubble from "@/src/components/UserQuestionBubble";
import { eventBuffer } from "@/src/lib/eventBuffer";
import { formatErrorLabelVi } from "@/src/lib/errorLabels";
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

type AskEntry = {
  id: string;
  question: string;
  answer: string | null;
  questionTimestamp: number;
  answerTimestamp: number | null;
  isLoading: boolean;
};

type FeedItem =
  | {
      kind: "feedback";
      timestamp: number;
      entry: FeedbackEntry;
      key: string;
      seq: number;
    }
  | {
      kind: "question";
      timestamp: number;
      text: string;
      key: string;
      seq: number;
    }
  | {
      kind: "answer";
      timestamp: number;
      text: string | null;
      isLoading: boolean;
      key: string;
      seq: number;
    };

interface AnalyzeResponse {
  errorType: ErrorType;
  feedbackText: string | null;
  shouldFlag: boolean;
}

const MAX_HISTORY = 10;
const TRIGGERS_TO_LEVEL_UP = 10;
const CONSECUTIVE_PATTERN_THRESHOLD = 3;

function dominantErrorType(history: FeedbackEntry[]): string | null {
  const counts: Record<string, number> = {};
  for (const entry of history) {
    if (!entry.errorType) continue;
    counts[entry.errorType] = (counts[entry.errorType] ?? 0) + 1;
  }
  let top: string | null = null;
  let max = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      top = type;
    }
  }
  return top;
}

export default function EditorPage() {
  const router = useRouter();
  const [currentExercise, setCurrentExercise] = useState<Exercise>(exercises[0]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);
  const [askHistory, setAskHistory] = useState<AskEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3>(1);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [summaryState, setSummaryState] = useState<
    "hidden" | "loading" | "ready" | "failed"
  >("hidden");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<SessionStats | null>(null);
  const [lastFlagAt, setLastFlagAt] = useState<number | null>(null);

  const scaffoldLevelRef = useRef<1 | 2 | 3>(scaffoldLevel);
  scaffoldLevelRef.current = scaffoldLevel;

  const sessionId = useRef(crypto.randomUUID());
  const sessionStartedAt = useRef(Date.now());
  const triggersSinceLastFlag = useRef(0);
  const consecutiveFlagType = useRef<ErrorType>(null);
  const consecutiveFlagCount = useRef(0);
  const notedPattern = useRef<ErrorType>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const feedbackHistoryRef = useRef(feedbackHistory);
  feedbackHistoryRef.current = feedbackHistory;
  const askHistoryRef = useRef(askHistory);
  askHistoryRef.current = askHistory;

  const exerciseIndex = exercises.findIndex((e) => e.id === currentExercise.id);

  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    let seq = 0;

    feedbackHistory.forEach((entry, index) => {
      items.push({
        kind: "feedback",
        timestamp: entry.timestamp,
        entry,
        key: `feedback-${entry.timestamp}-${index}`,
        seq: seq++,
      });
    });

    askHistory.forEach((ask) => {
      items.push({
        kind: "question",
        timestamp: ask.questionTimestamp,
        text: ask.question,
        key: `question-${ask.id}`,
        seq: seq++,
      });
      items.push({
        kind: "answer",
        timestamp: ask.answerTimestamp ?? ask.questionTimestamp + 1,
        text: ask.answer,
        isLoading: ask.isLoading,
        key: `answer-${ask.id}`,
        seq: seq++,
      });
    });

    return items.sort((a, b) => a.seq - b.seq);
  }, [feedbackHistory, askHistory]);

  const scrollFeedToBottom = useCallback(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeedToBottom();
  }, [feedItems, isAnalyzing, scrollFeedToBottom]);

  const selectExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setFeedbackHistory([]);
    setAskHistory([]);
    eventBuffer.clear();
    pauseDetector.stop();
    setSummaryState("hidden");
    setLastFlagAt(null);
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
        setLastFlagAt(Date.now());

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

  const handleAsk = async (question: string) => {
    const id = crypto.randomUUID();
    const questionTimestamp = Date.now();

    setAskHistory((prev) => [
      ...prev,
      {
        id,
        question,
        answer: null,
        questionTimestamp,
        answerTimestamp: null,
        isLoading: true,
      },
    ]);

    const priorAsks = askHistoryRef.current
      .filter((entry) => entry.answer && !entry.isLoading)
      .map((entry) => ({
        question: entry.question,
        answer: entry.answer as string,
      }));

    const currentFeedback = feedbackHistoryRef.current;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId.current,
        },
        body: JSON.stringify({
          question,
          code: getEditorValue(),
          feedbackHistory: currentFeedback.map((e) => ({
            errorType: e.errorType,
            feedbackText: e.feedbackText,
            timestamp: e.timestamp,
          })),
          askHistory: priorAsks,
          sessionStats: {
            triggerCount: eventBuffer.getTriggerCount(),
            flagCount: currentFeedback.length,
            dominantErrorType: dominantErrorType(currentFeedback),
          },
          exerciseId: currentExercise.id,
        }),
      });

      const data = (await res.json()) as { answer: string };

      setAskHistory((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                answer: data.answer,
                answerTimestamp: Date.now(),
                isLoading: false,
              }
            : entry,
        ),
      );
    } catch {
      setAskHistory((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                answer: "Lumiq đang bận suy nghĩ. Thử lại sau nhé.",
                answerTimestamp: Date.now(),
                isLoading: false,
              }
            : entry,
        ),
      );
    }
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

  const scaffoldLabel = notedPattern.current
    ? `L${scaffoldLevel} · pattern: ${formatErrorLabelVi(notedPattern.current)}`
    : "Đang theo dõi cách bạn tư duy";

  const showEmptyState = feedItems.length === 0 && !isAnalyzing;

  const sidebarFooterText = isAnalyzing
    ? "↵ Lumiq đang phân tích..."
    : lastFlagAt && Date.now() - lastFlagAt < 30_000
      ? "● Có phát hiện mới"
      : "Lumiq quan sát khi bạn code";

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
            aria-label="Bài trước"
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
            aria-label="Bài sau"
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
            ▶ Phân tích
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded border-[0.5px] border-[#2a2a2a] px-3 py-1 font-mono text-[11px] text-[#555] hover:text-[#999]"
          >
            Kết thúc phiên
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

          <div className="flex min-h-0 flex-1 flex-col bg-[#0a0a0a]">
            <div className="min-h-0 flex-1">
              <CodeEditor
                key={currentExercise.id}
                starterCode={currentExercise.starterCode}
                exerciseId={currentExercise.id}
                onTrigger={handleTrigger}
                onCursorChange={(line, col) => setCursorPos({ line, col })}
              />
            </div>
            <PythonTerminal getCode={getEditorValue} />
          </div>

          <div className="flex h-7 shrink-0 items-center justify-between border-t-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-4 font-mono text-[10px] text-[#555]">
            <span>Python</span>
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="text-[#4ade80]">● đang theo dõi</span>
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
                <p className="whitespace-pre-line text-center font-mono text-[12px] italic text-[#333]">
                  {
                    "Bắt đầu code bằng Python.\nLumiq quan sát cách bạn suy nghĩ —\nkhông chỉ những gì bạn viết."
                  }
                </p>
              </div>
            )}

            {!showEmptyState && (
              <>
                {feedItems.map((item) => {
                  if (item.kind === "feedback") {
                    return (
                      <FeedbackCard
                        key={item.key}
                        errorType={item.entry.errorType}
                        feedbackText={item.entry.feedbackText}
                        triggerType={item.entry.triggerType}
                        timestamp={item.entry.timestamp}
                        shouldFlag={item.entry.shouldFlag}
                      />
                    );
                  }
                  if (item.kind === "question") {
                    return (
                      <UserQuestionBubble
                        key={item.key}
                        question={item.text}
                        timestamp={item.timestamp}
                      />
                    );
                  }
                  return (
                    <FeedbackCard
                      key={item.key}
                      errorType={null}
                      feedbackText={item.text}
                      timestamp={item.timestamp}
                      shouldFlag
                      variant="answer"
                      isLoading={item.isLoading}
                    />
                  );
                })}
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
            <p className="mb-2 font-mono text-[10px] text-[#333]">
              {sidebarFooterText}
            </p>
            <AskLumiqInput onSubmit={handleAsk} />
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
