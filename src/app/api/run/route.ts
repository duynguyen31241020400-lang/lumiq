import { existsSync, mkdirSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

const MAX_CODE_LENGTH = 8_000;
const RUN_TIMEOUT_MS = 12_000;
const RATE_LIMIT_MS = 2_000;
const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_FILES = [
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

const lastRunByKey = new Map<string, number>();

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (s: string) => void }) => void;
  setStderr: (options: { batched: (s: string) => void }) => void;
};

let pyodideDirReady: Promise<string> | null = null;
let pyodideReady: Promise<PyodideInterface> | null = null;

function localPyodideCandidates(): string[] {
  return [
    path.join(process.cwd(), "public", "pyodide"),
    path.join(process.cwd(), "node_modules", "pyodide"),
  ];
}

async function downloadPyodideTo(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (const file of PYODIDE_FILES) {
    const dest = path.join(dir, file);
    if (existsSync(dest)) continue;
    const res = await fetch(`${PYODIDE_CDN}${file}`);
    if (!res.ok) {
      throw new Error(`Không tải được ${file} từ CDN.`);
    }
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
}

async function ensurePyodideDir(): Promise<string> {
  for (const dir of localPyodideCandidates()) {
    if (existsSync(path.join(dir, "pyodide.asm.js"))) {
      return dir + path.sep;
    }
  }

  const tmpDir = path.join(os.tmpdir(), "lumiq-pyodide");
  if (!existsSync(path.join(tmpDir, "pyodide.asm.js"))) {
    await downloadPyodideTo(tmpDir);
  }
  return tmpDir + path.sep;
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      if (!pyodideDirReady) {
        pyodideDirReady = ensurePyodideDir();
      }
      const indexURL = await pyodideDirReady;
      const { loadPyodide } = await import("pyodide");
      return loadPyodide({ indexURL }) as Promise<PyodideInterface>;
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
export const maxDuration = 60;

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
    const pyodide = await withTimeout(getPyodide(), 45_000);
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
    pyodideReady = null;
    pyodideDirReady = null;
    const message =
      err instanceof Error ? err.message : "Không chạy được Python.";
    return NextResponse.json({
      output: "",
      error: message,
    });
  }
}
