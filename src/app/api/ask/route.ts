import { NextRequest, NextResponse } from "next/server";

import {
  askLumiq,
  DeepseekError,
  hasDeepseekKey,
  type AskFeedbackHistoryItem,
  type AskSessionStats,
} from "@/src/lib/deepseek";

const RATE_LIMIT_MS = 5_000;
const ASK_TIMEOUT_MS = 15_000;

const lastAskBySession = new Map<string, number>();

const FALLBACK_ANSWER = "Lumiq đang bận suy nghĩ. Thử lại sau nhé.";

interface AskRequestBody {
  question: string;
  code: string;
  feedbackHistory: AskFeedbackHistoryItem[];
  sessionStats: AskSessionStats;
  exerciseId: string;
}

function isValidBody(body: unknown): body is AskRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const stats = b.sessionStats as Record<string, unknown> | undefined;
  return (
    typeof b.question === "string" &&
    b.question.trim().length > 0 &&
    typeof b.code === "string" &&
    typeof b.exerciseId === "string" &&
    Array.isArray(b.feedbackHistory) &&
    !!stats &&
    typeof stats.triggerCount === "number" &&
    typeof stats.flagCount === "number" &&
    (stats.dominantErrorType === null ||
      typeof stats.dominantErrorType === "string")
  );
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
  const lastRequest = lastAskBySession.get(sessionId) ?? 0;

  if (now - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json({ answer: FALLBACK_ANSWER });
  }

  lastAskBySession.set(sessionId, now);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ answer: FALLBACK_ANSWER });
  }

  if (!isValidBody(body)) {
    return NextResponse.json({ answer: FALLBACK_ANSWER });
  }

  if (!hasDeepseekKey()) {
    return NextResponse.json({ answer: FALLBACK_ANSWER });
  }

  try {
    const answer = await withTimeout(
      askLumiq({
        question: body.question.trim(),
        code: body.code,
        feedbackHistory: body.feedbackHistory,
        sessionStats: body.sessionStats,
        exerciseId: body.exerciseId,
      }),
      ASK_TIMEOUT_MS,
    );

    return NextResponse.json({
      answer: answer.trim() || FALLBACK_ANSWER,
    });
  } catch (err) {
    if (err instanceof DeepseekError) {
      console.error("[ask] deepseek error:", err.message);
    } else if (err instanceof Error && err.message === "timeout") {
      console.error("[ask] timeout");
    } else {
      console.error("[ask] unexpected error:", (err as Error).message);
    }
    return NextResponse.json({ answer: FALLBACK_ANSWER });
  }
}
