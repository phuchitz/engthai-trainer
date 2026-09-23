"use client";

import { useEffect, useState } from "react";
import { useProfileStore } from "@/stores/useProfileStore";
import { PasscodeTruth } from "@/components/profiles/ProfileGate";
import {
  clearUnlocked,
  isPasscodeSupported,
  isValidPasscode,
  MAX_PROFILES,
  PASSCODE_MAX_LENGTH,
  PASSCODE_MIN_LENGTH,
  type Profile,
} from "@/lib/profiles";

/**
 * Managing who studies on this device.
 *
 * Deliberately not called an account: there is nothing to sign in to and nothing leaves
 * the browser. Everything destructive here follows the same rule as "Delete all data" —
 * the data goes first, and the change is only recorded once it actually happened.
 */
export function ProfilePanel() {
  const { registry, hydrate, current, busy, error } = useProfileStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!registry) return null;
  const active = current();

  return (
    <section
      aria-labelledby="profiles-heading"
      className="border-border bg-surface space-y-4 rounded-xl border p-4"
    >
      <div>
        <h2 id="profiles-heading" className="font-medium">
          Profiles
        </h2>
        <p className="text-muted mt-1 text-sm">
          Separate progress for separate people on this device. Not an account: nothing is sent anywhere, and
          each profile&rsquo;s data lives in this browser only.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <ul className="divide-border divide-y">
        {registry.profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            isActive={profile.id === active?.id}
            canRemove={registry.profiles.length > 1}
          />
        ))}
      </ul>

      <div className="border-border flex flex-wrap gap-2 border-t pt-4">
        <AddProfile disabled={busy || registry.profiles.length >= MAX_PROFILES} />
        <SignOutButton />
        {active?.passcode ? <LockNowButton /> : null}
      </div>
    </section>
  );
}

function ProfileRow({
  profile,
  isActive,
  canRemove,
}: {
  profile: Profile;
  isActive: boolean;
  canRemove: boolean;
}) {
  const { select, rename, remove, busy } = useProfileStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  return (
    <li className="space-y-3 py-4 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                rename(profile.id, name);
                setEditing(false);
              }}
            >
              <label htmlFor={`name-${profile.id}`} className="sr-only">
                Name for {profile.name}
              </label>
              <input
                id={`name-${profile.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                className="border-border bg-background rounded-lg border px-3 py-1.5 text-sm"
              />
              <button type="submit" className="border-border rounded-lg border px-3 py-1.5 text-xs">
                Save
              </button>
            </form>
          ) : (
            <p className="truncate font-medium">
              {profile.name}
              {isActive ? <span className="text-muted ml-2 text-xs font-normal">Studying now</span> : null}
            </p>
          )}
          <p className="text-muted text-xs">{profile.passcode ? "Passcode set" : "No passcode"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void select(profile.id)}
              className="bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Switch to
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="border-border rounded-lg border px-3 py-1.5 text-xs"
          >
            {editing ? "Cancel" : "Rename"}
          </button>
          {canRemove ? (
            <button
              type="button"
              onClick={() => setConfirming((v) => !v)}
              className="text-danger rounded-lg px-3 py-1.5 text-xs underline"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {isActive ? <PasscodeControls profile={profile} /> : null}

      {confirming ? (
        <div className="border-danger/40 space-y-2 rounded-lg border p-3">
          <p className="text-danger text-sm font-medium">
            Delete {profile.name} and everything they have studied?
          </p>
          <p className="text-muted text-xs">
            Their sentences, schedule, answer history and saved words are removed from this device. This
            cannot be undone, and there is no copy anywhere else — export a backup from that profile first if
            you want one.
          </p>
          <label htmlFor={`confirm-${profile.id}`} className="text-muted block text-xs">
            Type <span className="text-foreground font-medium">{profile.name}</span> to confirm
          </label>
          <input
            id={`confirm-${profile.id}`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="border-border bg-background w-48 rounded-lg border px-3 py-1.5 text-sm"
          />
          <div>
            <button
              type="button"
              disabled={busy || typed.trim().toLocaleLowerCase() !== profile.name.toLocaleLowerCase()}
              onClick={() => void remove(profile.id)}
              className="bg-danger text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Delete this profile
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function PasscodeControls({ profile }: { profile: Profile }) {
  const { changePasscode, busy } = useProfileStore();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const supported = isPasscodeSupported();

  if (!supported) {
    return (
      <p className="text-muted text-xs">
        A passcode needs a secure context, which this page is not being served over. Nothing else is affected.
      </p>
    );
  }

  return (
    <div className="border-border rounded-lg border border-dashed p-3">
      {open ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            await changePasscode(profile.id, digits);
            setDigits("");
            setOpen(false);
          }}
        >
          <label htmlFor="new-passcode" className="text-muted block text-xs">
            {PASSCODE_MIN_LENGTH} to {PASSCODE_MAX_LENGTH} digits
          </label>
          <input
            id="new-passcode"
            value={digits}
            onChange={(event) => setDigits(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={PASSCODE_MAX_LENGTH}
            className="border-border bg-background w-40 rounded-lg border px-3 py-1.5 font-mono text-sm tracking-widest"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !isValidPasscode(digits)}
              className="bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {profile.passcode ? "Change passcode" : "Set passcode"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-border rounded-lg border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
          <PasscodeTruth />
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border-border rounded-lg border px-3 py-1.5 text-xs"
          >
            {profile.passcode ? "Change passcode" : "Set a passcode"}
          </button>
          {profile.passcode ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void changePasscode(profile.id, null)}
              className="text-muted rounded-lg px-3 py-1.5 text-xs underline disabled:opacity-40"
            >
              Remove passcode
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AddProfile({ disabled }: { disabled: boolean }) {
  const { create, busy } = useProfileStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="border-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
      >
        {disabled ? `Limit of ${MAX_PROFILES} profiles` : "Add a profile"}
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length > 0) void create(name);
      }}
    >
      <label htmlFor="add-profile-name" className="sr-only">
        Name for the new profile
      </label>
      <input
        id="add-profile-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={40}
        autoComplete="off"
        className="border-border bg-background rounded-lg border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy || name.trim().length === 0}
        className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        Create and switch
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="border-border rounded-lg border px-4 py-2 text-sm"
      >
        Cancel
      </button>
    </form>
  );
}

function SignOutButton() {
  const { signOut } = useProfileStore();
  return (
    <button
      type="button"
      onClick={signOut}
      className="border-border rounded-lg border px-4 py-2 text-sm"
      title="Return to the profile picker"
    >
      Sign out
    </button>
  );
}

function LockNowButton() {
  return (
    <button
      type="button"
      onClick={() => {
        clearUnlocked();
        window.location.assign(new URL("/", window.location.origin).toString());
      }}
      className="border-border rounded-lg border px-4 py-2 text-sm"
    >
      Lock now
    </button>
  );
}
