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

// Fjerner aksenter, vanlige klubb-prefikser/suffikser og normaliserer
// til små bokstaver, slik at "Atlético Madrid" matcher "Atletico Madrid"
// og "Bournemouth" matcher "AFC Bournemouth".
function normalizeTeamName(name) {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // fjern aksenter
    .toLowerCase()
    .replace(/\b(afc|cf|fc|sc|ac|ca|ss|ssc|us|rc|as|club|calcio|de|santander)\b/g, "")
    .replace(/[^a-z0-9]/g, "") // fjern mellomrom/tegn
    .trim();
}

function namesMatch(a, b) {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Delvis match: den ene normaliserte strengen inneholder den andre
  // (fanger opp f.eks. "racingsantander" vs "racing")
  if (na.length >= 4 && nb.length >= 4) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
}

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

function findTableRow(table, teamName) {
  return table.find((row) => namesMatch(row.name, teamName)) ?? null;
}

function extractTeamForm(leagueData, teamName) {
  if (!leagueData) return null;

  let tableRow = null;
  try {
    const table = leagueData.table?.[0]?.data?.table?.all
      ?? leagueData.overview?.table?.[0]?.data?.table?.all
      ?? [];
    tableRow = findTableRow(table, teamName);

    // Noen ligaer (f.eks. med grupper) har flere tabeller
    if (!tableRow) {
      const allTables = leagueData.table ?? [];
      for (const t of allTables) {
        const rows = t.data?.table?.all ?? [];
        tableRow = findTableRow(rows, teamName);
        if (tableRow) break;
      }
    }
  } catch {
    // ignorer, behold null
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
          (namesMatch(m.home?.name, teamName) || namesMatch(m.away?.name, teamName))
      )
      .sort(
        (a, b) =>
          new Date(a.status?.utcTime ?? 0).getTime() -
          new Date(b.status?.utcTime ?? 0).getTime()
      )
      .slice(-5)
      .map((m) => ({
        home: m.home?.name,
        away: m.away?.name,
        score: m.status?.scoreStr ?? null,
        date: m.status?.utcTime ?? null,
      }));
  } catch {
    // ignorer, behold tom liste
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
  const missing = [];
  for (const match of todaysMatches) {
    const leagueData = leagueDataCache[match.league];
    const homeForm = extractTeamForm(leagueData, match.home);
    const awayForm = extractTeamForm(leagueData, match.away);
    teamForm[match.home] = homeForm;
    teamForm[match.away] = awayForm;
    if (homeForm?.position === null) missing.push(match.home);
    if (awayForm?.position === null) missing.push(match.away);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    date: today,
    teams: teamForm,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Skrev formdata for ${Object.keys(teamForm).length} lag til ${OUTPUT_FILE}`);
  if (missing.length > 0) {
    console.warn(`Fant ikke tabelldata for: ${missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Feil under henting av formdata:", err);
  process.exit(1);
});
