import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  itemImage?: string;
  personImage?: string;
}

export const Route = createFileRoute("/api/try-on")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "AI is not configured" }, 500);

        const body = (await request.json()) as Body;
        if (!body.itemImage || !body.personImage) {
          return json({ error: "Both a clothing item photo and a person photo are required" }, 400);
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            modalities: ["image", "text"],
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Image 1 is a clothing item. Image 2 is a person. Generate a single photorealistic image of the person from image 2 wearing the clothing item from image 1. Preserve the person's exact pose, body proportions, face, lighting and background. Fit the garment naturally with realistic folds, shadows and scale. Output only the final image.",
                  },
                  { type: "image_url", image_url: { url: body.itemImage } },
                  { type: "image_url", image_url: { url: body.personImage } },
                ],
              },
            ],
          }),
        });

        if (res.status === 429) return json({ error: "Rate limit reached — try again shortly" }, 429);
        if (res.status === 402)
          return json({ error: "AI credits exhausted — add credits to continue" }, 402);
        if (!res.ok) return json({ error: "Try-on generation failed" }, 502);

        const data = (await res.json()) as {
          choices?: Array<{
            message?: { images?: Array<{ image_url?: { url?: string } }> };
          }>;
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
