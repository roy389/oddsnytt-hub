#!/usr/bin/env node
/**
 * Henter ekte fotballodds fra The Odds API (https://the-odds-api.com) og skriver
 * dem til src/data/fotball-odds.json, som leses av /fotballodds/-siden ved neste
 * bygg.
 *
 * Kjøres daglig av .github/workflows/update-odds.yml. Krever miljøvariabelen
 * ODDS_API_KEY (satt som GitHub-hemmelighet i produksjon).
 *
 * VIKTIG: Dette skriptet henter og videreformidler RÅ markedsodds fra ekte
 * bookmakere via The Odds API. Det dikter ikke opp analyse, tillitsgrad eller
 * anbefalinger - det er bevisst holdt utenfor "tips"-collectionen (som er
 * forbeholdt ekte redaksjonell analyse skrevet av et menneske eller verifisert
 * mot primærkilder).
 */

const API_KEY = process.env.ODDS_API_KEY;
if (!API_KEY) {
  console.error('Mangler ODDS_API_KEY i miljøet. Avbryter.');
  process.exit(1);
}

const BASE_URL = 'https://api.the-odds-api.com/v4';

// Nøkler fra The Odds API sin /v4/sports/-liste. Ikke alle er nødvendigvis
// aktive/i sesong til enhver tid - skriptet håndterer det gracefully per liga.
const LEAGUE_KEYS = [
  'soccer_epl',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_norway_eliteserien',
];

const OUTPUT_PATH = new URL('../src/data/fotball-odds.json', import.meta.url);

/** @typedef {{ name: string, price: number }} Outcome */

async function fetchJson(url) {
  const res = await fetch(url);
  const remaining = res.headers.get('x-requests-remaining');
  const used = res.headers.get('x-requests-used');
  if (remaining !== null) {
    console.log(`  API-kvote: ${remaining} igjen, ${used} brukt`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `${res.status} ${res.statusText} for ${url.replace(API_KEY, 'REDACTED')} — ${body.slice(0, 300)}`,
    );
  }
  return res.json();
}

function bestOutcome(bookmakers, marketKey, outcomeName) {
  let best = null;
  const sources = [];
  for (const bm of bookmakers ?? []) {
    const market = bm.markets?.find((m) => m.key === marketKey);
    const outcome = market?.outcomes?.find((o) => o.name === outcomeName);
    if (outcome && typeof outcome.price === 'number') {
      sources.push(bm.title);
      if (!best || outcome.price > best) best = outcome.price;
    }
  }
  return { price: best, bookmakerCount: sources.length };
}

async function fetchLeagueOdds(leagueKey) {
  const url = `${BASE_URL}/sports/${leagueKey}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;
  const events = await fetchJson(url);
  const now = Date.now();

  return events
    .filter((event) => new Date(event.commence_time).getTime() > now)
    .map((event) => {
      const home = bestOutcome(event.bookmakers, 'h2h', event.home_team);
      const away = bestOutcome(event.bookmakers, 'h2h', event.away_team);
      const draw = bestOutcome(event.bookmakers, 'h2h', 'Draw');
      return {
        id: event.id,
        league: event.sport_title,
        home: event.home_team,
        away: event.away_team,
        kickoff: event.commence_time,
        odds: {
          home: home.price,
          draw: draw.price,
          away: away.price,
        },
        bookmakerCount: Math.max(home.bookmakerCount, draw.bookmakerCount, away.bookmakerCount),
      };
    })
    .filter((match) => match.odds.home !== null && match.odds.away !== null);
}

async function main() {
  const allMatches = [];
  const errors = [];

  for (const leagueKey of LEAGUE_KEYS) {
    console.log(`Henter ${leagueKey}...`);
    try {
      const matches = await fetchLeagueOdds(leagueKey);
      console.log(`  ${matches.length} kommende kamper med odds`);
      allMatches.push(...matches);
    } catch (err) {
      console.warn(`  Hopper over ${leagueKey}: ${err.message}`);
      errors.push({ league: leagueKey, error: err.message });
    }
  }

  allMatches.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'The Odds API (https://the-odds-api.com)',
    matches: allMatches,
    ...(errors.length > 0 ? { fetchErrors: errors } : {}),
  };

  const { writeFile } = await import('node:fs/promises');
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`\nSkrev ${allMatches.length} kamper til ${OUTPUT_PATH.pathname}`);

  if (allMatches.length === 0 && errors.length === LEAGUE_KEYS.length) {
    console.error('Alle ligaer feilet - avbryter med feilkode slik at workflowen flagger det.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Uventet feil:', err);
  process.exit(1);
});
