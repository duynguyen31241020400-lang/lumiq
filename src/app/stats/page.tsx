"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface StatsData {
  totalFeedbackEntries: number;
  totalSessions: number;
  errorTypeBreakdown: Record<string, number>;
}

const ERROR_COLORS: Record<string, string> = {
  concept_error: "#7B8CDE",
  syntax_habit: "#FFD166",
  logic_gap: "#EF476F",
  attention_slip: "#888888",
  missing_prerequisite: "#C084FC",
  unknown: "#555555",
};

function formatLabel(key: string): string {
  return key.replace(/_/g, " ");
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: StatsData) => setStats(data))
      .catch(() =>
        setStats({
          totalFeedbackEntries: 0,
          totalSessions: 0,
          errorTypeBreakdown: {},
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const breakdown = stats?.errorTypeBreakdown ?? {};
  const maxCount = Math.max(1, ...Object.values(breakdown));

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-12">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="font-mono text-[11px] text-[#333] hover:text-[#555]"
        >
          ← Lumiq
        </Link>

        <h1 className="mt-6 font-mono text-[20px] text-[#e8e8e8]">
          Research Data
        </h1>
        <p className="mt-2 font-sans text-[13px] text-[#555]">
          Insights collected from coding observation sessions.
        </p>

        {loading ? (
          <p className="mt-12 font-mono text-[12px] italic text-[#333]">
            Loading...
          </p>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] p-4">
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  Insights
                </p>
                <p className="mt-2 font-mono text-[32px] text-[#e8e8e8]">
                  {stats?.totalFeedbackEntries ?? 0}
                </p>
              </div>
              <div className="rounded-md border-[0.5px] border-[#2a2a2a] bg-[#141414] p-4">
                <p className="font-mono text-[10px] uppercase text-[#555]">
                  Sessions
                </p>
                <p className="mt-2 font-mono text-[32px] text-[#e8e8e8]">
                  {stats?.totalSessions ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-10 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
                Error type breakdown
              </p>
              {Object.keys(breakdown).length === 0 ? (
                <p className="font-mono text-[12px] italic text-[#333]">
                  No data yet. Run a session first.
                </p>
              ) : (
                Object.entries(breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type}>
                      <div className="mb-1 flex justify-between font-mono text-[11px]">
                        <span className="text-[#999]">{formatLabel(type)}</span>
                        <span className="text-[#555]">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor:
                              ERROR_COLORS[type] ?? ERROR_COLORS.unknown,
                          }}
                        />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
