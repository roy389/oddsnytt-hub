import { createFileRoute, notFound } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleCard } from "@/components/ArticleCard";
import { articles, featured } from "@/data/content";

const all = [featured, ...articles];

export const Route = createFileRoute("/article/$slug")({
  loader: ({ params }) => {
    const article = all.find((a) => a.slug === params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} | OddsNytt` : "Article | OddsNytt";
    const description =
      loaderData?.excerpt ?? "Sports analysis and betting insight from OddsNytt.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const article = Route.useLoaderData();
  const related = all.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          {article.category}
        </span>
        <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">{article.title}</h1>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{article.author}</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-GB")}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {article.readTime}
          </span>
        </div>

        <img
          src={article.image}
          alt={article.title}
          width={1200}
          height={800}
          className="mt-8 aspect-[3/2] w-full rounded-xl border border-border object-cover"
        />

        <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/85">
          <p className="text-lg text-foreground">{article.excerpt}</p>
          <p>
            This is placeholder article body copy. Article content will come from
            the editorial pipeline once it is connected, so the layout here is
            built to accept long-form text, data tables and embedded odds blocks
            without further styling work.
          </p>
          <h2 className="pt-2 text-2xl">What the numbers say</h2>
          <p>
            Every claim in a published piece is tied to a model output or a
            verifiable stat. Sections like this one hold the reasoning: form
            trends, schedule strength, injuries and how the market has moved
            since the line opened.
          </p>
          <h2 className="pt-2 text-2xl">The pick</h2>
          <p>
            Picks appear with the market, the price taken at time of writing and
            a confidence rating. Prices move quickly — always confirm the live
            line before staking, and never stake more than you can afford to
            lose.
          </p>
        </div>
      </main>

      <section className="mx-auto max-w-7xl px-4 pb-4">
        <h2 className="border-b border-border pb-4 text-2xl">More from OddsNytt</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {related.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
