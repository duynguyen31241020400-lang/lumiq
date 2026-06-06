import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
      <h1 className="font-mono text-[32px] font-bold tracking-tight text-[#e8e8e8]">
        Lumiq
      </h1>
      <p className="mt-4 max-w-md font-sans text-[14px] text-[#999]">
        AI that watches how you think when you code.
      </p>
      <p className="mt-2 font-mono text-[12px] text-[#333]">Private beta.</p>
      <Link
        href="/editor"
        className="mt-10 rounded border-[0.5px] border-[#2a2a2a] bg-[#141414] px-6 py-2.5 font-mono text-[13px] text-[#E8E0D0] transition-colors hover:border-[#444]"
      >
        Start Coding →
      </Link>

      <footer className="absolute bottom-6">
        <Link
          href="/stats"
          className="font-mono text-[11px] text-[#333] hover:text-[#555]"
        >
          Research data →
        </Link>
      </footer>
    </main>
  );
}
