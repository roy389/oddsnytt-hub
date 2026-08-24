// Genererer dagens oddstips (src/content/tips/dagens-oddstips-YYYY-MM-DD.md)
// basert på faktiske odds (fotball-odds.json) og faktisk formdata (team-form.json).
//
// Bruker Anthropic API med tvunget verktøy-skjema, slik at output alltid er
// strukturert JSON som matcher frontmatter-formatet i tips-collectionen.
//
// VIKTIG: Skriver ALDRI om formkurve for lag med færre enn 2 spilte kamper i
// inneværende sesong - da instrueres modellen til kun å forholde seg til odds,
// tabellplassering (hvis tilgjengelig) og generell kontekst.
//
// VIKTIG: AI-genererte kamper kobles sammen med de faktiske oddsdataene ved å
// matche på lagnavn (home/away), IKKE på rekkefølge/indeks - dette forhindrer
// at tekst fra én kamp ved en feil havner under en annen kamp i frontmatter.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const ODDS_FILE = "src/data/fotball-odds.json";
const FORM_FILE = "src/data/team-form.json";
const OUTPUT_DIR = "src/content/tips";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("Mangler ANTHROPIC_API_KEY i miljøet. Avbryter.");
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
const MIN_PLAYED_FOR_FORM = 2;
const NUM_MATCHES_TO_PICK = 3;

function formatFormNote(teamName, formData) {
  if (!formData) {
    return `${teamName}: Ingen tabell-/formdata tilgjengelig. IKKE skriv om formkurve for dette laget.`;
  }
  const { position, points, played, recentMatches } = formData;
  if (played === null || played < MIN_PLAYED_FOR_FORM) {
    const posText = position ? `Tabellplassering: ${position}. ` : "";
    return `${teamName}: For tidlig i sesongen for formanalyse (kun ${played ?? 0} kamp(er) spilt). ${posText}IKKE skriv om formkurve, siste kamper eller resultatserie for dette laget - fokuser på generell kontekst hvis noe skal sies.`;
  }
  const matchLines = recentMatches
    .map((m) => `${m.home} ${m.score} ${m.away} (${m.date?.slice(0, 10)})`)
    .join("; ");
  return `${teamName}: Tabellplassering ${position ?? "ukjent"}, ${points ?? "?"} poeng på ${played} kamper. Siste resultater: ${matchLines || "ingen tilgjengelig"}.`;
}

function pickTodaysMatches(oddsData) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysMatches = oddsData.matches.filter(
    (m) => m.kickoff.slice(0, 10) === today
  );
  return todaysMatches
    .sort((a, b) => b.bookmakerCount - a.bookmakerCount)
    .slice(0, NUM_MATCHES_TO_PICK);
}

function buildContextBlock(matches, formData) {
  return matches
    .map((m, i) => {
      const homeForm = formatFormNote(m.home, formData.teams?.[m.home]);
      const awayForm = formatFormNote(m.away, formData.teams?.[m.away]);
      return `KAMP ${i + 1}:
Liga: ${m.league}
${m.home} - ${m.away}
Avspark: ${m.kickoff}
Odds (markedets beste pris): Hjemme ${m.odds.home}, Uavgjort ${m.odds.draw}, Borte ${m.odds.away} (basert på ${m.bookmakerCount} bookmakere)
${homeForm}
${awayForm}`;
    })
    .join("\n\n");
}

async function callAnthropic(contextBlock, dateStr) {
  const systemPrompt = `Du er en norsk sportsjournalist som skriver dagens oddstips for oddsnytt.com.

ABSOLUTT FORBUD MOT FABRIKERTE FAKTA:
- Du får oppgitt faktiske odds, tabellplasseringer og (der tilgjengelig) siste kampresultater. Du skal KUN bruke disse dataene.
- Du skal ALDRI dikte opp kampresultater, spillernavn, skader, formkurver eller statistikk som ikke eksplisitt er oppgitt i konteksten under.
- Hvis et lag er merket "IKKE skriv om formkurve", skal du under ingen omstendighet nevne resultatserie, seiersrekke, tapsrekke eller lignende for det laget. Fokuser i stedet på oddsene, tabellplassering (hvis oppgitt), eller generell kontekst om kampen/ligaen.
- Bruk aldri fraser som "garantert gevinst", "sikker vinner" eller lignende - dette er analyse, ikke garantier.
- Skriv på norsk (bokmål), i en nøktern og saklig tone: konkret, faktabasert, men lesbart.
- VIKTIG: Sørg for at "home" og "away" i hvert element i "matches"-arrayet du returnerer, EKSAKT matcher lagnavnene i konteksten du fikk oppgitt for akkurat den kampen. Ikke bytt om rekkefølge eller bland sammen kamper.

For hver kamp skal du velge ETT tydelig marked å anbefale (f.eks. "Hjemmeseier (1)", "Borteseier (2)", "Uavgjort (X)") basert på oddsene og eventuell formdata, og gi en tillitsgrad (confidence) fra 1-5.`;

  const userPrompt = `Dagens dato: ${dateStr}

Her er dagens utvalgte kamper med faktiske odds og formdata:

${contextBlock}

Skriv dagens oddstips-artikkel for disse ${NUM_MATCHES_TO_PICK} kampene. Husk: "home" og "away" i hvert matches-element må EKSAKT matche lagnavnene oppgitt over for akkurat den kampen.`;

  const toolSchema = {
    name: "publish_oddstips",
    description: "Publiser dagens oddstips-artikkel",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: `Tittel, f.eks. "Dagens oddstips – ${dateStr}"` },
        description: { type: "string", description: "Kort meta-beskrivelse, 1-2 setninger" },
        intro: { type: "string", description: "Innledende avsnitt (brødtekst før matches-listen)" },
        outro: { type: "string", description: "Avsluttende avsnitt med ansvarlig spill-påminnelse" },
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              home: { type: "string", description: "Må eksakt matche hjemmelagets navn fra konteksten" },
              away: { type: "string", description: "Må eksakt matche bortelagets navn fra konteksten" },
              league: { type: "string" },
              market: { type: "string" },
              confidence: { type: "integer", minimum: 1, maximum: 5 },
              reasoning: { type: "string", description: "Begrunnelse, 3-6 setninger, kun basert på oppgitte fakta for NETTOPP DENNE kampen" },
            },
            required: ["home", "away", "league", "market", "confidence", "reasoning"],
          },
        },
      },
      required: ["title", "description", "intro", "outro", "matches"],
    },
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [toolSchema],
      tool_choice: { type: "tool", name: "publish_oddstips" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API-feil: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
