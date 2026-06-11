import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pyodide");
const dest = path.join(root, "public", "pyodide");

const files = [
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide.js",
  "pyodide.mjs",
  "pyodide-lock.json",
];

if (!existsSync(src)) {
  console.warn("[copy-pyodide] pyodide not installed, skipping");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

for (const file of files) {
  const from = path.join(src, file);
  if (existsSync(from)) {
    cpSync(from, path.join(dest, file));
  }
}

console.log("[copy-pyodide] copied pyodide runtime to public/pyodide");
