/**
 * Client-side outfit visualization.
 *
 * Calls the standard Gemini image model directly from the browser using
 * VITE_GEMINI_API_KEY. There is no local overlay/canvas fallback — if Gemini
 * cannot return a composed image, we surface a graceful error instead.
 */

export interface OutfitInput {
  topImage?: string;
  bottomImage?: string;
  personImage: string;
}

export interface OutfitOutput {
  image: string;
  source: "gemini";
  note?: string;
}

const MODEL = "gemini-2.5-flash-image";

export const OUTFIT_ERROR = "Unable to generate visual composition with this content";

function stripDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/jpeg", data: dataUrl };
}

function buildPrompt(input: OutfitInput): string {
  const both = Boolean(input.topImage && input.bottomImage);
  const target = both
    ? "the top garment AND the bottom garment (pants/skirt) together as one complete outfit"
    : input.topImage
      ? "the top garment"
      : "the bottom garment";

  return `Virtual try-on task. Image order: ${
    [
      input.topImage ? "1) top garment" : null,
      input.bottomImage ? `${input.topImage ? "2" : "1"}) bottom garment` : null,
      `${[input.topImage, input.bottomImage].filter(Boolean).length + 1}) the person`,
    ]
      .filter(Boolean)
      .join(", ")
  }.

Generate a brand-new, single photo-realistic photograph of the person from the person image actually WEARING ${target}.

Requirements:
- Do NOT paste, overlay, collage or float the garment images on top of the person. Re-render the garments as real worn clothing on the body.
- Match perspective and camera angle of the person photo; wrap the garments around the body with correct 3D fit, drape and fabric folds.
- Preserve the garment's exact colour, pattern, print, texture and material appearance.
- Preserve the person's identity, face, hair, skin tone, body proportions, pose and the original background.
- Match lighting direction, shading, contact shadows, occlusion and colour temperature so the clothing looks physically present.
- Replace whatever clothing the person currently wears in those regions.
Output only the final composited image.`;
}

async function callGemini(input: OutfitInput): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY — add it to your .env to generate outfits.");

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<Record<string, unknown>> = [];
  for (const img of [input.topImage, input.bottomImage, input.personImage]) {
    if (!img) continue;
    parts.push({ inlineData: stripDataUrl(img) });
  }
  parts.push({ text: buildPrompt(input) });

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  const candidateParts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of candidateParts) {
    const inline = part.inlineData;
    if (inline?.data) {
      return `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`;
    }
  }
  return null;
}

export async function generateOutfit(input: OutfitInput): Promise<OutfitOutput> {
  let image: string | null = null;
  try {
    image = await callGemini(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("VITE_GEMINI_API_KEY")) throw new Error(msg);
    throw new Error(`${OUTFIT_ERROR}${msg ? ` (${msg})` : ""}`);
  }
  if (!image) throw new Error(OUTFIT_ERROR);
  return { image, source: "gemini" };
}
