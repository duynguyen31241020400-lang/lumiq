// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CodeEvents {
  keystrokeCount: number;
  pauseLocations: number[];
  pauseDurations: number[];
  clickCount: number;
}

export interface FeedbackEntry {
  timestamp: number;
  code: string;
  events: CodeEvents;
  errorType: string | null;
  feedbackText: string | null;
  shouldFlag: boolean;
}

export interface SessionFeedbackEntry {
  errorType: string | null;
  feedbackText: string | null;
  timestamp: number;
  triggerType: "newline" | "run";
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

export interface SummaryContext {
  exerciseTitle: string;
  triggerCount: number;
  flagCount: number;
  durationMinutes: number;
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

export function hasDeepseekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
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
      throw new DeepseekError("Deepseek API request timed out.");
    }
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

Never give the full answer. One sentence max.

Trả lời feedbackText bằng tiếng Việt, ngắn gọn, tự nhiên. Tối đa 1 câu. Ví dụ thay vì "You confused elif with a standalone statement" hãy nói "Bạn đang nhầm elif là câu lệnh độc lập — nó phải đi kèm với if trước đó."

Respond ONLY in valid JSON — no markdown, no explanation outside JSON:
{ "errorType": "concept_error|syntax_habit|logic_gap|attention_slip|missing_prerequisite|null", "feedbackText": "one sentence max in Vietnamese, or null", "shouldFlag": true|false }`;

function buildAnalyzeUserMessage(params: {
  code: string;
  scaffoldLevel: 1 | 2 | 3;
  triggerType: "newline" | "run";
  triggerCount: number;
  stats: AnalyzeStats;
  exerciseTitle?: string;
  exerciseDescription?: string;
  targetConcepts?: string[];
}): string {
  const { code, scaffoldLevel, triggerType, triggerCount, stats } = params;
  const exerciseBlock = params.exerciseTitle
    ? `\nExercise: ${params.exerciseTitle}
Description: ${params.exerciseDescription ?? ""}
Target concepts: ${JSON.stringify(params.targetConcepts ?? [])}`
    : "";

  return `Scaffold level: ${scaffoldLevel}
Trigger: ${triggerType} (trigger #${triggerCount})${exerciseBlock}

Behavioral data:
- Keystrokes: ${stats.totalKeystrokes}, Deletes: ${stats.totalDeletes}
- Pauses: ${stats.pauseCount} pauses, avg ${Math.round(stats.avgPauseDurationMs)}ms
- Pause locations (lines): ${JSON.stringify(stats.pauseLines)}
- Clicks: ${stats.clickCount}

Code snapshot:
${code}`;
}

function parseAnalyzeResult(raw: string): AnalyzeResult {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();

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
  exerciseTitle?: string;
  exerciseDescription?: string;
  targetConcepts?: string[];
}): Promise<AnalyzeResult> {
  const raw = await callDeepseek(
    [
      { role: "system", content: OBSERVER_SYSTEM_PROMPT },
      { role: "user", content: buildAnalyzeUserMessage(params) },
    ],
    "deepseek-chat",
    10_000,
  );

  return parseAnalyzeResult(raw);
}

// ─── generateSummary ──────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `Bạn là Lumiq Observer đang tổng kết một phiên lập trình. Hãy đưa ra nhận xét thật thà, cụ thể, hữu ích về cách người học tư duy khi code — không phải lời khen chung chung.
Tập trung vào PATTERN, không phải lỗi đơn lẻ. Chỉ ra MỘT điều họ cần cải thiện lần sau. Nếu không có flag: "Không phát hiện vấn đề — bạn làm tốt hoặc phiên quá ngắn để quan sát." Format tự chọn (2-3 câu hoặc 3 gạch đầu dòng). Tối đa 100 từ. Không nói "giỏi lắm" hay "cố lên".`;

const FALLBACK_SUMMARY =
  "Bạn đã làm bài với vài lần dừng lại để suy nghĩ. Xem lại những chỗ bạn pause — đó là nơi tư duy chậm lại. Thử bài tiếp theo, tập trung một khái niệm mỗi lần.";

const ASK_SYSTEM_PROMPT = `Bạn là Lumiq — một AI quan sát cách lập trình viên tư duy khi code, không chỉ kết quả cuối.

Người dùng đang hỏi bạn một câu hỏi về code của họ. Bạn có thể thấy code hiện tại, lịch sử các quan sát trong phiên làm việc này, và số liệu hành vi (số lần trigger, số lần flag, loại lỗi phổ biến nhất).

Nguyên tắc trả lời:
- Trả lời bằng tiếng Việt, tự nhiên, như một người thầy hiểu học sinh của mình
- KHÔNG đưa đáp án trực tiếp. Hướng dẫn cách suy nghĩ đúng.
- Tham chiếu cụ thể vào code của họ khi có thể
- Nếu câu hỏi liên quan đến lỗi mà Lumiq đã từng flag trong phiên này, nhắc lại pattern đó
- Ngắn gọn: tối đa 3-4 câu
- Nếu câu hỏi quá chung chung (không liên quan code), nói "Hãy hỏi về code bạn đang viết — tôi đang theo dõi đó."`;

export interface AskSessionStats {
  triggerCount: number;
  flagCount: number;
  dominantErrorType: string | null;
}

export interface AskFeedbackHistoryItem {
  errorType: string | null;
  feedbackText: string | null;
  timestamp: number;
}

function buildFeedbackHistorySummary(
  history: AskFeedbackHistoryItem[],
): string {
  if (history.length === 0) return "Chưa có quan sát nào trong phiên này.";
  return history
    .map((entry, i) => {
      const type = entry.errorType ?? "không xác định";
      const text = entry.feedbackText ?? "";
      return `${i + 1}. [${type}] ${text}`;
    })
    .join("\n");
}

function buildAskUserMessage(params: {
  question: string;
  code: string;
  feedbackHistory: AskFeedbackHistoryItem[];
  sessionStats: AskSessionStats;
  exerciseId: string;
}): string {
  const { question, code, feedbackHistory, sessionStats, exerciseId } = params;
  const dominant = sessionStats.dominantErrorType ?? "không có";

  return `Bài tập hiện tại: ${exerciseId}
Code hiện tại:
${code}

Lịch sử quan sát phiên này:
${buildFeedbackHistorySummary(feedbackHistory)}
Thống kê: ${sessionStats.triggerCount} lần phân tích, ${sessionStats.flagCount} lần flag, lỗi phổ biến: ${dominant}

Câu hỏi: ${question}`;
}

export async function askLumiq(params: {
  question: string;
  code: string;
  feedbackHistory: AskFeedbackHistoryItem[];
  sessionStats: AskSessionStats;
  exerciseId: string;
}): Promise<string> {
  return callDeepseek(
    [
      { role: "system", content: ASK_SYSTEM_PROMPT },
      { role: "user", content: buildAskUserMessage(params) },
    ],
    "deepseek-chat",
    15_000,
  );
}

export async function generateSummary(
  sessionLog: SessionFeedbackEntry[],
  context: SummaryContext,
): Promise<string> {
  const userMessage = JSON.stringify({ sessionLog, context });

  try {
    return await callDeepseek(
      [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      "deepseek-reasoner",
      25_000,
    );
  } catch {
    try {
      return await callDeepseek(
        [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        "deepseek-chat",
        15_000,
      );
    } catch {
      return FALLBACK_SUMMARY;
    }
  }
}
