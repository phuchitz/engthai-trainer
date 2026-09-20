const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(now: number): string {
  let out = "";
  let t = now;
  for (let i = 0; i < TIME_LEN; i++) {
    out = ENCODING[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function randomChars(): number[] {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

/** Increments the random component so ids created in the same millisecond still sort. */
function bumpRandom(prev: number[]): number[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i] < 31) {
      next[i] += 1;
      return next;
    }
    next[i] = 0;
  }
  return randomChars();
}

/**
 * ULID: 48-bit timestamp + 80 bits of randomness, Crockford base32.
 * Lexicographically sortable, so IndexedDB key order is creation order.
 */
export function newId(now: number = Date.now()): string {
  if (now === lastTime) {
    lastRandom = bumpRandom(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomChars();
  }
  return encodeTime(now) + lastRandom.map((n) => ENCODING[n]).join("");
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && value.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}

/** Deterministic key for a progress row, so re-imports merge instead of duplicating. */
export function progressId(itemType: "sentence" | "vocab", itemId: string, direction: "en2th" | "th2en"): string {
  return `${itemType}:${itemId}:${direction}`;
}
