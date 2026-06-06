"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

import { eventBuffer } from "@/src/lib/eventBuffer";
import { pauseDetector } from "@/src/lib/pauseDetector";
import { triggerSystem } from "@/src/lib/triggerSystem";
import type { TriggerPayload } from "@/src/lib/triggerSystem";

let editorInstance: Parameters<OnMount>[0] | null = null;

export function getEditorValue(): string {
  return editorInstance?.getValue() ?? "";
}

interface CodeEditorProps {
  starterCode: string;
  exerciseId: string;
  onTrigger?: (payload: TriggerPayload) => void;
  onCursorChange?: (line: number, col: number) => void;
}

export default function CodeEditor({
  starterCode,
  exerciseId,
  onTrigger,
  onCursorChange,
}: CodeEditorProps) {
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const exerciseIdRef = useRef(exerciseId);
  exerciseIdRef.current = exerciseId;

  const disposeListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      disposeListenerRef.current?.();
      disposeListenerRef.current = null;
      pauseDetector.stop();
      editorInstance = null;
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
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
        const code = editor.getValue();
        const currentLine = editor.getPosition()?.lineNumber ?? 1;
        const payload = triggerSystem.onEnterPressed(
          code,
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

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue={starterCode}
        theme="lumiq-dark"
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
      />
    </div>
  );
}
