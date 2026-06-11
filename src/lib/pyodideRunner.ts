"use client";

export async function runPythonCode(
  code: string,
  sessionId?: string,
): Promise<{ output: string; error: string | null }> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "x-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ code }),
  });

  const data = (await res.json()) as { output?: string; error?: string | null };

  if (res.status === 429) {
    return {
      output: "",
      error: data.error ?? "Chạy quá nhanh. Đợi vài giây.",
    };
  }

  return {
    output: typeof data.output === "string" ? data.output : "",
    error: data.error ?? null,
  };
}
