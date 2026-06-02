// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CodeEvents {
  keystrokeCount: number;
  pauseLocations: number[]; // character offsets where pauses occurred
  pauseDurations: number[]; // ms, parallel array to pauseLocations
  clickCount: number;
}

export interface FeedbackEntry {
  timestamp: number; // unix ms
  code: string;
  events: CodeEvents;
  errorType: string | null;
  feedbackText: string | null;
  shouldFlag: boolean;
}

export interface AnalyzeResult {
  errorType: string | null;
  feedbackText: string;
  shouldFlag: boolean;
}

// ─── Typed error ──────────────────────────────────────────────────────────────

export class DeepseekError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DeepseekError";
  }
}

// ─── Base fetch ───────────────────────────────────────────────────────────────

export async function callDeepseek(
  messages: Message[],
  model: "deepseek-chat" | "deepseek-reasoner",
  timeoutMs = 15_000,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepseekError(
      "DEEPSEEK_API_KEY is not set. Add it to your environment variables.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new DeepseekError("Deepseek API request timed out after 15s.");
    }
    // Log without the key
    console.error("[deepseek] fetch error:", (err as Error).message);
    throw new DeepseekError("Failed to reach Deepseek API.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[deepseek] HTTP ${response.status}:`, body);
    throw new DeepseekError(
      `Deepseek API returned ${response.status}.`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new DeepseekError("Unexpected response shape from Deepseek API.");
  }

  return text;
}

// ─── analyzeCode ──────────────────────────────────────────────────────────────

const OBSERVER_SYSTEM_PROMPT = `You are Lumiq Observer. You watch how someone thinks when they code, not just what they produce.

You receive: a Python code snapshot + behavioral data (keystroke count, pause locations, pause durations, click count).

Your job: identify if the learner is stuck due to a concept error, syntax habit, logic gap, attention slip, or missing prerequisite. Or confirm they are on track.

Rules:
- Do NOT give the answer. Ask a guiding question or point to the thinking error.
- Be direct. One sentence max for real-time feedback.
- If nothing is wrong, return shouldFlag: false and feedbackText: null.
- Scaffold level 1 (beginner): flag early, hint clearly. Level 2: ask guiding question. Level 3: only flag if stuck > 10 seconds.
- Respond ONLY in JSON: { "errorType": "concept_error|syntax_habit|logic_gap|attention_slip|missing_prerequisite|null", "feedbackText": "string or null", "shouldFlag": true|false }`;

export async function analyzeCode(params: {
  code: string;
  events: CodeEvents;
  scaffoldLevel: 1 | 2 | 3;
}): Promise<AnalyzeResult> {
  const { code, events, scaffoldLevel } = params;

  const userMessage = JSON.stringify({
    code,
    events,
    scaffoldLevel,
  });

  const raw = await callDeepseek(
    [
      { role: "system", content: OBSERVER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    "deepseek-chat",
  );

  // Strip markdown fences if the model wraps JSON in ```json ... ```
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();

  let parsed: AnalyzeResult;
  try {
    parsed = JSON.parse(cleaned) as AnalyzeResult;
  } catch {
    console.error("[deepseek] analyzeCode: could not parse JSON response:", cleaned);
    throw new DeepseekError("analyzeCode: model returned non-JSON output.");
  }

  return parsed;
}

// ─── generateSummary ──────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are Lumiq Observer summarizing a coding session. Your job is to give the learner a honest, specific, useful summary of how they think when they code — not generic encouragement.

You have access to: all AI observations from the session, error types flagged, how many triggers fired, total session duration, and which exercise they worked on.

Rules:
- Be direct. No fluff. No "great job!"
- Focus on PATTERNS, not individual mistakes
- Tell them ONE thing they should focus on next time
- If you have enough data, name the specific concept they're weak on
- If there were no flags, say so plainly: "No issues detected. Either you nailed it or the session was too short to observe."
- Format: your choice. Could be 2-3 sentences, could be 3 bullet points. Whatever fits the data.
- Max 100 words.`;

export async function generateSummary(params: {
  sessionLog: FeedbackEntry[];
  sessionDuration: number; // ms
  exerciseId: string;
  triggerCount: number;
  finalScaffoldLevel?: 1 | 2 | 3;
}): Promise<string> {
  const { sessionLog, sessionDuration, exerciseId, triggerCount, finalScaffoldLevel = 1 } =
    params;

  const flagCount = sessionLog.filter((e) => e.shouldFlag).length;
  const mins = Math.floor(sessionDuration / 60000);
  const secs = Math.round((sessionDuration % 60000) / 1000);
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const errorTypes = sessionLog
    .map((e) => e.errorType)
    .filter((e): e is string => !!e);
  const dominantErrorType = errorTypes.length > 0 ? errorTypes[0] : "none";

  const observations = sessionLog
    .filter((e) => e.feedbackText)
    .map((e) => `- [${e.errorType ?? "neutral"}] ${e.feedbackText}`)
    .join("\n");

  const userMessage = `Session: ${exerciseId}, ${durationStr}
Triggers fired: ${triggerCount}
AI flags: ${flagCount} out of ${triggerCount}

Observations:
${observations || "(no flagged observations)"}

Most common error type: ${dominantErrorType}
Scaffold level at end: ${finalScaffoldLevel}`;

  try {
    // Try deepseek-reasoner first with 25s timeout (fallback window)
    const summary = await callDeepseek(
      [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      "deepseek-reasoner",
      25_000,
    );
    return summary;
  } catch (err) {
    // Reasoner timed out or failed; fall back to chat
    console.error("[deepseek] generateSummary reasoner failed:", (err as Error).message);
    try {
      const summary = await callDeepseek(
        [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        "deepseek-chat",
        10_000,
      );
      return summary;
    } catch (chatErr) {
      console.error("[deepseek] generateSummary chat fallback also failed:", (chatErr as Error).message);
      return `Session complete. ${flagCount} observations logged.`;
    }
  }
}
