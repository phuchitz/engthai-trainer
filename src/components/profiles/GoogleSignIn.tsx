"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useProfileStore } from "@/stores/useProfileStore";
import {
  GOOGLE_DISCLOSURE,
  googleAccounts,
  googleClientId,
  hasGoogleConsent,
  isGoogleConfigured,
  loadGoogleScript,
  setGoogleConsent,
} from "@/lib/auth";

/**
 * Sign in with Google, offered honestly.
 *
 * Three things have to be true on screen before this is worth having:
 *
 * 1. **It is not configured in this build**, and when it is not, this says so plainly
 *    instead of showing a button that cannot work.
 * 2. **Nothing reaches Google until the learner says so.** The app is otherwise entirely
 *    offline; Google's script is not in the layout, and is fetched only after the
 *    disclosure has been accepted.
 * 3. **It does not do what "sign in" implies.** No sync, no protection, no account. It
 *    picks a local profile. The panel says that in those words.
 */

// Consent is browser state, so it is read through an external store rather than set
// from an effect — the same arrangement the theme and display preferences use.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function agree(agreed: boolean) {
  setGoogleConsent(agreed);
  listeners.forEach((l) => l());
}

export function GoogleSignIn({ compact = false }: { compact?: boolean }) {
  const { signInWithGoogle, busy } = useProfileStore();
  const agreed = useSyncExternalStore(subscribe, hasGoogleConsent, () => false);
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agreed || !isGoogleConfigured()) return;
    let cancelled = false;

    void (async () => {
      // The first moment anything leaves the device, and only ever after consent.
      const loaded = await loadGoogleScript();
      if (cancelled) return;

      const accounts = googleAccounts();
      if (!loaded || !accounts || !holder.current) {
        setFailed(true);
        return;
      }

      accounts.accounts.id.initialize({
        client_id: googleClientId(),
        callback: ({ credential }) => void signInWithGoogle(credential),
      });
      // Google's own button, as their terms require and as popup blockers expect.
      accounts.accounts.id.renderButton(holder.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 260,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [agreed, signInWithGoogle]);

  if (!isGoogleConfigured()) {
    return compact ? null : (
      <div className="border-border space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">Google sign-in is not set up in this build</p>
        <p className="text-muted text-xs">
          It needs a Google OAuth client ID registered against this site&rsquo;s address, which has to be
          created in your own Google Cloud project. Until then, profiles work exactly as they do now — see the
          README.
        </p>
      </div>
    );
  }

  if (!agreed) {
    return (
      <div className="border-border space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Before signing in with Google</p>

        <Disclosure title="Sent to Google" items={GOOGLE_DISCLOSURE.sent} />
        <Disclosure title="Google sends back" items={GOOGLE_DISCLOSURE.received} />
        <Disclosure title="Never sent" items={GOOGLE_DISCLOSURE.neverSent} tone="muted" />

        <p className="text-muted text-xs">
          This picks which profile opens on this device. It is{" "}
          <strong className="text-foreground font-medium">not a sync service and not a lock</strong> — your
          progress stays in this browser, and signing in on another device starts an empty profile with the
          same name.
        </p>

        <button
          type="button"
          onClick={() => agree(true)}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Agree and continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={holder} aria-busy={busy} />
      {failed ? (
        <p role="alert" className="text-danger text-xs">
          Google&rsquo;s sign-in script could not be loaded. You are probably offline — everything else in
          this app still works.
        </p>
      ) : null}
      <button type="button" onClick={() => agree(false)} className="text-muted text-xs underline">
        Stop contacting Google
      </button>
    </div>
  );
}

function Disclosure({ title, items, tone }: { title: string; items: readonly string[]; tone?: "muted" }) {
  return (
    <div>
      <p className={`text-xs font-medium ${tone === "muted" ? "text-muted" : ""}`}>{title}</p>
      <ul className="text-muted mt-1 list-disc space-y-0.5 pl-5 text-xs">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
