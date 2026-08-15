import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import type { Article } from "@/data/content";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="card-hover group overflow-hidden rounded-xl border border-border bg-card">
      <Link to="/article/$slug" params={{ slug: article.slug }} className="block">
        <div className="aspect-[3/2] overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            width={1200}
            height={800}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="p-5">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {article.category}
          </span>
          <h3 className="mt-2 text-xl leading-tight">{article.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {article.excerpt}
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{article.author}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {article.readTime}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
