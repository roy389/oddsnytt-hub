import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleCard } from "@/components/ArticleCard";
import { TipCard } from "@/components/TipCard";
import { articles, featured, tips } from "@/data/content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "OddsNytt — Sports News, Match Previews & Betting Tips",
      },
      {
        name: "description",
        content:
          "Data-driven sports news, match predictions and betting tips across football, basketball and tennis. Daily value picks with transparent odds.",
      },
      {
        property: "og:title",
        content: "OddsNytt — Sports News, Match Previews & Betting Tips",
      },
      {
        property: "og:description",
        content:
          "Data-driven sports news, match predictions and betting tips with transparent odds and confidence ratings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const lead = articles[0]!;
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative border-b border-border">
          <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 lg:py-16">
            <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
              <Link
                to="/article/$slug"
                params={{ slug: featured.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    width={1600}
                    height={900}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Featured · {featured.category}
                  </span>
                  <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">
                    {featured.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-muted-foreground">
                    {featured.excerpt}
                  </p>
                  <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{featured.author}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {featured.readTime}
                    </span>
                  </div>
                </div>
              </Link>

              <aside>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl">Today&apos;s tips</h2>
                  <Link
                    to="/tips"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    All tips <ArrowRight className="size-4" />
                  </Link>
                </div>
                <div className="mt-4 grid gap-4">
                  {tips.slice(0, 3).map((tip) => (
                    <TipCard key={`${tip.home}-${tip.away}`} tip={tip} />
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Latest grid */}
        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <h2 className="text-3xl">Latest analysis</h2>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Updated daily
            </span>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-2">
              <ArticleCard article={lead} />
            </div>
            {rest.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
