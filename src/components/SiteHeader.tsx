import { Link } from "@tanstack/react-router";
import { Menu, TrendingUp } from "lucide-react";
import { useState } from "react";
import { categories } from "@/data/content";

const nav = [
  { label: "News", to: "/" },
  { label: "Betting tips", to: "/tips" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TrendingUp className="size-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-2xl leading-none tracking-wide">
            ODDS<span className="text-primary">NYTT</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <span className="inline-flex size-2 animate-pulse rounded-full bg-live" />
          Odds updated live
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="ml-auto rounded-md border border-border p-2 text-muted-foreground md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <div className="hidden border-t border-border md:block">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {categories.map((c) => (
            <span key={c} className="whitespace-nowrap transition-colors hover:text-primary">
              {c}
            </span>
          ))}
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
