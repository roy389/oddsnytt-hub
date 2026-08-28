// Genererer én nyhetsartikkel (src/content/nyheter/<slug>.md) basert på
// faktiske, web-søk-verifiserte idrettsnyheter fra siste døgn - på tvers av
// alle idretter, inkludert e-sport og sjakk.
//
// Pipeline (alle steg må lykkes, ellers avbrytes uten å publisere noe):
//   1. Research: Anthropic + web-søk (flere målrettede søk, ikke bare ett
//      generelt) finner 1-3 konkrete, aktuelle saker
//   2. Skriving: Anthropic skriver artikkel KUN basert på research-funnene
//   3. Faktasjekk: konkrete påstander i artikkelen verifiseres på nytt mot
//      uavhengig søk. Finner den noe som IKKE kan bekreftes -> avbryt.
//   4. Bilde: enkel, trygg kategori-basert SVG (ingen ekstern bilde-API)
//   5. Skriv til fil, klar for PR-workflow
//
// Hvis research ikke finner noe substansielt og verifiserbart, avsluttes
// scriptet uten å skrive noen fil - vi tvinger ikke fram en artikkel.
//
// VIKTIG (lagt til etter observerte falske positiver): verifyClaim() er
// eksplisitt instruert til ALDRI å konkludere "contradicted" basert på egen
// antagelse/forhåndskunnskap om hva som "virker sannsynlig" eller "burde
// stemme" - kun basert på hva et faktisk søk finner. Modellen har en tendens
// til å avvise ekte, nylige hendelser som "usannsynlige" fordi de føles
// fremtidige/uventede for den, selv når søk bekrefter dem.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUTPUT_DIR = "src/content/nyheter";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error("Mangler ANTHROPIC_API_KEY. Avbryter.");
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
const PERSONAS = ["maren-kolstad", "sindre-aas"];

const PERSONA_STYLE = {
  "maren-kolstad":
    "Skriv i en engasjert og tilgjengelig tone, men alltid faktabasert. Forklar kontekst for lesere som ikke følger sporten tett til daglig. Bruk aldri clickbait-overskrifter.",
  "sindre-aas":
    "Skriv i en nøktern og analytisk tone. Bruk korte, presise setninger. Underbygg påstander med konkrete tall og eksempler. Unngå spekulasjon og clickbait-overskrifter.",
};

const CATEGORY_IMAGES = {
  fotball: "/images/nyheter/kategorier/fotball.svg",
  friidrett: "/images/nyheter/kategorier/friidrett.svg",
  tennis: "/images/nyheter/kategorier/tennis.svg",
  håndball: "/images/nyheter/kategorier/handball.svg",
  handball: "/images/nyheter/kategorier/handball.svg",
  ski: "/images/nyheter/kategorier/vintersport.svg",
  langrenn: "/images/nyheter/kategorier/vintersport.svg",
  vintersport: "/images/nyheter/kategorier/vintersport.svg",
  esport: "/images/nyheter/kategorier/esport.svg",
  "e-sport": "/images/nyheter/kategorier/esport.svg",
  dota: "/images/nyheter/kategorier/esport.svg",
  "counter-strike": "/images/nyheter/kategorier/esport.svg",
  sjakk: "/images/nyheter/kategorier/sjakk.svg",
};
const DEFAULT_IMAGE = "/images/nyheter/kategorier/generisk.svg";

function pickPersonaForToday() {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return PERSONAS[dayIndex % PERSONAS.length];
}

function pickImage(category) {
  const norm = (category ?? "").toLowerCase();
  for (const [key, path] of Object.entries(CATEGORY_IMAGES)) {
    if (norm.includes(key)) return path;
  }
  return DEFAULT_IMAGE;
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

function extractToolInput(data, toolName) {
  const block = data.content?.find((c) => c.type === "tool_use" && c.name === toolName);
  return block?.input ?? null;
}

async function research() {
  const today = new Date().toISOString().slice(0, 10);
  const data = await anthropicCall({
    maxTokens: 2048,
    system: `Du er en research-assistent for en norsk sportsnettside. Du skal søke opp aktuelle, konkrete idrettsnyheter fra siste døgn - på tvers av ALLE idretter og idrettsgrener (fotball, tennis, håndball, langrenn, sykkel, friidrett, ski, sjakk, e-sport som CS/Counter-Strike, Dota 2, League of Legends, Valorant osv.).

VIKTIG OM SØKESTRATEGI: Ikke stol på ett enkelt, bredt søk som "idrettsnyheter i dag" - slike søk gir ofte generiske oversikter og overser konkrete, aktuelle saker. Gjør heller FLERE spesifikke søk på tvers av ulike kategorier, for eksempel:
- Norske fotballag i europeisk sammenheng (f.eks. "Bodø/Glimt Champions League i dag", "Viking Europa League resultat", "Brann Conference League")
- Norske utøvere i internasjonale mesterskap eller turneringer, i ulike idretter
- Store internasjonale turneringer/mesterskap som pågår akkurat nå, i ulike idretter (tennis Grand Slam, e-sport-turneringer, sykkelritt, osv.)
- Generelle søk som et supplement, ikke som eneste kilde

Finn 1-3 konkrete saker som:
- Faktisk har skjedd de siste 24-48 timene
- Har verifiserbare detaljer (navn, resultat, dato, sted)
- Er interessante for norske lesere (norsk idrett, eller store internasjonale saker)

Hvis du etter FLERE ulike søk fortsatt ikke finner noe substansielt og godt verifiserbart, svar med KUN ordet "INGEN_SAK_FUNNET" og ingenting annet - ikke list opp eldre/fremtidige saker eller forklar hvorfor du ikke fant noe.`,
    user: `Dagens dato: ${today}. Gjør flere målrettede søk (ikke bare ett generelt) og finn aktuelle idrettsnyheter fra siste døgn. Oppsummer det du finner, med kilder.`,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const textBlocks = data.content?.filter((c) => c.type === "text") ?? [];
  const summary = textBlocks.map((t) => t.text).join("\n\n").trim();

  if (!summary || summary.includes("INGEN_SAK_FUNNET") || summary.length < 100) {
    return null;
  }
  return summary;
}

async function writeArticle(researchSummary, persona) {
  const today = new Date().toISOString().slice(0, 10);
  const styleHint = PERSONA_STYLE[persona] ?? "";

  const toolSchema = {
    name: "publish_article",
    description: "Publiser en nyhetsartikkel",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Overskrift, ikke clickbait, presis og saklig" },
        description: {
          type: "string",
          minLength: 140,
          maxLength: 160,
          description: "Meta-beskrivelse, MÅ være mellom 140 og 160 tegn (strengt krav, tell etter)",
        },
        category: {
          type: "string",
          description: "Ett presist idrettsord som reflekterer hva saken faktisk handler om, f.eks. 'Fotball', 'E-sport', 'Sjakk'",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 6,
          description: "Relevante stikkord (navn, arrangement, klubb/lag)",
        },
        body: {
          type: "string",
          description: "Full brødtekst i Markdown, med ## som mellomoverskrifter der det passer. KUN basert på oppgitte research-funn - ingen oppdiktede detaljer.",
        },
      },
      required: ["title", "description", "category", "tags", "body"],
    },
  };

  const data = await anthropicCall({
    maxTokens: 4096,
    system: `Du er en norsk sportsjournalist som skriver for oddsnytt.com.

ABSOLUTT FORBUD MOT FABRIKERTE FAKTA:
- Du skal KUN bruke informasjonen som er oppgitt i research-sammendraget under. Ikke legg til navn, tall, resultater, sitater eller detaljer som ikke eksplisitt står der.
- Hvis du er usikker på en detalj, utelat den heller enn å gjette.
- Skriv på norsk (bokmål).
- ${styleHint}
- STRENGT KRAV: "description" MÅ være mellom 140 og 160 tegn, ikke mer, ikke mindre.
- "category" skal være ett presist ord/uttrykk som reflekterer hva SAKEN FAKTISK handler om (idretten den gjelder), ikke en fast liste.`,
    user: `Dagens dato: ${today}

Her er research-funnene å basere artikkelen på:

${researchSummary}

Skriv en komplett nyhetsartikkel basert kun på dette. Velg den mest interessante saken hvis flere er oppgitt, eller flett dem sammen hvis de naturlig hører sammen.`,
    tools: [toolSchema],
    toolChoice: { type: "tool", name: "publish_article" },
  });

  const draft = extractToolInput(data, "publish_article");
  if (!draft) {
    throw new Error("Fikk ikke strukturert artikkel-output fra Anthropic.");
  }
  return draft;
}

async function extractClaims(articleBody) {
  const toolSchema = {
    name: "report_claims",
    description: "Rapporter konkrete, verifiserbare faktapåstander fra teksten",
    input_schema: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          maxItems: 8,
          items: {
            type: "string",
            description: "Én konkret, SELVSTENDIG forståelig påstand som inkluderer nok kontekst (år, turnering/arrangement, idrett/sport) til at den kan verifiseres isolert, uten å lese resten av artikkelen",
          },
        },
      },
      required: ["claims"],
    },
  };

  const data = await anthropicCall({
    maxTokens: 1024,
    system: `Du trekker ut konkrete, verifiserbare faktapåstander (navn, tall, resultater, datoer) fra en tekst, som separate, korte setninger. Maks 8 påstander, prioriter de viktigste.

VIKTIG: Hver påstand skal være SELVSTENDIG FORSTÅELIG og verifiserbar helt alene, uten kontekst fra resten av artikkelen. Inkluder ALLTID:
- Årstall (hent fra artikkelens dato/kontekst hvis ikke eksplisitt nevnt)
- Navn på turnering/arrangement/liga
- Idrett/sport, hvis det ikke er åpenbart

Dårlig eksempel: "Finalen ble spilt søndag kveld" (mangler år, turnering, sted)
Bra eksempel: "Finalen i WTA Cincinnati 2026 ble spilt søndag 23. august"

Dårlig eksempel: "Gauff er verdens nummer fire"
Bra eksempel: "Coco Gauff var rangert som verdens nummer 4 i WTA-rankingen per august 2026"`,
    user: `Tekst:\n\n${articleBody}\n\nTrekk ut de konkrete faktapåstandene, med full kontekst i hver enkelt.`,
    tools: [toolSchema],
    toolChoice: { type: "tool", name: "report_claims" },
  });

  const result = extractToolInput(data, "report_claims");
  return result?.claims ?? [];
}

async function verifyClaim(claim) {
  const toolSchema = {
    name: "report_verification",
    description: "Rapporter verifiseringsresultat for en faktapåstand",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["confirmed", "contradicted", "unverified"],
          description: "confirmed = søk finner informasjon som STØTTER påstanden. contradicted = søk finner informasjon som AKTIVT MOTSIER påstanden (et annet, spesifikt faktum). unverified = søk finner IKKE NOK informasjon til å avgjøre (bruk dette som standardvalg ved tvil - ikke 'contradicted').",
        },
        note: { type: "string", description: "Kort begrunnelse - MÅ være logisk konsistent med status-feltet" },
      },
      required: ["status", "note"],
    },
  };

  try {
    const data = await anthropicCall({
      maxTokens: 1024,
      system: `Du er en faktasjekker. Søk opp og vurder om den oppgitte påstanden stemmer.

VIKTIGE REGLER:
1. "contradicted" skal KUN brukes når SØKET DITT faktisk finner et konkret, annet faktum som motsier påstanden. Bruk ALDRI "contradicted" basert på egen antagelse om hva som "virker sannsynlig", "burde stemme basert på normal praksis", eller "er høyst usannsynlig gitt nivået/størrelsen/historikken" til noe/noen som er nevnt.
2. Datoer og hendelser i påstanden kan omhandle noe som er nytt eller nylig for deg, selv om det føles fremtidig eller uventet. STOL PÅ SØKERESULTATENE, ikke på din egen antagelse om hva som "normalt" skjer eller hvilket år/sesong det "burde" være. Idrettslag kan oppnå uventede resultater; det er ikke i seg selv grunn til å avvise en påstand.
3. Hvis søket ikke finner nok informasjon til å bekrefte ELLER motsi påstanden, bruk "unverified" - IKKE "contradicted". Manglende informasjon, eller informasjon som virker overraskende for deg, er ALDRI det samme som en bekreftet motsigelse.
4. Hvis søket faktisk støtter påstanden (tallene/navnene/datoene stemmer overens med det pålitelige kilder sier), bruk "confirmed" - selv om resultatet virker overraskende, sensasjonelt eller uvanlig for deg.
5. FØR du svarer: les gjennom din egen "note"-tekst og sjekk at "status"-feltet du velger faktisk stemmer logisk overens med det du skriver i "note". Hvis notatet ditt sier at noe stemmer, skal status være "confirmed", ikke "contradicted". Dette er kritisk - ikke send et internt motstridende svar.`,
      user: `Verifiser denne påstanden med et uavhengig søk: "${claim}"`,
      tools: [
        { type: "web_search_20250305", name: "web_search" },
        toolSchema,
      ],
      toolChoice: { type: "tool", name: "report_verification" },
    });
    const result = extractToolInput(data, "report_verification");
    return result ?? { status: "unverified", note: "Ingen strukturert respons" };
  } catch (err) {
    return { status: "unverified", note: `Feil under verifisering: ${err.message}` };
  }
}

async function factCheck(articleBody) {
  console.log("Steg 3: Trekker ut påstander for faktasjekk...");
  const claims = await extractClaims(articleBody);
  console.log(`Fant ${claims.length} påstander å verifisere.`);

  const results = [];
  for (const claim of claims) {
    console.log(`  Verifiserer: "${claim}"`);
    const result = await verifyClaim(claim);
    console.log(`    -> ${result.status}: ${result.note}`);
    results.push({ claim, ...result });
  }

  const contradicted = results.filter((r) => r.status === "contradicted");
  const unverified = results.filter((r) => r.status === "unverified");

  if (contradicted.length > 0) {
    throw new Error(
      `Faktasjekk feilet - motstridende påstander funnet:\n${contradicted
        .map((r) => `- "${r.claim}": ${r.note}`)
        .join("\n")}`
    );
  }

  if (claims.length > 0 && unverified.length / claims.length > 0.5) {
    throw new Error(
      `Faktasjekk feilet - over halvparten av påstandene kunne ikke verifiseres (${unverified.length}/${claims.length}). Avbryter for sikkerhets skyld.`
    );
  }

  console.log("Faktasjekk bestått.");
  return results;
}

function buildMarkdown(draft, persona, dateStr) {
  const imagePath = pickImage(draft.category);
  const tagsYaml = draft.tags.map((t) => `  - "${t}"`).join("\n");

  return `---
title: "${draft.title}"
date: ${dateStr}
author: "${persona}"
category: "${draft.category}"
image: "${imagePath}"
imageAlt: "Illustrasjon knyttet til kategorien ${draft.category}"
description: "${draft.description}"
tags:
${tagsYaml}
---
${draft.body}
`;
}

async function main() {
  console.log("Steg 1: Research...");
  const researchSummary = await research();

  if (!researchSummary) {
    console.log("Fant ingen substansiell, verifiserbar sak i dag. Avslutter uten å publisere noe.");
    return;
  }
  console.log("Research-funn:\n" + researchSummary);

  const persona = pickPersonaForToday();
  console.log(`\nSteg 2: Skriver artikkel (persona: ${persona})...`);
  const draft = await writeArticle(researchSummary, persona);
  console.log(`Skrev utkast: "${draft.title}"`);

  await factCheck(draft.body);

  const dateStr = new Date().toISOString().slice(0, 10);
  const markdown = buildMarkdown(draft, persona, dateStr);
  const slug = slugify(draft.title);
  const outPath = `${OUTPUT_DIR}/${slug}.md`;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(outPath, markdown, "utf-8");
  console.log(`\nSkrev artikkel til ${outPath}`);
}

main().catch((err) => {
  console.error("Feil under generering av nyhetsartikkel:", err);
  process.exit(1);
});
