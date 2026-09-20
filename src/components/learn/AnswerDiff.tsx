import type { AlignOp } from "@/lib/answer";

/**
 * Word-level feedback. The learner's own words are shown in reading order, with what was
 * expected surfaced beside anything wrong — being told only "incorrect" teaches nothing.
 */
export function AnswerDiff({ ops }: { ops: AlignOp[] }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-lg leading-relaxed">
      {ops.map((op, i) => {
        if (op.type === "match") {
          return (
            <span key={i} className="text-success">
              {op.received}
            </span>
          );
        }
        if (op.type === "substituted") {
          return (
            <span key={i} className="inline-flex items-baseline gap-1">
              <span className="text-danger line-through decoration-2">{op.received}</span>
              <span className="text-foreground font-medium">{op.expected}</span>
            </span>
          );
        }
        if (op.type === "extra") {
          return (
            <span key={i} className="text-danger line-through decoration-2">
              {op.received}
            </span>
          );
        }
        return (
          <span key={i} className="text-warning border-warning/50 border-b-2 border-dashed">
            {op.expected}
          </span>
        );
      })}
    </p>
  );
}

export function DiffLegend() {
  return (
    <p className="text-muted mt-2 text-xs">
      <span className="text-success">correct</span> · <span className="text-danger line-through">wrong</span>{" "}
      · <span className="text-warning">missing</span>
    </p>
  );
}
