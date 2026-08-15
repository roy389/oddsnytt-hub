import type { Tip } from "@/data/content";

export function TipCard({ tip }: { tip: Tip }) {
  return (
    <div className="card-hover rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        <span>{tip.league}</span>
        {tip.live ? (
          <span className="inline-flex items-center gap-1 font-semibold text-live">
            <span className="inline-flex size-1.5 animate-pulse rounded-full bg-live" />
            Live
          </span>
        ) : (
          <span>{tip.kickoff}</span>
        )}
      </div>

      <p className="mt-3 text-lg leading-tight">
        {tip.home} <span className="text-muted-foreground">vs</span> {tip.away}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Our pick
          </p>
          <p className="text-sm font-semibold">{tip.pick}</p>
        </div>
        <span className="rounded-md bg-odds px-3 py-1.5 font-display text-xl leading-none text-odds-foreground">
          {tip.odds}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span>{tip.confidence}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${tip.confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}
