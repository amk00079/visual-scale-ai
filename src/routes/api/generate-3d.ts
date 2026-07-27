import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Server-side 3D generation.
 *
 * Sends the uploaded product photo to the TripoSR image-to-3D Gradio Space on
 * Hugging Face, waits for the job to finish, and hands back a proxied URL to
 * the generated .glb so <model-viewer> can load it directly.
 */

const SPACE = process.env.HF_3D_SPACE ?? "https://stabilityai-triposr.hf.space";

interface Body {
  image?: string;
  resolution?: number;
}

interface GradioFile {
  path: string;
  url?: string | null;
  mime_type?: string | null;
  orig_name?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function dataUrlToBytes(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Unsupported image payload");
  const mime = match[1] || "image/png";
  const binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

async function uploadImage(dataUrl: string): Promise<GradioFile> {
  const { bytes, mime } = dataUrlToBytes(dataUrl);
  const form = new FormData();
  const name = mime.includes("png") ? "source.png" : "source.jpg";
  form.append("files", new Blob([bytes], { type: mime }), name);
  const res = await fetch(`${SPACE}/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error("Could not send the image to the 3D service");
  const paths = (await res.json()) as string[];
  if (!paths?.[0]) throw new Error("The 3D service rejected the image upload");
  return { path: paths[0], mime_type: mime, orig_name: name };
}

function fileArg(file: GradioFile) {
  return { ...file, meta: { _type: "gradio.FileData" } };
}

async function callEndpoint(endpoint: string, data: unknown[]): Promise<unknown[]> {
  const start = await fetch(`${SPACE}/call/${endpoint}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!start.ok) throw new Error(`The 3D service is busy (${endpoint})`);
  const { event_id: eventId } = (await start.json()) as { event_id?: string };
  if (!eventId) throw new Error("The 3D service did not start the job");

  const stream = await fetch(`${SPACE}/call/${endpoint}/${eventId}`, {
    headers: authHeaders(),
  });
  if (!stream.ok || !stream.body) throw new Error("Lost connection to the 3D service");

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (event === "complete") {
          await reader.cancel();
          return JSON.parse(payload) as unknown[];
        }
        if (event === "error") {
          await reader.cancel();
          throw new Error("The 3D model server could not process this image");
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  throw new Error("The 3D service timed out before returning a model");
}

export const Route = createFileRoute("/api/generate-3d")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          if (!body.image?.startsWith("data:image/")) {
            return json({ error: "A JPEG or PNG product image is required" }, 400);
          }
          const resolution = Math.min(320, Math.max(128, Math.round(body.resolution ?? 256)));

          const uploaded = await uploadImage(body.image);

          const pre = (await callEndpoint("preprocess", [
            fileArg(uploaded),
            true,
            0.85,
          ])) as GradioFile[];
          const processed = pre?.[0];
          if (!processed?.path) throw new Error("Background removal failed on the 3D service");

          const generated = (await callEndpoint("generate", [
            fileArg({ ...processed, mime_type: "image/png", orig_name: "image.png" }),
            resolution,
          ])) as GradioFile[];

          const glb = generated?.find((f) => f?.path?.endsWith(".glb")) ?? generated?.[1];
          if (!glb?.path) throw new Error("The 3D service did not return a .glb model");

          return json(
            {
              glbUrl: `/api/glb-proxy?path=${encodeURIComponent(glb.path)}`,
              source: "TripoSR",
            },
            200,
          );
        } catch (e) {
          return json(
            {
              error:
                e instanceof Error
                  ? e.message
                  : "3D generation failed — try a clearer product photo",
            },
            502,
          );
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
