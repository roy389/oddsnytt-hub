// Genererer dagens oddstips (src/content/tips/dagens-oddstips-YYYY-MM-DD.md)
// basert på faktiske odds (fotball-odds.json) og faktisk formdata (team-form.json).
//
// Bruker Anthropic API med tvunget verktøy-skjema, slik at output alltid er
// strukturert JSON som matcher frontmatter-formatet i tips-collectionen
// (src/content.config.ts) - inkludert de strenge kravene der:
//   - description: 140-160 tegn
//   - reasoning per kamp: minst 300 tegn
//   - bookmaker: må referere til en faktisk fil i src/content/bookmakere/
//   - odds: må matche det FAKTISKE utfallet som anbefales (hjemme/uavgjort/
//     borte), ikke alltid hjemmeoddsen uansett hva som anbefales
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
const BOOKMAKER_SLUG = "betfriday";

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
- STRENGE LENGDEKRAV (håndheves av systemet, brudd feiler hele publiseringen):
  - "description" MÅ være mellom 140 og 160 tegn, ikke mer, ikke mindre.
  - "reasoning" for HVER kamp MÅ være minst 300 tegn.

For hver kamp skal du velge ETT tydelig marked å anbefale (f.eks. "Hjemmeseier (1)", "Borteseier (2)", "Uavgjort (X)") basert på oddsene og eventuell formdata, og gi en tillitsgrad (confidence) fra 1-5. Sørg for at begrunnelsen din ("reasoning") nevner riktig oddstall for akkurat det markedet du anbefaler.`;

  const userPrompt = `Dagens dato: ${dateStr}

Her er dagens utvalgte kamper med faktiske odds og formdata:

${contextBlock}

Skriv dagens oddstips-artikkel for disse ${NUM_MATCHES_TO_PICK} kampene.
Husk de strenge kravene: "description" mellom 140-160 tegn (tell nøye etter), og "reasoning" for hver kamp på minst 300 tegn.
Husk også: "home" og "away" i hvert matches-element må EKSAKT matche lagnavnene oppgitt over for akkurat den kampen.`;

  const toolSchema = {
    name: "publish_oddstips",
    description: "Publiser dagens oddstips-artikkel",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: `Tittel, f.eks. "Dagens oddstips – ${dateStr}"` },
        description: {
          type: "string",
          minLength: 140,
          maxLength: 160,
          description: "Kort meta-beskrivelse, MÅ være mellom 140 og 160 tegn (strengt krav, tell etter)",
        },
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
              market: {
                type: "string",
                description: "Anbefalt marked, MÅ være eksakt en av: 'Hjemmeseier (1)', 'Uavgjort (X)', 'Borteseier (2)'",
              },
              confidence: { type: "integer", minimum: 1, maximum: 5 },
              reasoning: {
                type: "string",
                minLength: 300,
                description: "Begrunnelse, MINST 300 tegn (strengt krav), kun basert på oppgitte fakta for NETTOPP DENNE kampen. Må nevne riktig oddstall for det anbefalte markedet.",
              },
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

function findDraftMatch(draftMatches, originalMatch) {
  const norm = (s) => s?.toLowerCase().trim();
  return draftMatches.find(
    (d) => norm(d.home) === norm(originalMatch.home) && norm(d.away) === norm(originalMatch.away)
  );
}

function pickOddsForMarket(odds, market) {
  const m = (market ?? "").toLowerCase();
  if (m.includes("borteseier") || m.includes("(2)")) return odds.away;
  if (m.includes("uavgjort") || m.includes("(x)")) return odds.draw;
  return odds.home;
}

function validateLengths(draft) {
  const problems = [];
  const descLen = draft.description?.length ?? 0;
  if (descLen < 140 || descLen > 160) {
    problems.push(`description er ${descLen} tegn (må være 140-160)`);
  }
  for (const m of draft.matches ?? []) {
    const rLen = m.reasoning?.length ?? 0;
    if (rLen < 300) {
      problems.push(`reasoning for ${m.home}-${m.away} er ${rLen} tegn (må være minst 300)`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `AI-generert innhold overholder ikke lengdekrav, avbryter for å unngå feilet bygg:\n${problems.join("\n")}`
    );
  }
}

function buildFrontmatter(draft, matches, dateStr) {
  validateLengths(draft);

  const matchesYaml = matches
    .map((m) => {
      const d = findDraftMatch(draft.matches, m);
      if (!d) {
        throw new Error(
          `Fant ikke AI-generert tekst for kampen ${m.home} - ${m.away}. Avbryter for å unngå feilkoblet innhold.`
        );
      }
      const reasoningIndented = d.reasoning
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n");
      const selectedOdds = pickOddsForMarket(m.odds, d.market);
      return `  - home: "${m.home}"
    away: "${m.away}"
    league: "${m.league}"
    kickoff: ${m.kickoff}
    market: "${d.market}"
    odds: ${selectedOdds}
    bookmaker: "${BOOKMAKER_SLUG}"
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
