import { NextResponse } from "next/server";

export interface StatsData {
  totalObservations: number;
  sessionsCompleted: number;
  errorTypeBreakdown: {
    errorType: string;
    count: number;
  }[];
}

export async function GET() {
  // Demo data for Demo Day
  // In production, query from Supabase sessions + feedback_log tables
  const stats: StatsData = {
    totalObservations: 847,
    sessionsCompleted: 156,
    errorTypeBreakdown: [
      { errorType: "concept_error", count: 284 },
      { errorType: "syntax_habit", count: 201 },
      { errorType: "logic_gap", count: 189 },
      { errorType: "attention_slip", count: 98 },
      { errorType: "missing_prerequisite", count: 75 },
    ],
  };

  return NextResponse.json(stats);
}
