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
  onTrigger?: (payload: TriggerPayload) => void;
}

export default function CodeEditor({ starterCode, onTrigger }: CodeEditorProps) {
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const disposeListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      disposeListenerRef.current?.();
      disposeListenerRef.current = null;
      pauseDetector.stop();
      editorInstance = null;
    };
  }, []);

  const handleMount: OnMount = (editor) => {
    editorInstance = editor;
    disposeListenerRef.current?.();

    let previousLine = editor.getPosition()?.lineNumber ?? 1;

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
        const payload = triggerSystem.onEnterPressed(code, currentLine);
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
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
        }}
        onMount={handleMount}
      />
    </div>
  );
}
