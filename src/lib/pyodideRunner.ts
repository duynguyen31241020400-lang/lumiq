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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Không tải được Pyodide"));
    document.head.appendChild(script);
  });
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReady) {
    pyodideReady = (async () => {
      await loadScript(`${CDN}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("Pyodide không khả dụng");
      }
      return window.loadPyodide({ indexURL: CDN });
    })();
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
    const combined = (stdout + stderr).trim();
    return {
      output: combined || "(chạy xong — không có output)",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const combined = (stdout + stderr).trim();
    return {
      output: combined,
      error: message,
    };
  }
}
