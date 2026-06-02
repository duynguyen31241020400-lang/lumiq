import { NextRequest, NextResponse } from "next/server";
import { generateSummary } from "@/src/lib/deepseek";
import { createClient } from "@/src/lib/supabase";
import type { FeedbackEntry } from "@/src/lib/deepseek";

interface FeedbackHistoryEntry {
  timestamp: number;
  errorType: string | null;
  feedbackText: string | null;
  shouldFlag: boolean;
}

interface SummaryPayload {
  sessionId: string;
  exerciseId: string;
  triggerCount: number;
  sessionDuration: number; // ms
  feedbackHistory: FeedbackHistoryEntry[];
}

function mostFrequent(items: (string | null)[]): string | null {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item) counts[item] = (counts[item] ?? 0) + 1;
  }
  let top: string | null = null;
  let max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) {
      max = v;
      top = k;
    }
  }
  return top;
}

async function updateSession(
  sessionId: string,
  triggerCount: number,
  dominantErrorType: string | null,
  summaryText: string,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    await supabase.from("sessions").upsert(
      {
        id: sessionId,
        ended_at: new Date().toISOString(),
        total_triggers: triggerCount,
        dominant_error_type: dominantErrorType,
        summary_text: summaryText,
      },
      { onConflict: "id" },
    );
  } catch {
    // silent fail
  }
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as SummaryPayload;
  const { sessionId, exerciseId, triggerCount, sessionDuration, feedbackHistory } =
    payload;

  const flaggedCount = feedbackHistory.filter((e) => e.shouldFlag).length;
  const dominantErrorType = mostFrequent(feedbackHistory.map((e) => e.errorType));

  const sessionLog: FeedbackEntry[] = feedbackHistory.map((e) => ({
    timestamp: e.timestamp,
    code: "",
    events: {
      keystrokeCount: 0,
      pauseLocations: [],
      pauseDurations: [],
      clickCount: 0,
    },
    errorType: e.errorType,
    feedbackText: e.feedbackText,
    shouldFlag: e.shouldFlag,
  }));

  let summaryText: string;
  try {
    summaryText =
      sessionLog.length > 0
        ? await generateSummary(sessionLog)
        : `You completed ${exerciseId} with ${triggerCount} AI observations.`;
  } catch {
    summaryText = `You completed ${exerciseId} with ${triggerCount} AI observations.`;
  }

  void updateSession(sessionId, triggerCount, dominantErrorType, summaryText);

  const totalSec = Math.round(sessionDuration / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;

  return NextResponse.json({
    summaryText,
    stats: {
      triggerCount,
      flaggedCount,
      topErrorType: dominantErrorType,
      sessionDuration: { mins, secs },
    },
    exerciseId,
  });
}
