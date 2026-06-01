import { NextRequest, NextResponse } from "next/server";

import {
  analyzeCode,
  DeepseekError,
  type AnalyzeResult,
  type AnalyzeStats,
} from "@/src/lib/deepseek";
import { createClient } from "@/src/lib/supabase";

const RATE_LIMIT_MS = 8_000;
const ANALYZE_TIMEOUT_MS = 10_000;

const lastRequestBySession = new Map<string, number>();

interface AnalyzeRequestBody {
  code: string;
  triggerType: "newline" | "run";
  stats: AnalyzeStats;
  scaffoldLevel: 1 | 2 | 3;
  triggerCount: number;
}

type AnalyzeResponse = AnalyzeResult & {
  latencyMs: number;
  error?: "timeout" | "api_error";
};

function emptyResult(
  latencyMs: number,
  error?: AnalyzeResponse["error"],
): AnalyzeResponse {
  return {
    errorType: null,
    feedbackText: null,
    shouldFlag: false,
    latencyMs,
    ...(error ? { error } : {}),
  };
}

function isValidBody(body: unknown): body is AnalyzeRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const stats = b.stats as Record<string, unknown> | undefined;
  return (
    typeof b.code === "string" &&
    (b.triggerType === "newline" || b.triggerType === "run") &&
    (b.scaffoldLevel === 1 || b.scaffoldLevel === 2 || b.scaffoldLevel === 3) &&
    typeof b.triggerCount === "number" &&
    !!stats &&
    typeof stats.totalKeystrokes === "number" &&
    typeof stats.totalDeletes === "number" &&
    typeof stats.pauseCount === "number" &&
    typeof stats.clickCount === "number" &&
    typeof stats.avgPauseDurationMs === "number" &&
    Array.isArray(stats.pauseLines)
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function saveToSupabase(
  sessionId: string,
  payload: AnalyzeRequestBody,
  result: AnalyzeResult,
): Promise<void> {
  try {
    const supabase = createClient();
    const snapshotId = crypto.randomUUID();

    const { error } = await supabase.from("feedback_log").insert({
      session_id: sessionId,
      snapshot_id: snapshotId,
      error_type: result.errorType,
      feedback_text: result.feedbackText,
      scaffold_level_at_time: payload.scaffoldLevel,
    });

    if (error) {
      console.error("[analyze] supabase insert failed:", error.message);
    }
  } catch (err) {
    console.error(
      "[analyze] saveToSupabase error:",
      (err as Error).message,
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(req: NextRequest) {
  const sessionId = req.headers.get("x-session-id") ?? "anonymous";
  const now = Date.now();
  const lastRequest = lastRequestBySession.get(sessionId) ?? 0;

  if (now - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "too_soon", retryAfter: 8 },
      { status: 429 },
    );
  }

  lastRequestBySession.set(sessionId, now);
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(emptyResult(Date.now() - startedAt));
  }

  if (!isValidBody(body)) {
    return NextResponse.json(emptyResult(Date.now() - startedAt));
  }

  try {
    const result = await withTimeout(
      analyzeCode({
        code: body.code,
        scaffoldLevel: body.scaffoldLevel,
        triggerType: body.triggerType,
        triggerCount: body.triggerCount,
        stats: body.stats,
      }),
      ANALYZE_TIMEOUT_MS,
    );

    if (result.shouldFlag && result.errorType && isUuid(sessionId)) {
      saveToSupabase(sessionId, body, result).catch(() => {
        // Silently fail — data loss is acceptable, demo crash is not
      });
    }

    return NextResponse.json({
      errorType: result.errorType,
      feedbackText: result.feedbackText,
      shouldFlag: result.shouldFlag,
      latencyMs: Date.now() - startedAt,
    } satisfies AnalyzeResponse);
  } catch (err) {
    const latencyMs = Date.now() - startedAt;

    if (err instanceof Error && err.message === "timeout") {
      return NextResponse.json(emptyResult(latencyMs, "timeout"));
    }

    if (err instanceof DeepseekError) {
      const isTimeout =
        err.message.includes("timed out") || err.message.includes("timeout");
      return NextResponse.json(
        emptyResult(latencyMs, isTimeout ? "timeout" : "api_error"),
      );
    }

    console.error("[analyze] unexpected error:", (err as Error).message);
    return NextResponse.json(emptyResult(latencyMs, "api_error"));
  }
}
