import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d0d0d] px-6 text-center">
      <h1 className="font-mono text-[32px] font-bold text-white">Lumiq</h1>
      <p className="mt-3 font-mono text-[14px] font-normal text-[#555]">
        AI that watches how you think when you code.
      </p>
      <p className="mt-2 font-mono text-[12px] text-[#333]">
        Currently in private beta.
      </p>
      <Link
        href="/editor"
        className="mt-8 rounded border border-[#2a2a2a] bg-[#111] px-5 py-2.5 font-mono text-[13px] text-white hover:border-[#444]"
      >
        Start Coding →
      </Link>
    </main>
  );
}
