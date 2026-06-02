"use client";

import { useRef, useState } from "react";
import CodeEditor, { type CodeEditorHandle } from "@/src/components/CodeEditor";
import type { AnalyzeResult } from "@/src/lib/deepseek";

const EXERCISE_ID = "exercise_01";
const SESSION_ID =
  typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : "demo-session-00000000";

const ERROR_TYPE_LABELS: Record<string, string> = {
  concept_error: "Concept",
  syntax_habit: "Syntax",
  logic_gap: "Logic",
  attention_slip: "Attention",
  missing_prerequisite: "Prerequisite",
};

export default function EditorPage() {
  const triggerRef = useRef<CodeEditorHandle | null>(null);
  const [feedback, setFeedback] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
            className="rounded border border-[#333] bg-[#111] px-3 py-1 font-mono text-[11px] text-[#888] hover:text-[#aaa]"
          >
            End Session
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="h-full w-[65%] overflow-hidden bg-[#0a0a0a]">
          <CodeEditor
            sessionId={SESSION_ID}
            exerciseId={EXERCISE_ID}
            scaffoldLevel={1}
            onFeedback={setFeedback}
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
    </div>
  );
}
