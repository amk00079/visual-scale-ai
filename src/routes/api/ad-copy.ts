import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface Body {
  productName?: string;
  audience?: string;
  tone?: string;
  features?: unknown;
}


export const Route = createFileRoute("/api/ad-copy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "AI is not configured" }, 500);

        const body = (await request.json()) as Body;
        const productName = (body.productName ?? "").trim();
        const audience = (body.audience ?? "").trim();
        const tone = (body.tone ?? "Bold").trim();
        const features = Array.isArray(body.features)
          ? body.features.map(String).filter(Boolean).slice(0, 8)
          : [];

        if (!productName || !audience) {
          return json({ error: "Product name and target audience are required" }, 400);
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a senior direct-response copywriter for e-commerce brands. Reply with JSON only.",
              },
              {
                role: "user",
                content: `Write an ad campaign for this product.
Product: ${productName}
Target audience: ${audience}
Brand tone: ${tone}
Hotspot callouts (the exact features highlighted on the 3D model): ${
                  features.length ? JSON.stringify(features) : "[]"
                }

Return strict JSON with this shape:
{"headline": string, "hooks": [string, string, string], "description": string}
- headline: max 9 words, punchy, matches the ${tone} tone.
- hooks: 3 scroll-stopping one-liners (max 14 words each) aimed at ${audience}.
- description: 45-70 word product description in the ${tone} tone.
${
  features.length
    ? `HARD CONSTRAINT: every hotspot callout above must be explicitly referenced across the copy — collectively the hooks and description must mention all of them, and the headline must lean on the strongest one. Do not invent features that are not in that list.`
    : ""
}`,

              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limit reached — try again shortly" }, 429);
        if (res.status === 402)
          return json({ error: "AI credits exhausted — add credits to continue" }, 402);
        if (!res.ok) return json({ error: "Campaign generation failed" }, 502);

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "";
        try {
          const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
          return json(parsed, 200);
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
