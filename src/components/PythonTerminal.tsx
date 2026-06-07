"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getPyodide, runPythonCode } from "@/src/lib/pyodideRunner";

interface PythonTerminalProps {
  getCode: () => string;
}

type TerminalLine =
  | { kind: "system"; text: string }
  | { kind: "output"; text: string }
  | { kind: "error"; text: string };

export default function PythonTerminal({ getCode }: PythonTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      kind: "system",
      text: "Nhấn ▶ Chạy để thực thi code Python. (Lần đầu tải runtime ~10s)",
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [runtimeState, setRuntimeState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRuntimeState("loading");
    getPyodide()
      .then(() => setRuntimeState("ready"))
      .catch((err) => {
        setRuntimeState("error");
        setLines((prev) => [
          ...prev,
          {
            kind: "error",
            text: `Không tải được Python: ${(err as Error).message}`,
          },
        ]);
      });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const handleRun = async () => {
    const code = getCode().trim();
    if (!code || isRunning) return;

    if (runtimeState === "error") {
      setLines((prev) => [
        ...prev,
        {
          kind: "error",
          text: "Python runtime chưa sẵn sàng. Tải lại trang (Ctrl+Shift+R).",
        },
      ]);
      return;
    }

    setIsRunning(true);
    setLines((prev) => [...prev, { kind: "system", text: ">>> đang chạy..." }]);

    try {
      const result = await runPythonCode(code);
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
      setRuntimeState("ready");
    } catch (err) {
      setLines((prev) => {
        const withoutPending = prev.slice(0, -1);
        return [
          ...withoutPending,
          {
            kind: "error",
            text: `Lỗi chạy Python: ${(err as Error).message}`,
          },
        ];
      });
      setRuntimeState("error");
    } finally {
      setIsRunning(false);
    }
  };

  const runLabel =
    isRunning && runtimeState === "loading"
      ? "Đang tải Python..."
      : isRunning
        ? "Đang chạy..."
        : runtimeState === "loading"
          ? "Tải Python..."
          : "▶ Chạy";

  return (
    <div className="flex h-36 shrink-0 flex-col border-t-[0.5px] border-[#1e1e1e] bg-[#0a0a0a]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b-[0.5px] border-[#1e1e1e] bg-[#0f0f0f] px-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
          Terminal
          {runtimeState === "ready" && (
            <span className="ml-2 text-[#4ade80]">● Python sẵn sàng</span>
          )}
          {runtimeState === "loading" && (
            <span className="ml-2 text-[#888]">○ đang tải...</span>
          )}
          {runtimeState === "error" && (
            <span className="ml-2 text-[#ef476f]">● lỗi</span>
          )}
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className="rounded border-[0.5px] border-[#2a2a2a] bg-[#141414] px-2.5 py-0.5 font-mono text-[10px] text-[#E8E0D0] hover:border-[#444] disabled:opacity-40"
        >
          {runLabel}
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
