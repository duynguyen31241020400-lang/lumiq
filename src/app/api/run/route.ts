import path from "path";

import { NextRequest, NextResponse } from "next/server";

const MAX_CODE_LENGTH = 8_000;
const RUN_TIMEOUT_MS = 12_000;
const RATE_LIMIT_MS = 2_000;

const PYODIDE_DIR = path.join(process.cwd(), "node_modules", "pyodide") + path.sep;

const lastRunByKey = new Map<string, number>();

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (s: string) => void }) => void;
  setStderr: (options: { batched: (s: string) => void }) => void;
};

let pyodideReady: Promise<PyodideInterface> | null = null;

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      const { loadPyodide } = await import("pyodide");
      return loadPyodide({ indexURL: PYODIDE_DIR }) as Promise<PyodideInterface>;
    })();
  }
  return pyodideReady;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Code chạy quá lâu (timeout).")),
      ms,
    );
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

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const clientKey =
    req.headers.get("x-session-id") ??
    req.headers.get("x-forwarded-for") ??
    "anonymous";
  const now = Date.now();
  const lastRun = lastRunByKey.get(clientKey) ?? 0;

  if (now - lastRun < RATE_LIMIT_MS) {
    return NextResponse.json(
      { output: "", error: "Đợi 2 giây rồi chạy lại nhé." },
      { status: 429 },
    );
  }
  lastRunByKey.set(clientKey, now);

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ output: "", error: "Request không hợp lệ." });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ output: "", error: "Không có code để chạy." });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({
      output: "",
      error: "Code quá dài (tối đa 8000 ký tự).",
    });
  }

  try {
    const pyodide = await withTimeout(getPyodide(), 25_000);
    let stdout = "";
    let stderr = "";

    pyodide.setStdout({ batched: (text) => { stdout += text + "\n"; } });
    pyodide.setStderr({ batched: (text) => { stderr += text + "\n"; } });

    await withTimeout(pyodide.runPythonAsync(code), RUN_TIMEOUT_MS);

    const combined = [stdout, stderr].filter(Boolean).join("").trim();
    return NextResponse.json({
      output: combined || "(chạy xong — không có output)",
      error: null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không chạy được Python.";
    return NextResponse.json({
      output: "",
      error: message,
    });
  }
}
