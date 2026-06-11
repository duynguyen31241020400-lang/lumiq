"use client";

import { useCallback, useRef, useState } from "react";

import { runPythonCode } from "@/src/lib/pyodideRunner";

interface PythonTerminalProps {
  getCode: () => string;
  sessionId?: string;
}

type TerminalLine =
  | { kind: "system"; text: string }
  | { kind: "output"; text: string }
  | { kind: "error"; text: string };

export default function PythonTerminal({
  getCode,
  sessionId,
}: PythonTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      kind: "system",
      text: "Nhấn ▶ Chạy để thực thi code Python. (Lần đầu có thể mất ~5s)",
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const handleRun = async () => {
    const code = getCode().trim();
    if (!code || isRunning) return;

    setIsRunning(true);
    setLines((prev) => [...prev, { kind: "system", text: ">>> đang chạy..." }]);

    try {
      const result = await runPythonCode(code, sessionId);
      setLines((prev) => {
        const withoutPending = prev.slice(0, -1);
        const next: TerminalLine[] = [
          ...withoutPending,
          { kind: "system", text: ">>> chạy xong" },
        ];
        if (result.output) {
          next.push({ kind: "output", text: result.output });
        }
        if (result.error) {
          next.push({ kind: "error", text: result.error });
        }
        return next;
      });
    } catch (err) {
      setLines((prev) => {
        const withoutPending = prev.slice(0, -1);
        return [
          ...withoutPending,
          {
            kind: "error",
            text: `Lỗi: ${(err as Error).message}`,
          },
        ];
      });
    } finally {
      setIsRunning(false);
      scrollToBottom();
    }
  };

  return (
    <div className="flex h-36 shrink-0 flex-col border-t-[0.5px] border-[#1e1e1e] bg-[#0a0a0a]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
          Terminal
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className="rounded border-[0.5px] border-[#2a2a2a] bg-[#141414] px-2.5 py-0.5 font-mono text-[10px] text-[#E8E0D0] hover:border-[#444] disabled:opacity-40"
        >
          {isRunning ? "Đang chạy..." : "▶ Chạy"}
        </button>
      </div>

      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.5]"
      >
        {lines.map((line, index) => (
          <pre
            key={`${index}-${line.kind}`}
            className={`mb-1 whitespace-pre-wrap break-words ${
              line.kind === "error"
                ? "text-[#ef476f]"
                : line.kind === "system"
                  ? "text-[#444]"
                  : "text-[#ccc]"
            }`}
          >
            {line.text}
          </pre>
        ))}
      </div>
    </div>
  );
}
