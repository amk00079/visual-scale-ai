import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  image?: string;
}

export const Route = createFileRoute("/api/hotspot-features")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "AI is not configured" }, 500);

        const body = (await request.json()) as Body;
        if (!body.image) return json({ error: "A product image is required" }, 400);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              {
                role: "system",
                content:
                  "You are a product analyst for e-commerce catalogues. Reply with JSON only.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyse this product photo. Return strict JSON:
{"productName": string, "features": [string, ...]}
- productName: a short commercial product name (max 5 words).
- features: 3 to 5 concrete, visible selling-point features written as short title-case labels, e.g. "Ergonomic Grip", "Waterproof Seal", "Lightweight Composite". No sentences, max 4 words each.`,
                  },
                  { type: "image_url", image_url: { url: body.image } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limit reached — try again shortly" }, 429);
        if (res.status === 402)
          return json({ error: "AI credits exhausted — add credits to continue" }, 402);
        if (!res.ok) return json({ error: "Feature detection failed" }, 502);

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "";
        try {
          const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim()) as {
            productName?: unknown;
            features?: unknown;
          };
          const features = Array.isArray(parsed.features)
            ? parsed.features.map(String).filter(Boolean).slice(0, 5)
            : [];
          return json({ productName: String(parsed.productName ?? ""), features }, 200);
        } catch {
          return json({ error: "Could not parse the AI response" }, 502);
        }
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
