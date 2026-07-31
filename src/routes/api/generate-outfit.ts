import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  /** Data URL or bare base64 of the person / model photo. */
  personImage?: string;
  /** Human readable garment details, e.g. "Top: linen shirt, Bottom: black jeans". */
  topLabel?: string;
  bottomLabel?: string;
  prompt?: string;
}

const MODEL = "Qwen/Qwen-Image-Edit-2511";

export const Route = createFileRoute("/api/generate-outfit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.HF_TOKEN;
        if (!token) return json({ error: "HF_TOKEN is not configured" }, 500);

        const body = (await request.json()) as Body;
        const personImage = (body.personImage ?? "").trim();
        if (!personImage) return json({ error: "A model/person image is required" }, 400);

        const base64 = personImage.replace(/^data:[^;]+;base64,/, "");
        const garments = [
          body.topLabel ? `top garment: ${body.topLabel}` : null,
          body.bottomLabel ? `bottom garment: ${body.bottomLabel}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        const prompt =
          (body.prompt ?? "").trim() ||
          `Replace the clothing on the person in this photo so they are realistically wearing the ${
            garments || "provided outfit"
          }. Re-render the garments as real worn clothing with correct 3D fit, drape and fabric folds. Preserve the person's identity, face, hair, skin tone, body proportions, pose and the original background. Match lighting direction, shading, contact shadows and colour temperature so the clothing looks physically present. Photo-realistic, sharp, high resolution.`;

        const endpoints = [`https://router.huggingface.co/hf-inference/models/${MODEL}`];

        let lastError = "";
        for (const url of endpoints) {
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "image/png",
              },
              body: JSON.stringify({
                inputs: base64,
                parameters: { prompt },
              }),
            });
          } catch (e) {
            lastError = e instanceof Error ? e.message : "network error";
            continue;
          }

          if (!res.ok) {
            lastError = (await res.text()).slice(0, 400);
            if (res.status === 401 || res.status === 403) {
              return json({ error: "Hugging Face rejected the stored token" }, 502);
            }
            continue;
          }

          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.startsWith("image/")) {
            const buffer = await res.arrayBuffer();
            return json(
              { image: `data:${contentType};base64,${toBase64(buffer)}`, model: MODEL },
              200,
            );
          }

          // Some providers answer with JSON containing a URL or base64 payload.
          const text = await res.text();
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const image =
              pickString(parsed, ["image", "url", "output"]) ??
              pickString((parsed.images as Record<string, unknown>[])?.[0] ?? {}, ["url", "b64_json"]);
            if (image) {
              return json(
                { image: image.startsWith("http") || image.startsWith("data:") ? image : `data:image/png;base64,${image}`, model: MODEL },
                200,
              );
            }
          } catch {
            /* fall through */
          }
          lastError = text.slice(0, 400);
        }

        return json(
          { error: "Unable to generate visual composition with this content", detail: lastError },
          502,
        );
      },
    },
  },
});

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
