"use client";

import Editor from "@monaco-editor/react";

const DEFAULT_VALUE = "# Start coding here\n";

export default function CodeEditor() {
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
      />
    </div>
  );
}
