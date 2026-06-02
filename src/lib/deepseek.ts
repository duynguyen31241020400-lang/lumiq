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

export async function generateSummary(sessionLog: FeedbackEntry[]): Promise<string> {
  const userMessage = JSON.stringify({ sessionLog });

  const summary = await callDeepseek(
    [
      {
        role: "system",
        content:
          "You are Lumiq Observer. Summarize a learner's full coding session from the feedback log. Identify persistent patterns, moments of insight, and where thinking broke down. You decide the format.",
      },
      { role: "user", content: userMessage },
    ],
    "deepseek-reasoner",
    30_000,
  );

  return summary;
}
