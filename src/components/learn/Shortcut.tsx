/**
 * Shortcuts are shown on the control they trigger rather than in a help panel, so they
 * are learnable without being looked up.
 */
export function Shortcut({ keys }: { keys: string }) {
  return (
    <kbd className="border-border bg-surface-muted text-muted ml-2 rounded border px-1.5 py-0.5 font-mono text-[10px] font-normal">
      {keys}
    </kbd>
  );
}
