import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type PublishedBookmaker = CollectionEntry<'bookmakere'> & {
  data: CollectionEntry<'bookmakere'>['data'] & {
    rating: number;
    founded: number;
    norwegianSupport: boolean;
  };
};

export function isPublishedBookmaker(
  entry: CollectionEntry<'bookmakere'>,
): entry is PublishedBookmaker {
  return (
    entry.data.verified === true &&
    entry.data.rating !== undefined &&
    entry.data.founded !== undefined &&
    entry.data.norwegianSupport !== undefined
  );
}

type TipMatch = CollectionEntry<'tips'>['data']['matches'][number];

export type ResolvedTip = {
  entry: CollectionEntry<'tips'>;
  matches: Array<{ match: TipMatch; bookmaker: PublishedBookmaker }>;
};

// A tips day only publishes once every referenced bookmaker is itself published.
export async function getPublishableTips(): Promise<ResolvedTip[]> {
  const allTips = await getCollection('tips');
  const results: ResolvedTip[] = [];

  for (const entry of allTips) {
    const matches: ResolvedTip['matches'] = [];
    let allVerified = true;

    for (const match of entry.data.matches) {
      const bookmaker = await getEntry(match.bookmaker);
      if (!bookmaker || !isPublishedBookmaker(bookmaker)) {
        allVerified = false;
        break;
      }
      matches.push({ match, bookmaker });
    }

    if (allVerified) {
      results.push({ entry, matches });
    }
  }

  return results;
}
