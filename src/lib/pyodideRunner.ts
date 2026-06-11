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

function pyodideBaseUrl(): string {
  if (typeof window === "undefined") return "/pyodide/";
  return `${window.location.origin}/pyodide/`;
}

let pyodideReady: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.getAttribute("data-loaded") === "true") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () =>
      reject(new Error("Không tải được Python runtime từ server."));
    document.head.appendChild(script);
  });
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReady) {
    const base = pyodideBaseUrl();
    pyodideReady = (async () => {
      await loadScript(`${base}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("Pyodide loader không khả dụng.");
      }
      return window.loadPyodide({ indexURL: base });
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
    const combined = [stdout, stderr].filter(Boolean).join("").trim();
    return {
      output: combined || "(chạy xong — không có output)",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const combined = [stdout, stderr].filter(Boolean).join("").trim();
    return { output: combined, error: message };
  }
}
