export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="border-border bg-surface rounded-xl border p-6">
      <div className="flex items-center gap-3">
        <span
          className="border-border border-t-accent size-4 animate-spin rounded-full border-2"
          aria-hidden
        />
        <span className="text-muted text-sm">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted mx-auto mt-2 max-w-md text-sm">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="border-danger/40 bg-surface rounded-xl border p-6">
      <p className="text-danger font-medium">Could not open your local database</p>
      <p className="text-muted mt-2 text-sm">{message}</p>
      <p className="text-muted mt-2 text-sm">
        Private browsing windows and blocked site data both prevent storage. Try a normal window.
      </p>
    </div>
  );
}
