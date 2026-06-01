import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("feedback_log")
      .select("error_type");

    if (error) {
      console.error("[stats] query failed:", error.message);
      return NextResponse.json({
        totalFeedbackEntries: 0,
        errorTypeBreakdown: {},
      });
    }

    const errorTypeBreakdown: Record<string, number> = {};

    for (const row of data ?? []) {
      const key = row.error_type ?? "unknown";
      errorTypeBreakdown[key] = (errorTypeBreakdown[key] ?? 0) + 1;
    }

    return NextResponse.json({
      totalFeedbackEntries: data?.length ?? 0,
      errorTypeBreakdown,
    });
  } catch (err) {
    console.error("[stats] unexpected error:", (err as Error).message);
    return NextResponse.json({
      totalFeedbackEntries: 0,
      errorTypeBreakdown: {},
    });
  }
}
