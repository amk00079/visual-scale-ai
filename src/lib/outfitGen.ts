/**
 * Client-side outfit visualization.
 *
 * Calls the standard Gemini API directly from the browser using
 * VITE_GEMINI_API_KEY — no Lovable Cloud / paid gateway involved.
 * If Gemini can't produce a composed image (missing key, quota, refusal,
 * network error), we fall back to a locally rendered canvas-blended
 * preview so the action always succeeds.
 */

export interface OutfitInput {
  topImage?: string;
  bottomImage?: string;
  personImage: string;
}

export interface OutfitOutput {
  image: string;
  source: "gemini" | "fallback";
  note?: string;
}

const MODEL = "gemini-2.5-flash-image";

function stripDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/jpeg", data: dataUrl };
}

function buildPrompt(input: OutfitInput): string {
  const both = Boolean(input.topImage && input.bottomImage);
  const target = both
    ? "both the top and the bottom garment together as a complete outfit"
    : input.topImage
      ? "the top garment"
      : "the bottom garment";
  return `You are a virtual try-on compositor. The final image provided is the person/model; the earlier image(s) are garments (top first when present, then bottom).
Generate one photorealistic full-body image of the person wearing ${target}.
Keep the person's exact pose, body proportions, face, skin tone, hair, lighting and background unchanged. Composite the garments with realistic fit, fabric folds, shadows and scale, replacing the clothing currently worn in those areas. Output only the final image.`;
}

async function callGemini(input: OutfitInput): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(input) }];
  for (const img of [input.topImage, input.bottomImage, input.personImage]) {
    if (!img) continue;
    parts.push({ inlineData: stripDataUrl(img) });
  }

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

/** Local canvas mock: person as base, garments blended over torso / legs. */
async function canvasFallback(input: OutfitInput): Promise<string> {
  const person = await loadImage(input.personImage);
  const w = Math.min(person.naturalWidth || 768, 768);
  const h = Math.round((person.naturalHeight / person.naturalWidth) * w) || 1152;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render the preview");

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(person, 0, 0, w, h);

  const drawGarment = async (src: string, top: number, height: number) => {
    const g = await loadImage(src);
    const boxW = w * 0.62;
    const boxH = h * height;
    const scale = Math.min(boxW / g.naturalWidth, boxH / g.naturalHeight);
    const gw = g.naturalWidth * scale;
    const gh = g.naturalHeight * scale;
    const x = (w - gw) / 2;
    const y = h * top + (boxH - gh) / 2;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(g, x, y, gw, gh);
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(g, x, y, gw, gh);
    ctx.restore();
  };

  if (input.topImage) await drawGarment(input.topImage, 0.2, 0.3);
  if (input.bottomImage) await drawGarment(input.bottomImage, 0.5, 0.32);

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(15,23,42,0.72)";
  ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = "#c4b5fd";
  ctx.font = "500 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Preview mock · local canvas blend", w / 2, h - 12);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function generateOutfit(input: OutfitInput): Promise<OutfitOutput> {
  try {
    const image = await callGemini(input);
    if (image) return { image, source: "gemini" };
    return {
      image: await canvasFallback(input),
      source: "fallback",
      note: import.meta.env.VITE_GEMINI_API_KEY
        ? "Gemini couldn't compose this outfit — showing a local blended mock preview."
        : "No VITE_GEMINI_API_KEY set — showing a local blended mock preview.",
    };
  } catch (e) {
    return {
      image: await canvasFallback(input),
      source: "fallback",
      note: `Gemini call failed (${
        e instanceof Error ? e.message : "unknown error"
      }) — showing a local blended mock preview.`,
    };
  }
}
