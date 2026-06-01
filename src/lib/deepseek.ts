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
  feedbackText: string | null;
  shouldFlag: boolean;
}

export interface AnalyzeStats {
  totalKeystrokes: number;
  totalDeletes: number;
  pauseCount: number;
  clickCount: number;
  avgPauseDurationMs: number;
  pauseLines: number[];
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
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepseekError(
      "DEEPSEEK_API_KEY is not set. Add it to your environment variables.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

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

const OBSERVER_SYSTEM_PROMPT = `You are Lumiq Observer. You watch how someone thinks when they code Python, not just what they produce.

Analyze the code snapshot and behavioral data. Identify if the learner is stuck due to:
- concept_error: misunderstands what a construct does
- syntax_habit: keeps making the same small syntax mistake
- logic_gap: code structure won't achieve what they intend
- attention_slip: small careless error (missing colon, wrong indent)
- missing_prerequisite: needs to understand something else first

Scaffold rules:
- Level 1 (beginner): Flag early. Give a clear hint. Max 1 sentence.
- Level 2 (intermediate): Ask a guiding question instead of giving the answer.
- Level 3 (advanced): Only comment if they've been pausing for a long time. Be very brief.

If nothing is wrong or there's not enough code yet, return shouldFlag: false.

Respond ONLY in valid JSON — no markdown, no explanation outside JSON:
{ "errorType": "concept_error|syntax_habit|logic_gap|attention_slip|missing_prerequisite|null", "feedbackText": "one sentence max, or null", "shouldFlag": true|false }`;

function buildAnalyzeUserMessage(params: {
  code: string;
  scaffoldLevel: 1 | 2 | 3;
  triggerType: "newline" | "run";
  triggerCount: number;
  stats: AnalyzeStats;
}): string {
  const { code, scaffoldLevel, triggerType, triggerCount, stats } = params;
  return `Scaffold level: ${scaffoldLevel}
Trigger: ${triggerType} (trigger #${triggerCount})

Behavioral data:
- Keystrokes: ${stats.totalKeystrokes}, Deletes: ${stats.totalDeletes}
- Pauses: ${stats.pauseCount} pauses, avg ${Math.round(stats.avgPauseDurationMs)}ms
- Pause locations (lines): ${JSON.stringify(stats.pauseLines)}
- Clicks: ${stats.clickCount}

Code snapshot:
${code}`;
}

function parseAnalyzeResult(raw: string): AnalyzeResult {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as AnalyzeResult;
    return {
      errorType: parsed.errorType ?? null,
      feedbackText: parsed.feedbackText ?? null,
      shouldFlag: Boolean(parsed.shouldFlag),
    };
  } catch {
    console.error("[deepseek] analyzeCode: could not parse JSON response:", cleaned);
    return { errorType: null, feedbackText: null, shouldFlag: false };
  }
}

export async function analyzeCode(params: {
  code: string;
  scaffoldLevel: 1 | 2 | 3;
  triggerType: "newline" | "run";
  triggerCount: number;
  stats: AnalyzeStats;
}): Promise<AnalyzeResult> {
  const raw = await callDeepseek(
    [
      { role: "system", content: OBSERVER_SYSTEM_PROMPT },
      { role: "user", content: buildAnalyzeUserMessage(params) },
    ],
    "deepseek-chat",
  );

  return parseAnalyzeResult(raw);
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
  );

  return summary;
}
