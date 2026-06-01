import CodeEditor from "@/src/components/CodeEditor";

export default function EditorPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d0d]">
      <header className="grid h-10 shrink-0 grid-cols-3 items-center border-b border-[#1e1e1e] bg-[#111] px-4">
        <span className="font-mono text-[13px] text-white">Lumiq</span>
        <span className="text-center font-mono text-[12px] text-[#555]">
          exercise_01 — conditional.py
        </span>
        <div className="flex justify-end">
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
          <CodeEditor />
        </div>

        <aside className="sidebar flex h-full w-[35%] flex-col overflow-hidden border-l-[0.5px] border-[#1e1e1e] bg-[#0f0f0f]">
          <div className="shrink-0 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-[#444]">
            AI Observer
          </div>
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-[12px] italic text-[#333]">
              Start coding. Lumiq will watch.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
