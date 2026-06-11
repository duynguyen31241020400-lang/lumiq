import { NextRequest, NextResponse } from "next/server";

import {
  generateSummary,
  hasDeepseekKey,
  type SessionFeedbackEntry,
} from "@/src/lib/deepseek";
import { tryCreateClient } from "@/src/lib/supabase";

interface SummaryRequestBody {
  sessionId: string;
  exerciseId: string;
  exerciseTitle: string;
  feedbackHistory: SessionFeedbackEntry[];
  triggerCount: number;
  sessionStartedAt: number;
  scaffoldLevel: 1 | 2 | 3;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function dominantErrorType(
  history: SessionFeedbackEntry[],
): string | null {
  const counts: Record<string, number> = {};
  for (const entry of history) {
    if (!entry.errorType) continue;
    counts[entry.errorType] = (counts[entry.errorType] ?? 0) + 1;
  }
  let top: string | null = null;
  let max = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      top = type;
    }
  }
  return top;
}

async function saveSessionEnd(
  sessionId: string,
  body: SummaryRequestBody,
  summaryText: string,
  dominant: string | null,
): Promise<void> {
  try {
    const supabase = tryCreateClient();
    if (!supabase) return;

    await supabase.from("sessions").upsert(
      {
        id: sessionId,
        exercise_id: body.exerciseId,
        ended_at: new Date().toISOString(),
        total_triggers: body.triggerCount,
        dominant_error_type: dominant,
        summary_text: summaryText,
      },
      { onConflict: "id" },
    );
  } catch {
    // silent
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: SummaryRequestBody;
  try {
    body = (await req.json()) as SummaryRequestBody;
  } catch {
    return NextResponse.json({
      status: "failed",
      summary: null,
      stats: null,
    });
  }

  const feedbackHistory = body.feedbackHistory ?? [];
  const flagCount = feedbackHistory.length;
  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - (body.sessionStartedAt ?? Date.now())) / 60_000),
  );
  const dominant = dominantErrorType(feedbackHistory);

  const stats = {
    triggerCount: body.triggerCount ?? 0,
    flagCount,
    dominantErrorType: dominant,
    durationMinutes,
    scaffoldLevel: body.scaffoldLevel ?? 1,
  };

  function buildFallbackSummary(): string {
    if (flagCount === 0) {
      return "Không phát hiện vấn đề — bạn làm tốt hoặc phiên quá ngắn để quan sát.";
    }
    const highlights = feedbackHistory
      .slice(0, 3)
      .map((e) => e.feedbackText)
      .filter(Boolean)
      .join(" ");
    return `Phiên có ${flagCount} phát hiện. ${highlights || "Xem lại các gợi ý Lumiq đã đưa trong lúc code."}`;
  }

  let summary: string | null = null;

  if (hasDeepseekKey()) {
    try {
      summary = await generateSummary(feedbackHistory, {
        exerciseTitle: body.exerciseTitle ?? "Exercise",
        triggerCount: body.triggerCount ?? 0,
        flagCount,
        durationMinutes,
      });
    } catch {
      summary = null;
    }
  }

  if (!summary) {
    summary = buildFallbackSummary();
  }

  if (isUuid(body.sessionId)) {
    saveSessionEnd(body.sessionId, body, summary, dominant).catch(() => {});
  }

  return NextResponse.json({
    status: "ready",
    summary,
    stats,
    latencyMs: Date.now() - startedAt,
  });
}
