import { loader } from "@monaco-editor/react";

const MONACO_VERSION = "0.55.1";
const MONACO_VS = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

let configured = false;

export function configureMonacoLoader(): void {
  if (configured) return;
  configured = true;

  loader.config({
    paths: { vs: MONACO_VS },
  });
}

export async function initMonaco(): Promise<void> {
  configureMonacoLoader();
  await loader.init();
}
