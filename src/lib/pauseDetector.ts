import { eventBuffer } from "@/src/lib/eventBuffer";

const PAUSE_THRESHOLD_MS = 3000;

export type PauseCallback = (line: number, durationMs: number) => void;

// ─── PauseDetector ────────────────────────────────────────────────────────────

export class PauseDetector {
  private onPause: PauseCallback;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastLine = 1;
  private lastKeystrokeAt = Date.now();

  constructor(onPause: PauseCallback) {
    this.onPause = onPause;
  }

  setCallback(fn: PauseCallback): void {
    this.onPause = fn;
  }

  recordKeystroke(line: number): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
    }

    this.lastLine = line;
    this.lastKeystrokeAt = Date.now();

    this.timerId = setTimeout(() => {
      this.timerId = null;
      const durationMs = Date.now() - this.lastKeystrokeAt;
      this.onPause(this.lastLine, durationMs);
    }, PAUSE_THRESHOLD_MS);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const pauseDetector = new PauseDetector((line, durationMs) => {
  eventBuffer.addEvent({
    type: "pause",
    line,
    col: 0,
    timestamp: Date.now(),
    durationMs,
  });
});
