// Genererer dagens oddstips (src/content/tips/dagens-oddstips-YYYY-MM-DD.md)
// basert på faktiske odds (fotball-odds.json) og faktisk formdata (team-form.json).
//
// Bruker Anthropic API med tvunget verktøy-skjema, slik at output alltid er
// strukturert JSON som matcher frontmatter-formatet i tips-collectionen.
//
// VIKTIG: Skriver ALDRI om formkurve for lag med færre enn 2 spilte kamper i
// inneværende sesong - da instrueres modellen til kun å forholde seg til odds,
// tabellplassering (hvis tilgjengelig) og generell kontekst.

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
  // Prioriter kamper med flest bookmakere (mest pålitelig odds-snitt),
  // og spre gjerne på ulike ligaer for variasjon.
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
- Skriv på norsk (bokmål), i en nøktern og saklig tone som i eksempelet: konkret, faktabasert, men lesbart.

For hver kamp skal du velge ETT tydelig marked å anbefale (f.eks. "Hjemmeseier (1)", "Borteseier (2)", "Uavgjort (X)") basert på oddsene og eventuell formdata, og gi en tillitsgrad (confidence) fra 1-5.`;

  const userPrompt = `Dagens dato: ${dateStr}

Her er dagens utvalgte kamper med faktiske odds og formdata:

${contextBlock}

Skriv dagens oddstips-artikkel for disse ${NUM_MATCHES_TO_PICK} kampene.`;

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
              home: { type: "string" },
              away: { type: "string" },
              league: { type: "string" },
              market: { type: "string" },
              confidence: { type: "integer", minimum: 1, maximum: 5 },
              reasoning: { type: "string", description: "Begrunnelse, 3-6 setninger, kun basert på oppgitte fakta" },
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
  }

  const data = await res.json();
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  if (!toolUse) {
    throw new Error("Ingen tool_use-blokk i Anthropic-responsen.");
  }
  return toolUse.input;
}

function buildFrontmatter(draft, matches, dateStr) {
  const matchesYaml = matches
    .map((m, i) => {
      const d = draft.matches[i];
      const reasoningIndented = d.reasoning
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n");
      return `  - home: "${m.home}"
    away: "${m.away}"
    league: "${d.league}"
    kickoff: ${m.kickoff}
    market: "${d.market}"
    odds: ${m.odds.home}
    bookmaker: "the-odds-api"
    confidence: ${d.confidence}
    reasoning: >-
${reasoningIndented}`;
    })
    .join("\n");

  return `---
title: "${draft.title}"
date: ${dateStr}
sport: "fotball"
description: "${draft.description}"
matches:
${matchesYaml}
---
${draft.intro}

${draft.outro}
`;
}

async function main() {
  const oddsData = JSON.parse(await readFile(ODDS_FILE, "utf-8"));
  const formData = JSON.parse(
    await readFile(FORM_FILE, "utf-8").catch(() => "{}")
  );

  const matches = pickTodaysMatches(oddsData);
  if (matches.length === 0) {
    console.log("Ingen kamper i dag - skriver ingen oddstips-artikkel.");
    return;
  }

  const contextBlock = buildContextBlock(matches, formData);
  console.log("Kontekst sendt til Anthropic:\n" + contextBlock);

  const dateStr = new Date().toISOString().slice(0, 10);
  console.log("\nGenererer artikkel via Anthropic...");
  const draft = await callAnthropic(contextBlock, dateStr);

  if (!draft.matches || draft.matches.length !== matches.length) {
    throw new Error(
      `Uventet antall kamper i respons: forventet ${matches.length}, fikk ${draft.matches?.length}`
    );
  }

  const markdown = buildFrontmatter(draft, matches, dateStr);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = `${OUTPUT_DIR}/dagens-oddstips-${dateStr}.md`;
  await writeFile(outPath, markdown, "utf-8");
  console.log(`\nSkrev artikkel til ${outPath}`);
}

main().catch((err) => {
  console.error("Feil under generering av oddstips:", err);
  process.exit(1);
});
