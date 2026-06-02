"use client";

import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { AnalyzeResult, CodeEvents } from "@/src/lib/deepseek";

interface TriggerPayload {
  sessionId: string;
  exerciseId: string;
  code: string;
  scaffoldLevel: 1 | 2 | 3;
  events: CodeEvents;
}

export interface CodeEditorHandle {
  triggerRun: () => void;
}

interface Props {
  sessionId: string;
  exerciseId: string;
  scaffoldLevel?: 1 | 2 | 3;
  onFeedback?: (result: AnalyzeResult | null) => void;
  onAnalyzing?: (loading: boolean) => void;
  triggerRef?: React.MutableRefObject<CodeEditorHandle | null>;
}

const DEFAULT_VALUE = "# Start coding here\n";
const PAUSE_THRESHOLD_MS = 1500;

export default function CodeEditor({
  sessionId,
  exerciseId,
  scaffoldLevel = 1,
  onFeedback,
  onAnalyzing,
  triggerRef,
}: Props) {
  const codeRef = useRef(DEFAULT_VALUE);
  const keystrokeCountRef = useRef(0);
  const clickCountRef = useRef(0);
  const pauseLocationsRef = useRef<number[]>([]);
  const pauseDurationsRef = useRef<number[]>([]);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseStartRef = useRef<number | null>(null);

  // Always points to the latest triggerAnalysis to avoid stale closures in onMount
  const triggerAnalysisRef = useRef<() => void>(() => void 0);

  const getAndResetEvents = useCallback((): CodeEvents => {
    const events: CodeEvents = {
      keystrokeCount: keystrokeCountRef.current,
      pauseLocations: [...pauseLocationsRef.current],
      pauseDurations: [...pauseDurationsRef.current],
      clickCount: clickCountRef.current,
    };
    keystrokeCountRef.current = 0;
    clickCountRef.current = 0;
    pauseLocationsRef.current = [];
    pauseDurationsRef.current = [];
    return events;
  }, []);

  const triggerAnalysis = useCallback(async () => {
    const code = codeRef.current;
    const events = getAndResetEvents();

    onAnalyzing?.(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          exerciseId,
          code,
          scaffoldLevel,
          events,
        } satisfies TriggerPayload),
      });
      if (res.ok) {
        const result = (await res.json()) as AnalyzeResult;
        onFeedback?.(result);
      } else {
        onFeedback?.(null);
      }
    } catch {
      onFeedback?.(null);
    } finally {
      onAnalyzing?.(false);
    }
  }, [sessionId, exerciseId, scaffoldLevel, getAndResetEvents, onFeedback, onAnalyzing]);

  // Keep ref in sync so onMount handlers always call the latest version
  triggerAnalysisRef.current = () => void triggerAnalysis();

  const handleMount: OnMount = useCallback((editor) => {
    if (triggerRef) {
      triggerRef.current = { triggerRun: () => triggerAnalysisRef.current() };
    }

    editor.onKeyDown((e) => {
      if (e.browserEvent.key === "Enter") {
        setTimeout(() => triggerAnalysisRef.current(), 0);
      }
    });

    editor.onMouseDown(() => {
      clickCountRef.current += 1;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRef]);

  const handleChange = useCallback((value: string | undefined) => {
    codeRef.current = value ?? "";
    keystrokeCountRef.current += 1;

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      if (pauseStartRef.current !== null) {
        pauseDurationsRef.current.push(Date.now() - pauseStartRef.current);
        pauseStartRef.current = null;
      }
    }

    pauseTimerRef.current = setTimeout(() => {
      pauseStartRef.current = Date.now();
      pauseLocationsRef.current.push(codeRef.current.length);
    }, PAUSE_THRESHOLD_MS);
  }, []);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue={DEFAULT_VALUE}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
        }}
        onMount={handleMount}
        onChange={handleChange}
      />
    </div>
  );
}
