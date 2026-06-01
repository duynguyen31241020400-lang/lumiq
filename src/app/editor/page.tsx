"use client";

import { useState } from "react";

import CodeEditor, { getEditorValue } from "@/src/components/CodeEditor";
import { triggerSystem } from "@/src/lib/triggerSystem";
import type { TriggerPayload } from "@/src/lib/triggerSystem";

export default function EditorPage() {
  const [lastTrigger, setLastTrigger] = useState<TriggerPayload | null>(null);

  const handleTrigger = (payload: TriggerPayload) => {
    setLastTrigger(payload);
  };

  const handleRun = () => {
    const payload = triggerSystem.onRunPressed(getEditorValue());
    handleTrigger(payload);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d0d]">
      <header className="grid h-10 shrink-0 grid-cols-3 items-center border-b border-[#1e1e1e] bg-[#111] px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-white">Lumiq</span>
          <span className="font-mono text-[10px] text-[#00D4AA]">● Watching</span>
        </div>
        <span className="text-center font-mono text-[12px] text-[#555]">
          exercise_01 — conditional.py
        </span>
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
        <div className="h-full w-[65%] overflow-hidden bg-[#0a0a0a]">
          <CodeEditor onTrigger={setLastTrigger} />
        </div>

        <aside className="sidebar flex h-full w-[35%] flex-col overflow-hidden border-l-[0.5px] border-[#1e1e1e] bg-[#0f0f0f]">
          <div className="shrink-0 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#444]">
            AI Observer
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
            {!lastTrigger ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="font-mono text-[12px] italic text-[#333]">
                  Start coding. Lumiq will watch.
                </p>
              </div>
            ) : (
              <div className="rounded border border-[#222] bg-[#141414] p-3 font-mono text-[11px] text-[#888]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded border border-[#333] bg-[#1a1a1a] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#aaa]">
                    {lastTrigger.triggerType}
                  </span>
                  <span className="text-[10px] text-[#555]">
                    {new Date(lastTrigger.triggeredAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="mb-2 text-[#666]">
                  {lastTrigger.stats.totalKeystrokes} keystrokes ·{" "}
                  {lastTrigger.stats.pauseCount} pauses ·{" "}
                  {lastTrigger.stats.clickCount} clicks
                </p>

                <p className="mb-2 text-[#555]">
                  Pause lines:{" "}
                  {lastTrigger.stats.pauseLines.length > 0
                    ? `[${lastTrigger.stats.pauseLines.join(", ")}]`
                    : "[]"}
                </p>

                <p className="break-all text-[#444]">
                  {lastTrigger.code.slice(0, 100)}
                  {lastTrigger.code.length > 100 ? "…" : ""}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
