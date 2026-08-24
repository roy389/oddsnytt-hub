// Genererer én nyhetsartikkel (src/content/nyheter/<slug>.md) basert på
// faktiske, web-søk-verifiserte idrettsnyheter fra siste døgn - på tvers av
// alle idretter, ikke bare fotball.
//
// Pipeline (alle steg må lykkes, ellers avbrytes uten å publisere noe):
//   1. Research: Anthropic + web-søk finner 1-3 konkrete, aktuelle saker
//   2. Skriving: Anthropic skriver artikkel KUN basert på research-funnene
//   3. Faktasjekk: hver konkret påstand i artikkelen verifiseres på nytt
//      mot uavhengig søk. Finner den noe som IKKE kan bekreftes -> avbryt.
//   4. Bilde: Gemini genererer en illustrasjon (ingen ekte ansikter/spillere)
//   5. Skriv til fil, klar for PR-workflow
//
// Hvis research ikke finner noe substansielt og verifiserbart, avsluttes
// scriptet uten å skrive noen fil - vi tvinger ikke fram en artikkel.

import { writeFile, mkdir } from "node:fs/promises";

const OUTPUT_DIR = "src/content/nyheter";
const IMAGE_DIR = "public/images/nyheter";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("Mangler ANTHROPIC_API_KEY. Avbryter.");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Mangler GEMINI_API_KEY. Avbryter.");
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
const PERSONAS = ["maren-kolstad", "sindre-aas"];

function pickPersonaForToday() {
  // Enkel, deterministisk rotasjon basert på dato - samme dag gir alltid
  // samme persona (nyttig ved re-kjøring), men veksler dag for dag.
  const dayIndex = Math.floor(Date.now() / 86400000);
  return PERSONAS[dayIndex % PERSONAS.length];
}

async function anthropicCall({ system, user, tools, toolChoice, maxTokens = 4096 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API-feil: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
  }
  return res.json();
}

// STEG 1: Research via web-søk. Returnerer rå tekst-sammendrag av det som
// faktisk ble funnet, eller null hvis ingenting substansielt dukket opp.
async function research() {
  const today = new Date().toISOString().slice(0, 10);
  const data = await anthropicCall({
    maxTokens: 2048,
    system: `Du er en research-assistent for en norsk sportsnettside. Du skal søke opp aktuelle, konkrete idrettsnyheter fra siste døgn - på tvers av ALLE idretter (fotball, tennis, håndball, langrenn, sykkel, friidrett, ski, osv.), ikke bare fotball.

Finn 1-3 konkrete saker som:
- Faktisk har skjedd de siste 24-48 timene
- Har verifiserbare detaljer (navn, resultat, dato, sted)
- Er interessante for norske lesere (norsk idrett, eller store internasjonale saker)

Hvis du ikke finner noe substansielt og godt verifiserbart, si det tydelig i stedet for å presse fram noe tynt.`,
    user: `Dagens dato: ${today}. Søk opp aktuelle idrettsnyheter fra siste døgn og oppsummer det du finner, med kilder.`,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const textBlocks = data.content?.filter((c) => c.type === "text") ?? [];
  const summary = textBlocks.map((t) => t.text).join("\n\n").trim();

  if (!summary || summary.length < 100) {
    return null;
  }
  return summary;
}

async function main() {
  console.log("Steg 1: Research...");
  const researchSummary = await research();

  if (!researchSummary) {
    console.log("Fant ingen substansiell, verifiserbar sak i dag. Avslutter uten å publisere noe.");
    return;
  }

  console.log("Research-funn:\n" + researchSummary);
  console.log("\n(Steg 2-5 kommer i neste iterasjon av scriptet)");

  // Midlertidig: skriv research-funnet til en loggfil vi kan inspisere,
  // slik at vi kan teste research-steget isolert før vi bygger videre.
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/research-output.txt", researchSummary, "utf-8");
  console.log("\nSkrev research-output til tmp/research-output.txt for inspeksjon.");
}

main().catch((err) => {
  console.error("Feil under generering av nyhetsartikkel:", err);
  process.exit(1);
});
