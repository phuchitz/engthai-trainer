import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CLAIMS_PROBLEMS,
  checkClaims,
  displayName,
  googleClaimsSchema,
  isGoogleConfigured,
  readCredential,
  hasGoogleConsent,
  setGoogleConsent,
  GOOGLE_DISCLOSURE,
  type GoogleClaims,
} from "@/lib/auth";
import {
  addProfile,
  findByGoogleSub,
  linkGoogle,
  newProfile,
  readRegistry,
  LEGACY_PROFILE_ID,
} from "@/lib/profiles";

const NOW = 1_700_000_000_000;
const CLIENT_ID = "test-client.apps.googleusercontent.com";

const claims = (over: Partial<GoogleClaims> = {}): GoogleClaims =>
  googleClaimsSchema.parse({
    sub: "1234567890",
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000),
    email: "ben@example.com",
    name: "Ben Sanchez",
    given_name: "Ben",
    ...over,
  });

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A token with a real shape but no valid signature — enough for the pre-signature checks. */
const token = (payload: object, header: object = { alg: "RS256", kid: "abc" }) =>
  `${b64url(header)}.${b64url(payload)}.${Buffer.from("not-a-real-signature").toString("base64url")}`;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("configuration", () => {
  it("is off in this repository, because no client ID is committed", () => {
    // The client ID that works is the one registered against your own origin, so the
    // published build has none and the feature degrades to the local profile picker.
    expect(isGoogleConfigured()).toBe(false);
  });

  it("turns on when one is supplied", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", CLIENT_ID);
    expect(isGoogleConfigured()).toBe(true);
  });

  it("treats whitespace as absent", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "   ");
    expect(isGoogleConfigured()).toBe(false);
  });
});

describe("the claims schema", () => {
  it("accepts what Google actually sends", () => {
    expect(googleClaimsSchema.safeParse(claims()).success).toBe(true);
  });

  it("rejects a payload missing the account id", () => {
    const { sub, ...rest } = claims();
    void sub;
    expect(googleClaimsSchema.safeParse(rest).success).toBe(false);
  });

  it("drops a claim nobody declared", () => {
    // A JWT payload is untrusted input. A field nobody declared is a field nothing
    // should be able to read off it.
    const parsed = googleClaimsSchema.parse({ ...claims(), is_admin: true });
    expect(parsed).not.toHaveProperty("is_admin");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>x</script>", "http://insecure.example/a.png"])(
    "rejects %s as a picture",
    (picture) => {
      // The value lands in an <img src>. A valid URL is not the same as a safe one, and
      // Zod's .url() accepts all three of these.
      expect(googleClaimsSchema.safeParse({ ...claims(), picture }).success).toBe(false);
    },
  );

  it("accepts the https avatar Google actually sends", () => {
    const parsed = googleClaimsSchema.safeParse({
      ...claims(),
      picture: "https://lh3.googleusercontent.com/a/abc123",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("checkClaims", () => {
  it("accepts a current token for this app from Google", () => {
    expect(checkClaims(claims(), CLIENT_ID, NOW)).toBeNull();
  });

  it("accepts either spelling of Google's issuer", () => {
    expect(checkClaims(claims({ iss: "accounts.google.com" }), CLIENT_ID, NOW)).toBeNull();
  });

  it("rejects a token from somewhere else", () => {
    expect(checkClaims(claims({ iss: "https://evil.example" }), CLIENT_ID, NOW)).toBe("wrong-issuer");
  });

  it("rejects a token issued for another app", () => {
    expect(checkClaims(claims(), "a-different-client-id", NOW)).toBe("wrong-audience");
  });

  it("rejects an expired token", () => {
    const stale = claims({ exp: Math.floor(NOW / 1000) - 3600 });
    expect(checkClaims(stale, CLIENT_ID, NOW)).toBe("expired");
  });

  it("allows a little leeway for a slow device clock", () => {
    const justExpired = claims({ exp: Math.floor(NOW / 1000) - 10 });
    expect(checkClaims(justExpired, CLIENT_ID, NOW)).toBeNull();
  });
});

describe("readCredential", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", CLIENT_ID);
  });

  it("rejects something that is not a JWT at all", async () => {
    expect(await readCredential("nonsense", NOW)).toEqual({ ok: false, problem: "malformed" });
    expect(await readCredential("", NOW)).toEqual({ ok: false, problem: "malformed" });
  });

  it("rejects an algorithm it does not verify", async () => {
    // "alg": "none" is the classic forged-JWT trick; it must not reach the claims.
    const forged = token(claims(), { alg: "none", kid: "abc" });
    expect(await readCredential(forged, NOW)).toEqual({ ok: false, problem: "malformed" });
  });

  it("rejects a token with no key id to verify against", async () => {
    expect(await readCredential(token(claims(), { alg: "RS256" }), NOW)).toEqual({
      ok: false,
      problem: "malformed",
    });
  });

  it("names the issuer problem before ever fetching a key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await readCredential(token(claims({ iss: "https://evil.example" })), NOW);

    expect(result).toEqual({ ok: false, problem: "wrong-issuer" });
    // Cheap checks first: a token that was never Google's is not worth a network round trip.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names the audience problem, which is what a misconfigured client ID looks like", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "some-other-client-id");
    expect(await readCredential(token(claims()), NOW)).toEqual({ ok: false, problem: "wrong-audience" });
  });

  it("reports being offline rather than claiming a bad signature", async () => {
    // Those are different problems and lead to different actions.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await readCredential(token(claims()), NOW)).toEqual({ ok: false, problem: "offline" });
  });

  it("rejects a signature that does not check out", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ keys: [] }), { status: 200 }),
    );
    expect(await readCredential(token(claims()), NOW)).toEqual({ ok: false, problem: "bad-signature" });
  });

  it("has a message for every problem it can report", () => {
    for (const [problem, message] of Object.entries(CLAIMS_PROBLEMS)) {
      expect(message.length, problem).toBeGreaterThan(10);
    }
  });
});

describe("the name a Google account gets", () => {
  it("prefers the given name", () => {
    expect(displayName(claims())).toBe("Ben");
  });

  it("falls back to the full name, then the email", () => {
    expect(displayName(claims({ given_name: undefined }))).toBe("Ben Sanchez");
    expect(displayName(claims({ given_name: undefined, name: undefined }))).toBe("ben");
  });

  it("never comes back empty", () => {
    const bare = claims({ given_name: undefined, name: undefined, email: undefined });
    expect(displayName(bare).length).toBeGreaterThan(0);
  });

  it("fits the profile name limit", () => {
    const long = claims({ given_name: "x".repeat(200) });
    expect(displayName(long).length).toBeLessThanOrEqual(40);
  });
});

describe("linking a Google account to a local profile", () => {
  it("finds the profile an account already opened", () => {
    const registry = linkGoogle(readRegistry(NOW), LEGACY_PROFILE_ID, { sub: "abc" });
    expect(findByGoogleSub(registry, "abc")?.id).toBe(LEGACY_PROFILE_ID);
    expect(findByGoogleSub(registry, "nobody")).toBeNull();
  });

  it("refuses to let one account open two profiles", () => {
    // Otherwise "sign in" would have an arbitrary answer.
    let registry = addProfile(readRegistry(NOW), "Nok", NOW);
    registry = linkGoogle(registry, LEGACY_PROFILE_ID, { sub: "abc" });

    expect(() => linkGoogle(registry, registry.activeId!, { sub: "abc" })).toThrow(/already opens/);
  });

  it("unlinks without touching anything else about the profile", () => {
    const linked = linkGoogle(readRegistry(NOW), LEGACY_PROFILE_ID, { sub: "abc", avatarUrl: "https://x/y" });
    const unlinked = linkGoogle(linked, LEGACY_PROFILE_ID, null);

    expect(unlinked.profiles[0].googleSub).toBeNull();
    expect(unlinked.profiles[0].avatarUrl).toBeNull();
    expect(unlinked.profiles[0].name).toBe(linked.profiles[0].name);
    expect(unlinked.profiles[0].createdAt).toBe(linked.profiles[0].createdAt);
  });

  it("starts every profile unlinked", () => {
    const profile = newProfile("Ben", NOW);
    expect(profile.googleSub).toBeNull();
    expect(profile.avatarUrl).toBeNull();
  });
});

describe("consent to contact Google", () => {
  it("is withheld until given", () => {
    expect(hasGoogleConsent()).toBe(false);
  });

  it("is remembered, so it is not asked on every load", () => {
    setGoogleConsent(true);
    expect(hasGoogleConsent()).toBe(true);
  });

  it("can be withdrawn", () => {
    setGoogleConsent(true);
    setGoogleConsent(false);
    expect(hasGoogleConsent()).toBe(false);
  });

  it("states that learning data is never sent", () => {
    const never = GOOGLE_DISCLOSURE.neverSent.join(" ");
    expect(never).toMatch(/sentences/);
    expect(never).toMatch(/never leaves this device|Nothing is uploaded/);
  });
});
