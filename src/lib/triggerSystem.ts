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
  exerciseId: string;
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
    exerciseId: string,
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
      exerciseId,
    };
  }

  onEnterPressed(
    code: string,
    currentLine: number,
    exerciseId: string,
  ): TriggerPayload | null {
    if (!detectFunctionBoundary(code, currentLine)) {
      return null;
    }
    return this.buildPayload(code, "newline", exerciseId);
  }

  onRunPressed(code: string, exerciseId: string): TriggerPayload {
    return this.buildPayload(code, "run", exerciseId);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const triggerSystem = new TriggerSystem();
