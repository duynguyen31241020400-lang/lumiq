import { NextRequest, NextResponse } from "next/server";
import { analyzeCode } from "@/src/lib/deepseek";
import { createClient } from "@/src/lib/supabase";
import type { CodeEvents } from "@/src/lib/deepseek";

interface TriggerPayload {
  sessionId: string;
  exerciseId: string;
  code: string;
  scaffoldLevel: 1 | 2 | 3;
  events: CodeEvents;
}

async function saveToSupabase(
  payload: TriggerPayload,
  result: { errorType: string | null; feedbackText: string; shouldFlag: boolean },
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    await supabase.from("sessions").upsert(
      {
        id: payload.sessionId,
        user_id: null as unknown as string, // demo mode: no auth yet
        exercise_id: payload.exerciseId ?? "unknown",
        started_at: new Date().toISOString(),
        total_triggers: 1,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    await supabase.from("feedback_log").insert({
      session_id: payload.sessionId,
      snapshot_id: null,
      error_type: result.errorType,
      feedback_text: result.feedbackText,
      scaffold_level_at_time: payload.scaffoldLevel,
    });
  } catch {
    // silent fail — demo must not crash
  }
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as TriggerPayload;

  const result = await analyzeCode({
    code: payload.code,
    events: payload.events,
    scaffoldLevel: payload.scaffoldLevel,
  });

  void saveToSupabase(payload, result);

  return NextResponse.json(result);
}
