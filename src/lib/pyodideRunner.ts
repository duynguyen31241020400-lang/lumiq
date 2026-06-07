"use client";

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (s: string) => void }) => void;
  setStderr: (options: { batched: (s: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_VERSION = "0.26.4";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodideReady: Promise<PyodideInterface> | null = null;
let pyodideError: string | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Không tải được Pyodide")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("Không tải được Pyodide từ CDN"));
    document.head.appendChild(script);
  });
}

export function getPyodideError(): string | null {
  return pyodideError;
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideError) {
    throw new Error(pyodideError);
  }

  if (!pyodideReady) {
    pyodideReady = (async () => {
      await loadScript(`${CDN}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("Pyodide script loaded nhưng loadPyodide không có");
      }
      return window.loadPyodide({ indexURL: CDN });
    })().catch((err) => {
      pyodideReady = null;
      pyodideError =
        err instanceof Error ? err.message : "Không khởi tạo được Pyodide";
      throw new Error(pyodideError);
    });
  }

  return pyodideReady;
}

export async function runPythonCode(
  code: string,
): Promise<{ output: string; error: string | null }> {
  const pyodide = await getPyodide();
  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (text) => { stdout += text; } });
  pyodide.setStderr({ batched: (text) => { stderr += text; } });

  try {
    await pyodide.runPythonAsync(code);
    const combined = [stdout, stderr].filter(Boolean).join("").trim();
    return {
      output: combined || "(chạy xong — không có output)",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const combined = [stdout, stderr].filter(Boolean).join("").trim();
    return {
      output: combined,
      error: message,
    };
  }
}
