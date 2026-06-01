// ─── Types ──────────────────────────────────────────────────────────────────

export type EventType = "keystroke" | "delete" | "pause" | "click" | "run";

export interface CodeEvent {
  type: EventType;
  line: number;
  col: number;
  timestamp: number; // unix ms
  durationMs?: number; // set for pause events
}

export interface EventBufferState {
  events: CodeEvent[];
  sessionStartTime: number;
  lastKeystrokeTime: number;
  triggerCount: number;
}

export interface EventStats {
  totalKeystrokes: number;
  totalDeletes: number;
  pauseCount: number;
  clickCount: number;
  avgPauseDurationMs: number;
  pauseLines: number[];
}

// ─── EventBuffer ──────────────────────────────────────────────────────────────

class EventBuffer {
  private state: EventBufferState;

  constructor() {
    const now = Date.now();
    this.state = {
      events: [],
      sessionStartTime: now,
      lastKeystrokeTime: now,
      triggerCount: 0,
    };
  }

  addEvent(event: CodeEvent): void {
    this.state.events.push(event);
    if (event.type === "keystroke") {
      this.state.lastKeystrokeTime = event.timestamp;
    }
  }

  getEvents(): CodeEvent[] {
    return [...this.state.events];
  }

  /** Reset the buffered events. Called after each AI trigger. */
  clear(): void {
    this.state.events = [];
  }

  getStats(): EventStats {
    let totalKeystrokes = 0;
    let totalDeletes = 0;
    let clickCount = 0;
    const pauseDurations: number[] = [];
    const pauseLines: number[] = [];

    for (const event of this.state.events) {
      switch (event.type) {
        case "keystroke":
          totalKeystrokes++;
          break;
        case "delete":
          totalDeletes++;
          break;
        case "click":
          clickCount++;
          break;
        case "pause":
          pauseLines.push(event.line);
          if (typeof event.durationMs === "number") {
            pauseDurations.push(event.durationMs);
          }
          break;
        default:
          break;
      }
    }

    const avgPauseDurationMs =
      pauseDurations.length > 0
        ? pauseDurations.reduce((sum, d) => sum + d, 0) / pauseDurations.length
        : 0;

    return {
      totalKeystrokes,
      totalDeletes,
      pauseCount: pauseLines.length,
      clickCount,
      avgPauseDurationMs,
      pauseLines,
    };
  }

  getTriggerCount(): number {
    return this.state.triggerCount;
  }

  /** Track how many times the AI has been triggered this session. */
  incrementTrigger(): void {
    this.state.triggerCount++;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const eventBuffer = new EventBuffer();
