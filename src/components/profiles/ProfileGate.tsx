"use client";

import { useEffect, useState } from "react";
import { useProfileStore } from "@/stores/useProfileStore";
import { MAX_PROFILES, PASSCODE_MAX_LENGTH, isValidPasscode, type Profile } from "@/lib/profiles";
import { GATE_ATTRIBUTE } from "./gateScript";

/**
 * Decides whether the app is shown, and to whom.
 *
 * Profiles are a device convenience, not an account system: there is no server to
 * authenticate against and nothing here is encrypted. The passcode hides the screen from
 * someone else using the same computer, and every surface that mentions it says so.
 */
export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { hydrate, gate, registry } = useProfileStore();
  const state = gate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // The pre-paint script hides the app when it finds a locked profile, so nothing shows
  // before React has decided. Once it has, the attribute has done its job.
  useEffect(() => {
    if (state === "pending") return;
    if (state === "open") document.documentElement.removeAttribute(GATE_ATTRIBUTE);
    else document.documentElement.setAttribute(GATE_ATTRIBUTE, "1");
  }, [state]);

  if (state === "open") return <>{children}</>;

  // Rendering the shell here would put it on screen behind the gate for a frame.
  if (state === "pending" || !registry) return <GateFrame>{null}</GateFrame>;

  return <GateFrame>{state === "locked" ? <LockScreen /> : <ProfilePicker />}</GateFrame>;
}

function GateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <main id="main" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}

function Heading({ title, titleTh }: { title: string; titleTh: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted text-sm" lang="th">
        {titleTh}
      </p>
    </div>
  );
}

function ProfilePicker() {
  const { registry, select, create, busy, error } = useProfileStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (!registry) return null;
  const full = registry.profiles.length >= MAX_PROFILES;

  return (
    <div>
      <Heading title="Who is studying?" titleTh="ใครกำลังเรียน" />

      <ul className="space-y-2">
        {registry.profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void select(profile.id)}
              className="border-border bg-surface hover:border-accent flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{profile.name}</span>
                <span className="text-muted block text-xs">
                  {profile.passcode ? "Passcode" : "No passcode"}
                </span>
              </span>
              {profile.passcode ? <LockIcon /> : null}
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      {adding ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length > 0) void create(name);
          }}
        >
          <label htmlFor="new-profile-name" className="text-muted block text-xs">
            Name for the new profile
          </label>
          <input
            id="new-profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            autoComplete="off"
            className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="border-border rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => setAdding(true)}
          className="border-border text-muted mt-4 w-full rounded-xl border border-dashed p-4 text-sm disabled:opacity-50"
        >
          {full ? `This device already has ${MAX_PROFILES} profiles` : "Add someone"}
        </button>
      )}

      <p className="text-muted mt-6 text-xs">
        Profiles keep separate progress on this device. They are not accounts: nothing is sent anywhere, and
        each one&rsquo;s data stays in this browser.
      </p>
    </div>
  );
}

function LockScreen() {
  const { current, unlock, signOut, failures, error, busy } = useProfileStore();
  const profile = current();
  const [digits, setDigits] = useState("");
  const [forgetting, setForgetting] = useState(false);

  if (!profile) return null;

  return (
    <div>
      <Heading title={profile.name} titleTh="ใส่รหัสผ่าน" />

      {forgetting ? (
        <ForgotPasscode profile={profile} onCancel={() => setForgetting(false)} />
      ) : (
        <>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!(await unlock(digits))) setDigits("");
            }}
            className="space-y-3"
          >
            <label htmlFor="passcode" className="text-muted block text-sm">
              Enter passcode
            </label>
            <input
              id="passcode"
              value={digits}
              onChange={(event) => setDigits(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={PASSCODE_MAX_LENGTH}
              aria-describedby="passcode-truth"
              className="border-border bg-background w-full rounded-lg border px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]"
            />
            <button
              type="submit"
              disabled={busy || !isValidPasscode(digits)}
              className="bg-accent text-accent-foreground w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Unlock
            </button>
          </form>

          {error ? (
            <p role="alert" className="text-danger mt-3 text-sm">
              {error}
              {failures >= 3 ? " Each further try is slowed down a little." : ""}
            </p>
          ) : null}

          <PasscodeTruth id="passcode-truth" />

          <div className="mt-6 flex flex-wrap gap-4 text-xs">
            <button type="button" onClick={() => setForgetting(true)} className="text-muted underline">
              I forgot my passcode
            </button>
            <button type="button" onClick={signOut} className="text-muted underline">
              Use a different profile
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ForgotPasscode({ profile, onCancel }: { profile: Profile; onCancel: () => void }) {
  const { forgetPasscode } = useProfileStore();
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLocaleLowerCase() === profile.name.toLocaleLowerCase();

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <p className="text-sm font-medium">Remove the passcode</p>
      <p className="text-muted text-sm">
        Your progress is not encrypted, so a forgotten passcode would lock you out of your own work for
        nothing. Removing it loses no data. It does mean anyone who can reach this browser can do the same,
        which is the honest limit of a screen lock.
      </p>
      <label htmlFor="confirm-name" className="text-muted block text-xs">
        Type <span className="text-foreground font-medium">{profile.name}</span> to confirm
      </label>
      <input
        id="confirm-name"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!matches}
          onClick={() => forgetPasscode(profile.id)}
          className="bg-danger text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Remove passcode
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-border rounded-lg border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Said on the lock screen itself, where it is least convenient and most necessary. */
export function PasscodeTruth({ id }: { id?: string }) {
  return (
    <p id={id} className="text-muted mt-6 text-xs">
      This hides your progress from someone else using this computer. It is{" "}
      <strong className="text-foreground font-medium">not encryption</strong> — the data stays readable to
      anyone who opens the browser&rsquo;s developer tools or your exported backup file.
    </p>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="text-muted size-4 shrink-0">
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
