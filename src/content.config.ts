import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sportEnum = z.enum(['fotball', 'tennis', 'basketball', 'ishockey', 'annet']);

const tips = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/tips' }),
  schema: () =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      sport: sportEnum,
      matches: z
        .array(
          z.object({
            home: z.string(),
            away: z.string(),
            league: z.string(),
            kickoff: z.coerce.date(),
            market: z.string(),
            odds: z.number().positive(),
            bookmaker: reference('bookmakere'),
            confidence: z.number().int().min(1).max(5),
            reasoning: z.string().min(300),
          }),
        )
        .min(1),
      description: z.string().min(140).max(160),
    }),
});

const nyheter = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/nyheter' }),
  schema: () =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      author: reference('personas'),
      category: z.string(),
      image: z.string(),
      imageAlt: z.string(),
      description: z.string().min(140).max(160),
      tags: z.array(z.string()),
    }),
});

const bookmakere = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bookmakere' }),
  schema: () =>
    z.object({
      name: z.string(),
      slug: z.string(),
      // Unset (rather than a fabricated number/boolean) while verified: false;
      // required in practice once verified: true, enforced by editorial review, not the type.
      rating: z.number().min(1).max(10).multipleOf(0.1).optional(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      license: z.string(),
      founded: z.number().int().optional(),
      owner: z.string(),
      bonus: z.object({
        headline: z.string(),
        terms: z.string(),
        wagering: z.string(),
        minDeposit: z.string(),
      }),
      payments: z.array(z.string()),
      withdrawalTime: z.string(),
      support: z.array(z.string()),
      norwegianSupport: z.boolean().optional(),
      affiliateUrl: z.string().url(),
      lastUpdated: z.coerce.date(),
      verified: z.boolean(),
    }),
});

const personas = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/personas' }),
  schema: z.object({
    name: z.string(),
    fagfelt: z.string(),
    tone: z.string(),
    skrivestil: z.string(),
  }),
});

export const collections = { tips, nyheter, bookmakere, personas };
