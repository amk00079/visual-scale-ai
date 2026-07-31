import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/tmp-fetchtest")({
  server: { handlers: { GET: async () => {
    const out: string[] = [];
    for (const u of ["https://router.huggingface.co/hf-inference/models/Qwen/Qwen-Image-Edit-2511","https://api-inference.huggingface.co/models/Qwen/Qwen-Image-Edit-2511"]) {
      try { const r = await fetch(u); out.push(`${u} -> ${r.status}`); }
      catch (e) { out.push(`${u} -> ERR ${e instanceof Error ? e.message : ""} ${(e as any)?.cause?.message ?? ""}`); }
    }
    return new Response(out.join("\n"));
  } } },
});
