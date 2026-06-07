"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import { eventBuffer } from "@/src/lib/eventBuffer";
import { configureMonacoLoader, initMonaco } from "@/src/lib/monacoLoader";
import { pauseDetector } from "@/src/lib/pauseDetector";
import { triggerSystem } from "@/src/lib/triggerSystem";
import type { TriggerPayload } from "@/src/lib/triggerSystem";

configureMonacoLoader();

let editorInstance: Parameters<OnMount>[0] | null = null;
let fallbackCode = "";

export function getEditorValue(): string {
  return editorInstance?.getValue() ?? fallbackCode;
}

interface CodeEditorProps {
  starterCode: string;
  exerciseId: string;
  onTrigger?: (payload: TriggerPayload) => void;
  onCursorChange?: (line: number, col: number) => void;
}

type EditorMode = "loading" | "monaco" | "fallback";

export default function CodeEditor({
  starterCode,
  exerciseId,
  onTrigger,
  onCursorChange,
}: CodeEditorProps) {
  const [mode, setMode] = useState<EditorMode>("loading");
  const [code, setCode] = useState(starterCode);
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const exerciseIdRef = useRef(exerciseId);
  exerciseIdRef.current = exerciseId;
  const disposeListenerRef = useRef<(() => void) | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fallbackCode = starterCode;
    setCode(starterCode);
  }, [starterCode]);

  useEffect(() => {
    let cancelled = false;

    loadTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setMode((current) => (current === "loading" ? "fallback" : current));
      }
    }, 10_000);

    initMonaco()
      .then(() => {
        if (!cancelled) setMode("monaco");
      })
      .catch(() => {
        if (!cancelled) setMode("fallback");
      });

    return () => {
      cancelled = true;
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      disposeListenerRef.current?.();
      disposeListenerRef.current = null;
      pauseDetector.stop();
      editorInstance = null;
    };
  }, []);

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const handleMount: OnMount = (editor, monaco) => {
    clearLoadTimeout();
    setMode("monaco");
    editorInstance = editor;
    disposeListenerRef.current?.();

    monaco.editor.defineTheme("lumiq-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.lineHighlightBackground": "#141414",
        "editorGutter.background": "#0a0a0a",
        "editorLineNumber.foreground": "#333333",
        "editorLineNumber.activeForeground": "#555555",
      },
    });
    monaco.editor.setTheme("lumiq-dark");

    let previousLine = editor.getPosition()?.lineNumber ?? 1;
    const pos = editor.getPosition();
    if (pos) {
      onCursorChangeRef.current?.(pos.lineNumber, pos.column);
    }

    const contentDisposable = editor.onDidChangeModelContent((e) => {
      let enterPressed = false;
      fallbackCode = editor.getValue();

      e.changes.forEach((change) => {
        const isDelete = change.text === "" || change.rangeLength > 0;
        const line = change.range.startLineNumber;
        eventBuffer.addEvent({
          type: isDelete ? "delete" : "keystroke",
          line,
          col: change.range.startColumn,
          timestamp: Date.now(),
        });
        pauseDetector.recordKeystroke(line);

        if (change.text.includes("\n")) {
          enterPressed = true;
        }
      });

      if (enterPressed) {
        const currentLine = editor.getPosition()?.lineNumber ?? 1;
        const payload = triggerSystem.onEnterPressed(
          editor.getValue(),
          currentLine,
          exerciseIdRef.current,
        );
        if (payload) {
          onTriggerRef.current?.(payload);
        }
      }
    });

    const mouseDisposable = editor.onMouseDown((e) => {
      if (e.target.position) {
        eventBuffer.addEvent({
          type: "click",
          line: e.target.position.lineNumber,
          col: e.target.position.column,
          timestamp: Date.now(),
        });
      }
    });

    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      onCursorChangeRef.current?.(e.position.lineNumber, e.position.column);

      const lineDiff = Math.abs(e.position.lineNumber - previousLine);
      if (lineDiff > 5 && e.reason !== 0) {
        eventBuffer.addEvent({
          type: "click",
          line: e.position.lineNumber,
          col: e.position.column,
          timestamp: Date.now(),
        });
      }
      previousLine = e.position.lineNumber;
    });

    disposeListenerRef.current = () => {
      contentDisposable.dispose();
      mouseDisposable.dispose();
      cursorDisposable.dispose();
    };
  };

  const handleFallbackChange = (value: string) => {
    setCode(value);
    fallbackCode = value;
    eventBuffer.addEvent({
      type: "keystroke",
      line: 1,
      col: 1,
      timestamp: Date.now(),
    });
    pauseDetector.recordKeystroke(1);
  };

  const handleFallbackKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const target = e.currentTarget;
      const line = target.value.slice(0, target.selectionStart).split("\n").length;
      const payload = triggerSystem.onEnterPressed(
        target.value,
        line,
        exerciseIdRef.current,
      );
      if (payload) {
        onTriggerRef.current?.(payload);
      }
    }
  };

  if (mode === "fallback") {
    return (
      <div className="flex h-full w-full flex-col">
        <p className="shrink-0 border-b border-[#1e1e1e] bg-[#0f0f0f] px-3 py-1 font-mono text-[10px] text-[#555]">
          Editor dự phòng — Monaco không tải được
        </p>
        <textarea
          value={code}
          spellCheck={false}
          onChange={(e) => handleFallbackChange(e.target.value)}
          onKeyDown={handleFallbackKeyDown}
          className="min-h-0 flex-1 resize-none bg-[#0a0a0a] p-3 font-mono text-[14px] leading-[1.6] text-[#ccc] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      {mode === "loading" && (
        <div className="flex h-full items-center justify-center font-mono text-[12px] text-[#555]">
          Đang tải editor...
        </div>
      )}
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue={starterCode}
        theme="lumiq-dark"
        loading={null}
        options={{
          fontSize: 14,
          fontFamily: "var(--font-mono), JetBrains Mono, monospace",
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          padding: { top: 12 },
          renderLineHighlight: "line",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        }}
        onMount={handleMount}
        wrapperProps={{
          style: {
            display: mode === "loading" ? "none" : "flex",
            width: "100%",
            height: "100%",
          },
        }}
      />
    </div>
  );
}
