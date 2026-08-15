import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-2xl tracking-wide">
            ODDS<span className="text-primary">NYTT</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Sports news, data-driven match previews and betting tips. Independent
            coverage, no hype.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Sections
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="text-foreground/80 hover:text-primary">
                Latest news
              </Link>
            </li>
            <li>
              <Link to="/tips" className="text-foreground/80 hover:text-primary">
                Betting tips
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            About
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-foreground/80">
            <li>Editorial standards</li>
            <li>How we model odds</li>
            <li>Contact</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Play responsibly
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            18+. Betting involves risk. Never stake more than you can afford to
            lose.
          </p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} oddsnytt.com — All rights reserved.
      </div>
    </footer>
  );
}
