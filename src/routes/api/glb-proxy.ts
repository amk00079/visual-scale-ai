import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Streams a generated .glb back from the Hugging Face Space so the browser can
 * load and download it without cross-origin issues. Only temporary Gradio
 * output paths are allowed through.
 */

const SPACE = process.env.HF_3D_SPACE ?? "https://stabilityai-triposr.hf.space";

export const Route = createFileRoute("/api/glb-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        if (!/^\/tmp\/gradio\/[A-Za-z0-9._/-]+\.(glb|obj)$/.test(path) || path.includes("..")) {
          return new Response("Invalid model path", { status: 400 });
        }

        const token = process.env.HF_TOKEN;
        const upstream = await fetch(`${SPACE}/file=${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!upstream.ok || !upstream.body) {
          return new Response("Model file is no longer available", { status: 404 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": path.endsWith(".glb") ? "model/gltf-binary" : "text/plain",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
