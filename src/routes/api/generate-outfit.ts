import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  /** Data URL of the person / model photo. */
  personImage?: string;
  /** Optional garment reference images (data URLs). */
  topImage?: string;
  bottomImage?: string;
  topLabel?: string;
  bottomLabel?: string;
}

const MODEL = "Qwen/Qwen-Image-Edit-2511";
// HF Inference Providers routing for the model's live provider mapping.
const ENDPOINT = "https://router.huggingface.co/fal-ai/fal-ai/qwen-image-edit-plus";

export const Route = createFileRoute("/api/generate-outfit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.HF_TOKEN;
        if (!token) return json({ error: "Image generation is not configured" }, 500);

        const body = (await request.json()) as Body;
        const person = asDataUrl(body.personImage);
        if (!person) return json({ error: "A model/person image is required" }, 400);

        const top = asDataUrl(body.topImage);
        const bottom = asDataUrl(body.bottomImage);

        const refs: string[] = [];
        const order: string[] = ["image 1 is the person"];
        if (top) {
          refs.push(top);
          order.push(`image ${refs.length + 1} is the top garment${body.topLabel ? ` (${body.topLabel})` : ""}`);
        }
        if (bottom) {
          refs.push(bottom);
          order.push(
            `image ${refs.length + 1} is the bottom garment${body.bottomLabel ? ` (${body.bottomLabel})` : ""}`,
          );
        }

        const target = [top ? "the top garment" : null, bottom ? "the bottom garment" : null]
          .filter(Boolean)
          .join(" and ");

        const prompt = `Virtual try-on: ${order.join(", ")}. Generate a photo-realistic photograph of the person in image 1 actually wearing ${
          target || "the provided outfit"
        }. Re-render the garments as real worn clothing with correct 3D fit, drape and fabric folds — never paste or overlay the garment images. Preserve the garment colour, pattern, print and texture exactly. Preserve the person's identity, face, hair, skin tone, body proportions, pose and original background. Match lighting direction, shading, contact shadows and colour temperature so the clothing looks physically present. Replace whatever clothing the person currently wears in those regions.`;

        let res: Response;
        try {
          res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt, image_urls: [person, ...refs] }),
          });
        } catch (e) {
          return json(
            {
              error: "Unable to generate visual composition with this content",
              detail: e instanceof Error ? e.message : "network error",
            },
            502,
          );
        }

        if (!res.ok) {
          const detail = (await res.text()).slice(0, 400);
          if (res.status === 401 || res.status === 403) {
            return json({ error: "Image generation credentials were rejected" }, 502);
          }
          if (/depleted|credits|quota/i.test(detail)) {
            return json(
              {
                error:
                  "Your Hugging Face inference credits are used up — top them up (or upgrade to PRO) to keep generating outfits.",
              },
              402,
            );
          }
          return json(
            { error: "Unable to generate visual composition with this content", detail },
            502,
          );
        }

        const data = (await res.json()) as {
          images?: Array<{ url?: string }>;
          image?: { url?: string };
        };
        const url = data.images?.[0]?.url ?? data.image?.url;
        if (!url) {
          return json({ error: "Unable to generate visual composition with this content" }, 502);
        }

        return json({ image: url, model: MODEL }, 200);
      },
    },
  },
});

function asDataUrl(value?: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return raw.startsWith("data:") || raw.startsWith("http")
    ? raw
    : `data:image/jpeg;base64,${raw}`;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
