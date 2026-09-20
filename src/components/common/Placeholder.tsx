export function Placeholder({ session, children }: { session: number; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Session {session}</p>
      <p className="mt-2 text-sm text-muted">{children}</p>
    </section>
  );
}
