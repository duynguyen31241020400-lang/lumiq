"use client";

import { useEffect, useState } from "react";
import type { StatsData } from "@/src/app/api/stats/route";

const ERROR_TYPE_COLORS: Record<string, string> = {
  concept_error: "#7B8CDE",
  syntax_habit: "#FFD166",
  logic_gap: "#EF476F",
  attention_slip: "#888888",
  missing_prerequisite: "#C084FC",
};

function SkeletonLoader() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d0d0d] px-6 py-12">
      <div className="w-full max-w-2xl space-y-12">
        <div className="space-y-1">
          <div className="h-4 w-64 animate-pulse rounded bg-[#1a1a1a]" />
        </div>

        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-2">
            <div className="h-12 w-24 animate-pulse rounded bg-[#1a1a1a]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
          <div className="space-y-2">
            <div className="h-12 w-24 animate-pulse rounded bg-[#1a1a1a]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
        </div>

        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-32 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-1 w-full animate-pulse rounded bg-[#1a1a1a]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const data = (await res.json()) as StatsData;
          setStats(data);
        }
      } catch {
        // silent fail — page still renders with skeleton
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <SkeletonLoader />;
  }

  if (!stats) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d0d0d]">
        <p className="font-mono text-[12px] text-[#555]">Unable to load stats</p>
      </main>
    );
  }

  const maxCount = Math.max(...stats.errorTypeBreakdown.map((e) => e.count), 1);

  return (
    <main className="flex min-h-screen flex-col bg-[#0d0d0d] px-6 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-12">
        {/* Header */}
        <h1 className="font-mono text-[11px] uppercase tracking-widest text-[#444]">
          Lumiq Observer · Research Data
        </h1>

        {/* Big Numbers */}
        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-2">
            <p className="font-mono text-[48px] font-bold text-white">
              {stats.totalObservations}
            </p>
            <p className="font-mono text-[12px] text-[#555]">observations</p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[48px] font-bold text-white">
              {stats.sessionsCompleted}
            </p>
            <p className="font-mono text-[12px] text-[#555]">sessions</p>
          </div>
        </div>

        {/* Error Type Breakdown */}
        <div className="space-y-4">
          {stats.errorTypeBreakdown.map((entry) => {
            const width = (entry.count / maxCount) * 100;
            return (
              <div key={entry.errorType} className="space-y-1">
                <p className="font-mono text-[11px] text-[#888]">
                  {entry.errorType}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div
                      className="h-1 rounded"
                      style={{
                        width: `${width}%`,
                        backgroundColor:
                          ERROR_TYPE_COLORS[entry.errorType] || "#666",
                      }}
                    />
                  </div>
                  <p className="font-mono text-[11px] text-[#555]">
                    {entry.count}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="border-t border-[#1a1a1a] pt-8 font-mono text-[10px] text-[#333]">
          Data collected via Lumiq Observer · lumiq-ai research instrument
        </p>
      </div>
    </main>
  );
}
