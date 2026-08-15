import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TipCard } from "@/components/TipCard";
import { tips } from "@/data/content";

export const Route = createFileRoute("/tips")({
  head: () => ({
    meta: [
      { title: "Betting Tips & Match Predictions | OddsNytt" },
      {
        name: "description",
        content:
          "Today's betting tips with odds, confidence ratings and the reasoning behind every pick — football, basketball and tennis.",
      },
      { property: "og:title", content: "Betting Tips & Match Predictions | OddsNytt" },
      {
        property: "og:description",
        content:
          "Today's betting tips with odds, confidence ratings and reasoning behind every pick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TipsPage,
});

function TipsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-14">
        <h1 className="text-4xl sm:text-5xl">Betting tips</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every pick lists the market, the price we took and a confidence rating
          from our model. Prices move — always check the current line.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip) => (
            <TipCard key={`${tip.home}-${tip.away}`} tip={tip} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
