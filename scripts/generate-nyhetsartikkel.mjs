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
