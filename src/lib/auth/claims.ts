import { z } from "zod";

/**
 * The claims Google puts in an ID token, reduced to what this app reads.
 *
 * A JWT payload is **untrusted input** until it has been verified, exactly like a model
 * response or a pasted import file — it arrives as base64 that anyone can write. So it
 * is parsed with Zod before anything reads a field off it, and the signature is checked
 * separately. `.passthrough()` is deliberately not used: a claim nobody declared is a
 * claim nobody should be able to reach.
 */
export const googleClaimsSchema = z.object({
  /** Google's stable, per-application account identifier. Not the email. */
  sub: z.string().min(1).max(255),
  iss: z.string().min(1),
  aud: z.string().min(1),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),

  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().max(200).optional(),
  given_name: z.string().max(200).optional(),
  /**
   * https only. This lands in an `<img src>`, and `z.string().url()` happily accepts
   * `javascript:` and `data:` — a valid URL is not the same as a safe one.
   */
  picture: z
    .string()
    .max(2000)
    .refine((value) => /^https:\/\//i.test(value), "picture must be an https URL")
    .optional(),
});

export type GoogleClaims = z.infer<typeof googleClaimsSchema>;

/** Google signs tokens under either spelling of its issuer. */
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;

export type ClaimsProblem =
  "malformed" | "wrong-issuer" | "wrong-audience" | "expired" | "bad-signature" | "offline" | "unsupported";

export const CLAIMS_PROBLEMS: Record<ClaimsProblem, string> = {
  malformed: "Google returned something this app could not read. Nothing was signed in.",
  "wrong-issuer": "That token did not come from Google. Nothing was signed in.",
  "wrong-audience": "That token was issued for a different app. Check the configured client ID.",
  expired: "That sign-in has expired. Try again.",
  "bad-signature": "That token's signature did not check out. Nothing was signed in.",
  offline: "Signing in needs a connection to Google. Everything else in this app works offline.",
  unsupported: "This browser cannot verify a Google token, which needs a secure context.",
};

/**
 * Checks the parts of a token that do not need a key.
 *
 * Returns the problem rather than throwing, so the caller can say which thing went
 * wrong instead of showing one shrug for every failure.
 */
export function checkClaims(
  claims: GoogleClaims,
  clientId: string,
  now: number = Date.now(),
): ClaimsProblem | null {
  if (!(GOOGLE_ISSUERS as readonly string[]).includes(claims.iss)) return "wrong-issuer";
  if (claims.aud !== clientId) return "wrong-audience";
  // Seconds, not milliseconds. A little leeway for a slow clock on the device.
  if (claims.exp * 1000 < now - 60_000) return "expired";
  return null;
}

/** A display name, falling back through what Google actually sent. */
export function displayName(claims: GoogleClaims): string {
  const candidate = claims.given_name?.trim() || claims.name?.trim() || claims.email?.split("@")[0];
  return (candidate && candidate.slice(0, 40)) || "Google account";
}
