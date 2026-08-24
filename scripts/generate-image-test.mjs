// Engangs-script for å teste AI-bildegenerering for én spesifikk artikkel,
// via Pollinations.ai (gratis, ingen API-nøkkel nødvendig, ingen SLA).

import { writeFile, mkdir } from "node:fs/promises";

const OUTPUT_PATH = "public/images/nyheter/nm-friidrett-2026-kongepokal.png";

const PROMPT = "Cinematic editorial photograph of a Norwegian athletics stadium at dusk during a national championship. Red running track with lane markings, warm floodlights against deep blue evening sky, blurred stadium crowd in background. A sprinter in motion blur in the foreground, no visible face, no recognizable individual, no text or logos. Professional sports photography, shallow depth of field, photorealistic, magazine quality.";

async function generateImage() {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(PROMPT)}?width=1200&height=630&nologo=true`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Pollinations API-feil: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  console.log("Genererer bilde via Pollinations.ai...");
  const imageBuffer = await generateImage();

  if (imageBuffer.length < 1000) {
    throw new Error("Fikk et mistenkelig lite svar - trolig ikke et gyldig bilde.");
  }

  await mkdir("public/images/nyheter", { recursive: true });
  await writeFile(OUTPUT_PATH, imageBuffer);
  console.log(`Skrev bilde til ${OUTPUT_PATH} (${imageBuffer.length} bytes)`);
}

main().catch((err) => {
  console.error("Feil under bildegenerering:", err);
  process.exit(1);
});
