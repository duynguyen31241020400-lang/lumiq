import { NextResponse } from "next/server";

import { tryCreateClient } from "@/src/lib/supabase";

export async function GET() {
  const empty = {
    totalFeedbackEntries: 0,
    totalSessions: 0,
    errorTypeBreakdown: {} as Record<string, number>,
  };

  try {
    const supabase = tryCreateClient();
    if (!supabase) return NextResponse.json(empty);

    const [feedbackRes, sessionsRes] = await Promise.all([
      supabase.from("feedback_log").select("error_type"),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
    ]);

    if (feedbackRes.error) {
      console.error("[stats] feedback query failed:", feedbackRes.error.message);
    }

    const errorTypeBreakdown: Record<string, number> = {};
    for (const row of feedbackRes.data ?? []) {
      const key = row.error_type ?? "unknown";
      errorTypeBreakdown[key] = (errorTypeBreakdown[key] ?? 0) + 1;
    }

    return NextResponse.json({
      totalFeedbackEntries: feedbackRes.data?.length ?? 0,
      totalSessions: sessionsRes.count ?? 0,
      errorTypeBreakdown,
    });
  } catch (err) {
    console.error("[stats] unexpected error:", (err as Error).message);
    return NextResponse.json(empty);
  }
}
