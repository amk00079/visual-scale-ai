/**
 * Outfit visualization.
 *
 * Calls the backend /api/generate-outfit function, which uses the stored
 * HF_TOKEN secret to run Hugging Face's Qwen/Qwen-Image-Edit-2511
 * image-to-image model. No client-side canvas fallback.
 */

export interface OutfitInput {
  topImage?: string;
  bottomImage?: string;
  personImage: string;
  topLabel?: string;
  bottomLabel?: string;
}

export interface OutfitOutput {
  image: string;
  source: "huggingface";
  note?: string;
}

export const OUTFIT_ERROR = "Unable to generate visual composition with this content";

export async function generateOutfit(input: OutfitInput): Promise<OutfitOutput> {
  let res: Response;
  try {
    res = await fetch("/api/generate-outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personImage: input.personImage,
        topLabel: input.topLabel,
        bottomLabel: input.bottomLabel,
      }),
    });
  } catch {
    throw new Error(`${OUTFIT_ERROR} (network error)`);
  }

  if (!res.ok) {
    let message = "";
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      message = parsed.error ?? "";
    } catch {
      message = res.status === 413 ? "the image payload is too large" : text.slice(0, 160);
    }
    throw new Error(message || `${OUTFIT_ERROR} (${res.status})`);
  }

  const data = (await res.json()) as { image?: string };
  if (!data.image) throw new Error(OUTFIT_ERROR);
  return { image: data.image, source: "huggingface" };
}
