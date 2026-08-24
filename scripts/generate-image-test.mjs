// Engangs-script for å teste Gemini-bildegenerering for én spesifikk artikkel.
// Kjøres manuelt, skriver bildet til public/images/nyheter/.

import { writeFile, mkdir } from "node:fs/promises";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error("Mangler GEMINI_API_KEY. Avbryter.");
  process.exit(1);
}

const OUTPUT_PATH = "public/images/nyheter/nm-friidrett-2026-kongepokal.png";

// Streng sikkerhetsinstruks: ingen gjenkjennelige ansikter, ingen forsøk på
// å gjengi ekte, navngitte utøvere - kun generisk, atmosfærisk sportsbilde.
const PROMPT = `A cinematic, editorial-quality photograph of a Norwegian athletics stadium at dusk during a national championship event. Wide shot showing a red running track with lane markings, floodlights creating warm glow against a deep blue evening sky, stadium stands with blurred crowd silhouettes in the background. Focus on the atmosphere and energy of elite track and field competition - motion blur suggesting a sprinter mid-race in the foreground, or alternatively a pole vault setup with dramatic lighting. Professional sports photography style, shallow depth of field, warm and cool color contrast (amber floodlights against blue dusk sky). No visible faces, no recognizable individuals, no text or logos, no specific identifiable athletes - purely atmospheric and generic. High detail, photorealistic, magazine-quality sports photography.`;

async function generateImage() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API-feil: ${res.status} ${res.statusText} — ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    console.error("Fullt Gemini-svar (ingen bilde funnet):", JSON.stringify(data, null, 2));
    throw new Error("Fant ikke bildedata i Gemini-responsen.");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function main() {
  console.log("Genererer bilde via Gemini...");
  const imageBuffer = await generateImage();

  await mkdir("public/images/nyheter", { recursive: true });
  await writeFile(OUTPUT_PATH, imageBuffer);
  console.log(`Skrev bilde til ${OUTPUT_PATH} (${imageBuffer.length} bytes)`);
}

main().catch((err) => {
  console.error("Feil under bildegenerering:", err);
  process.exit(1);
});
