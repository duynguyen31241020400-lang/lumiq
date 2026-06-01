"use client";

import { useRef, useState } from "react";

import CodeEditor, { getEditorValue } from "@/src/components/CodeEditor";
import FeedbackCard, { type ErrorType } from "@/src/components/FeedbackCard";
import { eventBuffer } from "@/src/lib/eventBuffer";
import { exercises, type Exercise } from "@/src/lib/exercises";
import { pauseDetector } from "@/src/lib/pauseDetector";
import { triggerSystem } from "@/src/lib/triggerSystem";
import type { TriggerPayload } from "@/src/lib/triggerSystem";

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
  latencyMs?: number;
  error?: string;
}

const MAX_HISTORY = 10;
const TRIGGERS_TO_LEVEL_UP = 10;
const CONSECUTIVE_PATTERN_THRESHOLD = 3;

export default function EditorPage() {
  const [currentExercise, setCurrentExercise] = useState<Exercise>(exercises[0]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scaffoldLevel, setScaffoldLevel] = useState<1 | 2 | 3>(1);
  const scaffoldLevelRef = useRef<1 | 2 | 3>(scaffoldLevel);
  scaffoldLevelRef.current = scaffoldLevel;

  const sessionId = useRef(crypto.randomUUID());
  const triggersSinceLastFlag = useRef(0);
  const consecutiveFlagType = useRef<ErrorType>(null);
  const consecutiveFlagCount = useRef(0);
  const notedPattern = useRef<ErrorType>(null);

  const exerciseIndex = exercises.findIndex((e) => e.id === currentExercise.id);

  const selectExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setFeedbackHistory([]);
    eventBuffer.clear();
    pauseDetector.stop();
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
        }),
      });

      if (res.status === 429) {
        return;
      }

      if (!res.ok) {
        return;
      }

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

        setFeedbackHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
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
      // Silently ignore — never show errors to the user
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRun = () => {
    const payload = triggerSystem.onRunPressed(getEditorValue());
    void handleTrigger(payload);
  };

  const showEmptyState = feedbackHistory.length === 0 && !isAnalyzing;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d0d]">
      <header className="grid h-10 shrink-0 grid-cols-3 items-center border-b border-[#1e1e1e] bg-[#111] px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-white">Lumiq</span>
          <span className="font-mono text-[10px] text-[#00D4AA]">● Watching</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={exerciseIndex <= 0}
            onClick={() => selectExercise(exercises[exerciseIndex - 1])}
            className="rounded border border-[#333] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-[#888] hover:text-[#ccc] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous exercise"
          >
            ←
          </button>
          <select
            value={currentExercise.id}
            onChange={(e) => {
              const next = exercises.find((ex) => ex.id === e.target.value);
              if (next) selectExercise(next);
            }}
            className="max-w-[200px] truncate rounded border border-[#333] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-[#aaa] outline-none"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={exerciseIndex >= exercises.length - 1}
            onClick={() => selectExercise(exercises[exerciseIndex + 1])}
            className="rounded border border-[#333] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-[#888] hover:text-[#ccc] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next exercise"
          >
            →
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleRun}
            className="rounded border border-[#333] bg-[#111] px-3 py-1 font-mono text-[11px] text-[#ccc] hover:border-[#444] hover:text-white"
          >
            Run
          </button>
          <button
            type="button"
            className="rounded border border-[#333] bg-[#111] px-3 py-1 font-mono text-[11px] text-[#888] hover:text-[#aaa]"
          >
            End Session
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full w-[65%] flex-col overflow-hidden bg-[#0a0a0a]">
          <div className="shrink-0 border-b border-[#1e1e1e] px-4 py-2">
            <h2 className="font-mono text-[12px] text-[#888]">
              {currentExercise.title}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-[#555]">
              {currentExercise.description}
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              key={currentExercise.id}
              starterCode={currentExercise.starterCode}
              onTrigger={handleTrigger}
            />
          </div>
        </div>

        <aside className="sidebar flex h-full w-[35%] flex-col overflow-hidden border-l-[0.5px] border-[#1e1e1e] bg-[#0f0f0f]">
          <div className="shrink-0 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#444]">
            AI Observer
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
            {showEmptyState ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="font-mono text-[12px] italic text-[#333]">
                  Start coding. Lumiq will watch.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {isAnalyzing && (
                  <FeedbackCard
                    errorType={null}
                    feedbackText={null}
                    triggerType="newline"
                    timestamp={Date.now()}
                    shouldFlag={false}
                    isLoading
                  />
                )}
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
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
