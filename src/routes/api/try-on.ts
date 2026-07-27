import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  topImage?: string;
  bottomImage?: string;
  personImage?: string;
}

export const Route = createFileRoute("/api/try-on")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "AI is not configured" }, 500);

        const body = (await request.json()) as Body;
        if (!body.personImage) return json({ error: "Select a model to wear the outfit" }, 400);
        if (!body.topImage && !body.bottomImage) {
          return json({ error: "Upload at least a top or a bottom garment" }, 400);
        }

        const content: Array<Record<string, unknown>> = [];
        const parts: string[] = [];
        let index = 1;
        if (body.topImage) parts.push(`Image ${index++} is the TOP garment`);
        if (body.bottomImage) parts.push(`Image ${index++} is the BOTTOM garment`);
        const personIndex = index;

        content.push({
          type: "text",
          text: `${parts.join(". ")}. Image ${personIndex} is the person/model.
Generate one photorealistic full-body image of the person from image ${personIndex} wearing ${
            body.topImage && body.bottomImage
              ? "both the top and the bottom garment together as a complete outfit"
              : body.topImage
                ? "the top garment"
                : "the bottom garment"
          }.
Keep the person's exact pose, body proportions, face, skin tone, hair, lighting and background unchanged. Composite the garments with realistic fit, fabric folds, shadows and scale. Replace the clothing they are currently wearing in those areas. Output only the final image.`,
        });
        if (body.topImage) content.push({ type: "image_url", image_url: { url: body.topImage } });
        if (body.bottomImage)
          content.push({ type: "image_url", image_url: { url: body.bottomImage } });
        content.push({ type: "image_url", image_url: { url: body.personImage } });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            modalities: ["image", "text"],
            messages: [{ role: "user", content }],
          }),
        });

        if (res.status === 429) return json({ error: "Rate limit reached — try again shortly" }, 429);
        if (res.status === 402)
          return json({ error: "AI credits exhausted — add credits to continue" }, 402);
        if (!res.ok) return json({ error: "Outfit generation failed" }, 502);

        const data = (await res.json()) as {
          choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
        };
        const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!url) return json({ error: "The model did not return an image" }, 502);
        return json({ image: url }, 200);
      },
    },
  },
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
