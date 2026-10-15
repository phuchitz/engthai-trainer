import { checkClaims, googleClaimsSchema, type ClaimsProblem, type GoogleClaims } from "./claims";

/**
 * Sign in with Google, in a browser with no server behind it.
 *
 * ## Read this before believing the words "sign in"
 *
 * This app is a static export. There is no server, no session to hold and nothing that
 * could check one. So signing in with Google here gives an **identity label** — your
 * name, your picture, and a stable id to pick the right local profile with. It is not
 * authentication, because there is nobody to authenticate to.
 *
 * Concretely:
 *
 * - It does **not** protect anything. The profile a Google account opens is the same
 *   local IndexedDB database as before, readable through devtools by anyone holding the
 *   laptop, signed in or not.
 * - It does **not** sync. Progress stays on this device. Signing in on a second device
 *   creates a second, empty profile wearing the same name.
 * - It does **not** survive losing the browser's data. Clearing site data clears it.
 *
 * What it does buy: you tap your face instead of typing a name, and the right profile
 * opens without choosing from a list.
 *
 * ## The client ID is not a secret
 *
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is baked into the bundle on purpose. A browser OAuth
 * client ID is public by design — it identifies the app, it does not authorise anything,
 * and Google's own documented flow puts it in the page. What stops another site using
 * it is the **authorized JavaScript origins** list on the credential, not secrecy. This
 * is the same reasoning that lets a future AI adapter's URL live in the bundle while its
 * key may not: see docs/ai.md.
 *
 * There is still no secret anywhere in this app, and this does not create a place for one.
 */

const GSI_SRC = "https://accounts.google.com/gsi/client";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export function googleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
}

/**
 * Whether this build can offer Google sign-in at all.
 *
 * False in this repository as published: no client ID is committed, because the one that
 * works is the one registered against *your* origin. Everything degrades to the local
 * profile picker, which is a complete way to use the app rather than a fallback.
 */
export function isGoogleConfigured(): boolean {
  return googleClientId().length > 0;
}

export type GoogleIdentity = {
  /** Google's stable per-application account id. The thing a profile is keyed on. */
  sub: string;
  name: string;
  email?: string;
  picture?: string;
};

export type GoogleResult =
  { ok: true; identity: GoogleIdentity; claims: GoogleClaims } | { ok: false; problem: ClaimsProblem };

// ------------------------------------------------------------------ token decoding

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
  } catch {
    return null;
  }
}

type Jwk = { kid: string; n: string; e: string; alg?: string; kty: string };

/**
 * Verifies the RS256 signature against Google's published keys.
 *
 * Worth doing even though it is not a security boundary here: without it the code would
 * be reading a name and a picture out of a string anybody could have written, and that
 * is a bad habit to leave in a file that looks like an auth module. It proves the token
 * is Google's. It does not prove anything about who is holding the laptop.
 */
async function verifySignature(token: string, kid: string): Promise<boolean> {
  if (typeof crypto === "undefined" || !crypto.subtle) return false;

  const response = await fetch(JWKS_URL, { cache: "no-store" });
  if (!response.ok) return false;
  const { keys } = (await response.json()) as { keys: Jwk[] };

  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) return false;

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const [header, payload, signature] = token.split(".");
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signature) as BufferSource,
    new TextEncoder().encode(`${header}.${payload}`),
  );
}

/**
 * Turns the credential Google hands back into an identity, or says why it could not.
 *
 * Every step that can fail reports its own problem. "Sign-in failed" for six different
 * causes tells the learner nothing and tells whoever configured the client ID less.
 */
export async function readCredential(token: string, now: number = Date.now()): Promise<GoogleResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, problem: "malformed" };

  const header = decodeSegment(parts[0]) as { kid?: string; alg?: string } | null;
  const parsed = googleClaimsSchema.safeParse(decodeSegment(parts[1]));
  if (!header?.kid || header.alg !== "RS256" || !parsed.success) {
    return { ok: false, problem: "malformed" };
  }

  const problem = checkClaims(parsed.data, googleClientId(), now);
  if (problem) return { ok: false, problem };

  if (typeof crypto === "undefined" || !crypto.subtle) {
    return { ok: false, problem: "unsupported" };
  }

  let verified = false;
  try {
    verified = await verifySignature(token, header.kid);
  } catch {
    // Fetching Google's keys is the only network step that can fail on its own.
    return { ok: false, problem: "offline" };
  }
  if (!verified) return { ok: false, problem: "bad-signature" };

  const claims = parsed.data;
  return {
    ok: true,
    claims,
    identity: {
      sub: claims.sub,
      name:
        claims.given_name?.trim() || claims.name?.trim() || claims.email?.split("@")[0] || "Google account",
      email: claims.email,
      picture: claims.picture,
    },
  };
}

// --------------------------------------------------------------- the Google script

type GsiWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (options: { client_id: string; callback: (r: { credential: string }) => void }) => void;
        renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        disableAutoSelect: () => void;
      };
    };
  };
};

let scriptPromise: Promise<boolean> | null = null;

/**
 * Loads Google's script — **the first moment anything leaves the device**.
 *
 * Nothing calls this until the learner has read what it means and pressed the button.
 * The app is otherwise entirely offline, and that is a promise worth keeping explicit
 * rather than quietly breaking with a `<script>` tag in the layout.
 */
export function loadGoogleScript(): Promise<boolean> {
  if (typeof document === "undefined" || !isGoogleConfigured()) return Promise.resolve(false);

  scriptPromise ??= new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) return resolve(true);

    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function googleAccounts(): GsiWindow["google"] {
  return typeof window === "undefined" ? undefined : (window as GsiWindow).google;
}

/** Stops Google silently re-selecting an account on the next load. */
export function forgetGoogleSession(): void {
  try {
    googleAccounts()?.accounts.id.disableAutoSelect();
  } catch {
    // The script may never have loaded; there is nothing to forget.
  }
}

// -------------------------------------------------------------------- consent

const CONSENT_KEY = "engthai.googleConsent";

/**
 * Whether the learner has agreed that the browser may contact Google.
 *
 * Asked once per device and remembered, because re-asking on every load trains people
 * to click through it. Kept out of the profile registry on purpose: it is a statement
 * about this browser's network behaviour, not about any one profile.
 */
export function hasGoogleConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

export function setGoogleConsent(agreed: boolean): void {
  try {
    if (agreed) localStorage.setItem(CONSENT_KEY, "yes");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Not remembered; the learner will be asked again next time.
  }
}

const SKIP_KEY = "engthai.skipSignIn";

/**
 * Whether someone has chosen to carry on without signing in.
 *
 * Remembered so the sign-in screen is an invitation rather than a toll gate. Google
 * being configured must never be able to lock someone out of an app whose data is
 * sitting on their own device — if Google is unreachable, or they simply do not want an
 * account, the local profiles are a complete way to use it.
 */
export function hasSkippedSignIn(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === "yes";
  } catch {
    return false;
  }
}

export function setSkippedSignIn(skipped: boolean): void {
  try {
    if (skipped) localStorage.setItem(SKIP_KEY, "yes");
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    // Not remembered; they will be offered the choice again.
  }
}

/** Exactly what leaves the device, and what does not, written out for the disclosure. */
export const GOOGLE_DISCLOSURE = {
  sent: [
    "A request to accounts.google.com to load Google's sign-in script.",
    "Your Google sign-in, handled by Google on their own page.",
  ],
  received: ["Your name, your email address and your profile picture."],
  neverSent: [
    "Your sentences, answers, schedule or XP — none of it leaves this device, ever.",
    "Nothing is uploaded, synced or backed up by signing in.",
  ],
} as const;
