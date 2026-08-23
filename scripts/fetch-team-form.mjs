// Henter faktisk formdata (siste kamper, tabellplassering) fra Fotmob
// for lagene som spiller i dagens kamper, basert på fotball-odds.json

import { readFile, writeFile } from "node:fs/promises";

const ODDS_FILE = "src/data/fotball-odds.json";
const OUTPUT_FILE = "src/data/team-form.json";

const LEAGUE_IDS = {
  "EPL": 47,
  "La Liga - Spain": 87,
  "Serie A - Italy": 55,
  "Ligue 1 - France": 53,
  "Bundesliga - Germany": 54,
  "Eliteserien - Norway": 59,
};

async function fetchLeagueData(leagueId) {
  const url = `https://www.fotmob.com/api/data/leagues?id=${leagueId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; oddsnytt-bot/1.0)" },
  });
  if (!res.ok) {
    console.warn(`Fotmob feilet for liga ${leagueId}: ${res.status}`);
    return null;
  }
  return res.json();
}

function extractTeamForm(leagueData, teamName) {
  if (!leagueData) return null;

  let tableRow = null;
  try {
    const table = leagueData.table?.[0]?.data?.table?.all
      ?? leagueData.overview?.table?.[0]?.data?.table?.all
      ?? [];
    tableRow = table.find(
      (row) => row.name?.toLowerCase() === teamName.toLowerCase()
    );
  } catch {
    // ignorer
  }

  let recentMatches = [];
  try {
    const allMatches = leagueData.matches?.allMatches
      ?? leagueData.fixtures?.allMatches
      ?? [];
    recentMatches = allMatches
      .filter(
        (m) =>
          m.status?.finished &&
          (m.home?.name?.toLowerCase() === teamName.toLowerCase() ||
            m.away?.name?.toLowerCase() === teamName.toLowerCase())
      )
      .slice(-5)
      .map((m) => ({
        home: m.home?.name,
        away: m.away?.name,
        score: m.status?.scoreStr ?? null,
        date: m.status?.utcTime ?? null,
      }));
  } catch {
    // ignorer
  }

  return {
    position: tableRow?.idx ?? null,
    points: tableRow?.pts ?? null,
    played: tableRow?.played ?? null,
    recentMatches,
  };
}

async function main() {
  const oddsRaw = await readFile(ODDS_FILE, "utf-8");
  const oddsData = JSON.parse(oddsRaw);

  const today = new Date().toISOString().slice(0, 10);
  const todaysMatches = oddsData.matches.filter(
    (m) => m.kickoff.slice(0, 10) === today
  );

  if (todaysMatches.length === 0) {
    console.log("Ingen kamper i dag, avslutter uten å skrive team-form.json");
    return;
  }

  const neededLeagues = [...new Set(todaysMatches.map((m) => m.league))];
  const leagueDataCache = {};

  for (const league of neededLeagues) {
    const leagueId = LEAGUE_IDS[league];
    if (!leagueId) {
      console.warn(`Ingen kjent Fotmob-ID for liga: ${league}`);
      continue;
    }
    console.log(`Henter Fotmob-data for ${league} (id ${leagueId})...`);
    leagueDataCache[league] = await fetchLeagueData(leagueId);
    await new Promise((r) => setTimeout(r, 500));
  }

  const teamForm = {};
  for (const match of todaysMatches) {
    const leagueData = leagueDataCache[match.league];
    teamForm[match.home] = extractTeamForm(leagueData, match.home);
    teamForm[match.away] = extractTeamForm(leagueData, match.away);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    date: today,
    teams: teamForm,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Skrev formdata for ${Object.keys(teamForm).length} lag til ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Feil under henting av formdata:", err);
  process.exit(1);
});
