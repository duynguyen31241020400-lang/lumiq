import {
  eventBuffer,
  type CodeEvent,
  type EventStats,
} from "@/src/lib/eventBuffer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventBufferStats = EventStats;

export type TriggerType = "newline" | "run";

export interface TriggerPayload {
  code: string;
  triggerType: TriggerType;
  events: CodeEvent[];
  stats: EventBufferStats;
  triggeredAt: number;
  triggerCount: number;
}

// ─── Boundary detection ───────────────────────────────────────────────────────

const BLOCK_START_RE = /^(def |class |if |for |while |elif |else:)/;

export function detectFunctionBoundary(
  code: string,
  currentLine: number,
): boolean {
  const lines = code.split("\n");
  const lineIndex = currentLine - 1;
  const current = lines[lineIndex] ?? "";
  const trimmed = current.trim();

  if (BLOCK_START_RE.test(trimmed)) {
    return true;
  }

  for (let i = lineIndex - 1; i >= 0; i--) {
    const prev = lines[i]?.trim() ?? "";
    if (prev === "") continue;

    if (prev.endsWith(":") && trimmed.length > 0) {
      const indent = current.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent > 0) return true;
    }
    break;
  }

  return false;
}

// ─── TriggerSystem ────────────────────────────────────────────────────────────

class TriggerSystem {
  private buildPayload(
    code: string,
    triggerType: TriggerType,
  ): TriggerPayload {
    const events = eventBuffer.getEvents();
    const stats = eventBuffer.getStats();
    eventBuffer.clear();
    eventBuffer.incrementTrigger();

    return {
      code,
      triggerType,
      events,
      stats,
      triggeredAt: Date.now(),
      triggerCount: eventBuffer.getTriggerCount(),
    };
  }

  onEnterPressed(code: string, currentLine: number): TriggerPayload | null {
    if (!detectFunctionBoundary(code, currentLine)) {
      return null;
    }
    return this.buildPayload(code, "newline");
  }

  onRunPressed(code: string): TriggerPayload {
    return this.buildPayload(code, "run");
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const triggerSystem = new TriggerSystem();
