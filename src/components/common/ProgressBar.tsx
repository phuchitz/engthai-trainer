export function ProgressBar({
  percent,
  label,
  tone = "accent",
}: {
  percent: number;
  label: string;
  tone?: "accent" | "success" | "muted";
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const fill = tone === "success" ? "bg-success" : tone === "muted" ? "bg-muted" : "bg-accent";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full"
    >
      {/* The transition is removed wholesale by the reduced-motion rule in globals.css. */}
      <div
        className={`${fill} h-full rounded-full transition-[width] duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
