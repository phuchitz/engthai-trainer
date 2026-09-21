/**
 * Active study time.
 *
 * Wall-clock time is a bad measure of study: leaving a card open over lunch would score
 * an hour of "practice". This accumulates only time the learner was plausibly present,
 * by excluding two things:
 *
 * - **Background time.** Nothing accrues between `hidden` and `visible`, so a
 *   backgrounded tab or a locked phone contributes zero.
 * - **Idle time.** Any stretch without a sign of life is counted for at most
 *   `idleTimeoutMs`. Thinking for three minutes with no keystroke banks one minute, not
 *   three — the cap is what makes the number an *activity* measure rather than a
 *   presence one.
 *
 * Pure: it takes a list of timestamped events and returns a number, so a whole session
 * can be replayed in a test without a DOM or a clock.
 */

export const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

export type TimelineEvent = {
  type: "start" | "activity" | "hidden" | "visible" | "stop";
  at: number;
};

/**
 * Milliseconds of active time across `events`, measured up to `endAt`.
 *
 * `stop` is terminal: anything after it is ignored, so a stale listener firing after a
 * card is finished cannot inflate the total.
 */
export function activeMs(
  events: readonly TimelineEvent[],
  endAt: number,
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): number {
  const ordered = [...events].sort((a, b) => a.at - b.at);

  let total = 0;
  let open = false;
  let stopped = false;
  /** When the current run of active time began, or the last sign of life within it. */
  let mark = 0;

  const credit = (at: number) => {
    if (!open) return;
    total += Math.max(0, Math.min(at - mark, idleTimeoutMs));
  };

  for (const event of ordered) {
    if (stopped) break;

    switch (event.type) {
      case "start":
      case "visible":
        if (!open) {
          open = true;
          mark = event.at;
        }
        break;

      case "activity":
        // Activity implies the learner is present, so it also reopens a closed run.
        if (open) {
          credit(event.at);
          mark = event.at;
        } else {
          open = true;
          mark = event.at;
        }
        break;

      case "hidden":
        credit(event.at);
        open = false;
        break;

      case "stop":
        credit(event.at);
        open = false;
        stopped = true;
        break;
    }
  }

  if (!stopped) credit(endAt);
  return total;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return `${Math.floor(ms / 1000)}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Collects timeline events in the browser and reports active time on demand.
 *
 * Kept separate from `activeMs` so the arithmetic stays testable without a DOM.
 */
export class StudyTimer {
  private events: TimelineEvent[] = [];
  private readonly idleTimeoutMs: number;

  constructor(startedAt: number = Date.now(), idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.events.push({ type: "start", at: startedAt });
  }

  mark(type: TimelineEvent["type"], at: number = Date.now()): void {
    this.events.push({ type, at });
  }

  elapsed(now: number = Date.now()): number {
    return activeMs(this.events, now, this.idleTimeoutMs);
  }

  stop(at: number = Date.now()): number {
    this.mark("stop", at);
    return this.elapsed(at);
  }
}
