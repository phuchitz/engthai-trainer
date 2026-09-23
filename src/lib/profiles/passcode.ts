import { z } from "zod";

/**
 * A stored passcode.
 *
 * ## What this protects against, and what it does not
 *
 * The passcode gates the **screen**, not the data. Progress lives in IndexedDB in plain
 * text, exactly as it did before, and anyone who opens the browser's developer tools —
 * or reads an exported backup file — can see all of it without ever meeting this prompt.
 *
 * It is worth having anyway: it stops a housemate picking up an unlocked laptop and
 * poking at someone else's study history. It is not worth pretending about, so the lock
 * screen says so in as many words.
 *
 * The digits are still hashed rather than stored as typed. Not because hashing makes a
 * four-digit code hard to recover — ten thousand candidates fall in milliseconds however
 * many iterations are used — but because people reuse PINs, and this one should not be
 * sitting in `localStorage` ready to be tried against a phone or a bank card.
 */
export const passcodeSchema = z.object({
  /** Base64. Per profile, so identical passcodes do not produce identical hashes. */
  salt: z.string().min(1),
  hash: z.string().min(1),
  iterations: z.number().int().positive(),
  algorithm: z.literal("PBKDF2-SHA256"),
});

export type Passcode = z.infer<typeof passcodeSchema>;

export const PASSCODE_MIN_LENGTH = 4;
export const PASSCODE_MAX_LENGTH = 12;
const ITERATIONS = 100_000;
const KEY_BITS = 256;

export class PasscodeUnsupportedError extends Error {
  constructor() {
    super(
      "This browser cannot hash a passcode, which needs a secure context. Serve the app over https or localhost, or leave the profile unlocked.",
    );
    this.name = "PasscodeUnsupportedError";
  }
}

/**
 * True when the browser can hash at all.
 *
 * `crypto.subtle` is absent outside a secure context. When it is missing the answer is
 * to refuse to set a passcode and say why — never to fall back to something weaker,
 * which would look identical to the learner and protect less.
 */
export function isPasscodeSupported(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle?.importKey === "function";
}

export function isValidPasscode(value: string): boolean {
  return new RegExp(`^\\d{${PASSCODE_MIN_LENGTH},${PASSCODE_MAX_LENGTH}}$`).test(value);
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function derive(digits: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(digits), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return toBase64(bits);
}

export async function hashPasscode(digits: string): Promise<Passcode> {
  if (!isPasscodeSupported()) throw new PasscodeUnsupportedError();
  if (!isValidPasscode(digits)) {
    throw new Error(`A passcode is ${PASSCODE_MIN_LENGTH} to ${PASSCODE_MAX_LENGTH} digits.`);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toBase64(salt.buffer as ArrayBuffer),
    hash: await derive(digits, salt, ITERATIONS),
    iterations: ITERATIONS,
    algorithm: "PBKDF2-SHA256",
  };
}

/** Rehashes with the stored salt and iteration count, so an older hash still verifies. */
export async function verifyPasscode(digits: string, stored: Passcode): Promise<boolean> {
  if (!isPasscodeSupported()) return false;
  const salt = Uint8Array.from(atob(stored.salt), (c) => c.charCodeAt(0));
  try {
    return (await derive(digits, salt, stored.iterations)) === stored.hash;
  } catch {
    return false;
  }
}
