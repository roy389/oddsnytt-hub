import heroStadium from "@/assets/hero-stadium.jpg";
import articleFootball from "@/assets/article-football.jpg";
import articleBasket from "@/assets/article-basket.jpg";
import articleTennis from "@/assets/article-tennis.jpg";

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  publishedAt: string;
  author: string;
};

export type Tip = {
  league: string;
  home: string;
  away: string;
  kickoff: string;
  pick: string;
  odds: string;
  confidence: number;
  live?: boolean;
};

/**
 * Placeholder content. Replace with the real data source (CMS / Cloud tables)
 * when the custom prompt logic is wired in.
 */
export const featured: Article = {
  slug: "premier-league-weekend-preview",
  title: "Premier League weekend preview: value hides in the late kickoffs",
  excerpt:
    "Three underpriced away sides, one goalkeeper in freefall form, and why the Saturday 18:30 slot is where the market is slowest to react.",
  category: "Football",
  image: heroStadium,
  readTime: "6 min",
  publishedAt: "2026-08-15",
  author: "OddsNytt Desk",
};

export const articles: Article[] = [
  {
    slug: "xg-model-vs-market",
    title: "Our xG model beat the closing line 11 weeks straight",
    excerpt:
      "A breakdown of where expected-goals data still finds edge against sharp books, and the two leagues where it clearly does not.",
    category: "Analysis",
    image: articleFootball,
    readTime: "8 min",
    publishedAt: "2026-08-14",
    author: "Mats Lie",
  },
  {
    slug: "nba-summer-futures",
    title: "NBA futures: the three win totals already mispriced",
    excerpt:
      "Roster churn has moved faster than the numbers. Here is where the offseason market has not caught up yet.",
    category: "Basketball",
    image: articleBasket,
    readTime: "5 min",
    publishedAt: "2026-08-13",
    author: "Ida Sørhus",
  },
  {
    slug: "us-open-serve-metrics",
    title: "US Open: serve metrics that actually predict upsets",
    excerpt:
      "Second-serve points won beats ranking for hard-court first rounds. We tested it across eight seasons of draws.",
    category: "Tennis",
    image: articleTennis,
    readTime: "7 min",
    publishedAt: "2026-08-12",
    author: "Jonas Vik",
  },
  {
    slug: "bankroll-staking-plans",
    title: "Staking plans compared: flat, Kelly, and everything in between",
    excerpt:
      "Simulated over 10,000 bets at a 3% edge — what each plan does to variance, drawdown, and your patience.",
    category: "Strategy",
    image: articleFootball,
    readTime: "9 min",
    publishedAt: "2026-08-11",
    author: "OddsNytt Desk",
  },
  {
    slug: "closing-line-value",
    title: "Closing line value is the only scoreboard that matters",
    excerpt:
      "Why beating the close predicts long-run profit better than your win rate ever will.",
    category: "Strategy",
    image: articleTennis,
    readTime: "4 min",
    publishedAt: "2026-08-10",
    author: "Mats Lie",
  },
  {
    slug: "eliteserien-midseason",
    title: "Eliteserien midseason: promotion race in one chart",
    excerpt:
      "Points per match, schedule strength, and the two clubs whose form is about to regress hard.",
    category: "Football",
    image: articleBasket,
    readTime: "6 min",
    publishedAt: "2026-08-09",
    author: "Ida Sørhus",
  },
];

export const tips: Tip[] = [
  {
    league: "Premier League",
    home: "Arsenal",
    away: "Brighton",
    kickoff: "Sat 18:30",
    pick: "Over 2.5 goals",
    odds: "1.87",
    confidence: 78,
  },
  {
    league: "La Liga",
    home: "Sevilla",
    away: "Real Betis",
    kickoff: "Sat 21:00",
    pick: "Betis draw no bet",
    odds: "2.05",
    confidence: 65,
    live: true,
  },
  {
    league: "Serie A",
    home: "Atalanta",
    away: "Torino",
    kickoff: "Sun 15:00",
    pick: "Atalanta -1 AH",
    odds: "2.20",
    confidence: 61,
  },
  {
    league: "Eliteserien",
    home: "Bodø/Glimt",
    away: "Molde",
    kickoff: "Sun 18:00",
    pick: "BTTS yes",
    odds: "1.72",
    confidence: 72,
  },
];

export const categories = [
  "Football",
  "Basketball",
  "Tennis",
  "Analysis",
  "Strategy",
];
