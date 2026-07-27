import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes, CheckCircle2, Loader2 } from "lucide-react";
import { UploadBox } from "@/components/UploadBox";
import { HDImageCard, type ImageAsset } from "@/components/HDImageCard";
import { ProductViewport } from "@/components/ProductViewport";
import { AdCopyTab } from "@/components/studio/AdCopyTab";
import { HotspotTab } from "@/components/studio/HotspotTab";
import { TryOnTab } from "@/components/studio/TryOnTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fileToAsset } from "@/lib/fileAsset";
import { LowContrastError, loadImage, processImage, type Stage } from "@/lib/imagePipeline";
import { buildMeshes } from "@/lib/meshBuilder";
import { newHotspotId, type Hotspot } from "@/lib/hotspots";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VisualScale 3D — 3D-Style Product Views & AI Ad Studio" },
      {
        name: "description",
        content:
          "Turn a single product photo into a rotatable 3D-style view with hotspot callouts, AI ad copy, and AI outfit try-on for your e-commerce store.",
      },
      { property: "og:title", content: "VisualScale 3D — AI Product Studio for E-commerce" },
      {
        property: "og:description",
        content:
          "Upload one product photo and get a 3D-style viewport, annotated hotspots, AI campaign copy, and virtual outfit try-on.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

const STAGES: Array<{ key: Stage; label: string }> = [
  { key: "segment", label: "Removing background" },
  { key: "depth", label: "Mapping depth" },
  { key: "mesh", label: "Building mesh" },
  { key: "finalize", label: "Finalizing" },
];

function Studio() {
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [done, setDone] = useState<Stage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mesh, setMesh] = useState<{ highUrl: string; lowUrl: string; triangles: number } | null>(
    null,
  );
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [tab, setTab] = useState("copy");
  const runId = useRef(0);

  const reset = () => {
    setAsset(null);
    setMesh(null);
    setHotspots([]);
    setArmedId(null);
    setError(null);
    setStage(null);
    setDone([]);
  };

  const handleFile = useCallback(async (file: File) => {
    const id = ++runId.current;
    setError(null);
    setMesh(null);
    setHotspots([]);
    setDone([]);
    const next = await fileToAsset(file);
    setAsset(next);

    try {
      const img = await loadImage(next.url);
      setStage("segment");
      const processed = await processImage(img, (s) => {
        if (runId.current !== id) return;
        setStage(s);
        setDone((prev) => (prev.includes(s) ? prev : [...prev, s]));
      });
      if (runId.current !== id) return;

      setStage("mesh");
      setDone((prev) => [...new Set([...prev, "segment" as Stage, "depth" as Stage])]);
      await new Promise((r) => setTimeout(r, 20));
      const built = await buildMeshes(processed);
      if (runId.current !== id) return;

      setStage("finalize");
      setDone((prev) => [...new Set([...prev, "mesh" as Stage])]);
      await new Promise((r) => setTimeout(r, 200));
      if (runId.current !== id) return;
      setDone((prev) => [...new Set([...prev, "finalize" as Stage])]);
      setMesh(built);
      setStage(null);
    } catch (e) {
      if (runId.current !== id) return;
      setStage(null);
      setError(
        e instanceof LowContrastError
          ? e.message
          : "Something went wrong while building the 3D-style view. Try another photo.",
      );
    }
  }, []);

  const addHotspot = (position: string, normal: string) => {
    const id = newHotspotId();
    setHotspots((prev) => [
      ...prev,
      { id, label: `Feature ${prev.length + 1}`, position, normal },
    ]);
    return id;
  };
  const renameHotspot = (id: string, label: string) =>
    setHotspots((prev) => prev.map((h) => (h.id === id ? { ...h, label } : h)));
  const moveHotspot = (id: string, position: string, normal: string) =>
    setHotspots((prev) => prev.map((h) => (h.id === id ? { ...h, position, normal } : h)));
  const deleteHotspot = (id: string) => {
    setHotspots((prev) => prev.filter((h) => h.id !== id));
    setArmedId((a) => (a === id ? null : a));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-ring">
              <Boxes className="size-5" />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-none">
                VisualScale <span className="gradient-text">3D</span>
              </h1>
              <p className="mt-1 text-[11px] text-muted-foreground">
                AI product studio for e-commerce stores
              </p>
            </div>
          </div>
          {asset && (
            <Button variant="secondary" size="sm" onClick={reset}>
              New product
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.9fr)]">
        {/* LEFT — product viewport */}
        <section className="space-y-4">
          {!asset ? (
            <div className="surface-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Start with one product photo</h2>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">
                JPEG or PNG. Everything below is generated in your browser — no 3D scanning, no
                external render service.
              </p>
              <UploadBox label="Upload your product image" onFile={handleFile} />
            </div>
          ) : (
            <HDImageCard asset={asset} onReplace={reset} />
          )}

          <div className="surface-panel relative min-h-[420px] overflow-hidden rounded-2xl lg:min-h-[560px]">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">3D-Style Product View</h2>
                <p className="text-xs text-muted-foreground">
                  Rotate to explore product depth and detail
                </p>
              </div>
              {mesh && (
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] text-muted-foreground">
                  {mesh.triangles.toLocaleString()} tris · adaptive LOD
                </span>
              )}
            </div>

            <div className="grid-backdrop absolute inset-x-0 bottom-0 top-[57px]">
              {mesh ? (
                <ProductViewport
                  highUrl={mesh.highUrl}
                  lowUrl={mesh.lowUrl}
                  hotspots={hotspots}
                  onAdd={addHotspot}
                  onRename={renameHotspot}
                  onMove={moveHotspot}
                  onDelete={deleteHotspot}
                  armedId={armedId}
                  setArmedId={setArmedId}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  {stage ? (
                    <ol className="w-full max-w-xs space-y-2.5">
                      {STAGES.map((s) => {
                        const complete = done.includes(s.key) && stage !== s.key;
                        const activeStep = stage === s.key;
                        return (
                          <li
                            key={s.key}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border border-border/70 bg-surface/70 px-3 py-2 text-sm",
                              activeStep && "border-primary/60 text-foreground glow-ring",
                              !activeStep && !complete && "text-muted-foreground/60",
                            )}
                          >
                            {complete ? (
                              <CheckCircle2 className="size-4 text-success" />
                            ) : activeStep ? (
                              <Loader2 className="size-4 animate-spin text-primary-glow" />
                            ) : (
                              <span className="size-4 rounded-full border border-border" />
                            )}
                            {s.label}
                          </li>
                        );
                      })}
                    </ol>
                  ) : error ? (
                    <div className="max-w-sm rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
                      <AlertTriangle className="mx-auto mb-2 size-5 text-destructive" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload a product image to generate the 3D-style view.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — AI studio */}
        <aside className="surface-panel h-fit rounded-2xl p-4 lg:sticky lg:top-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            AI Studio
          </h2>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="copy" className="text-xs">
                Ad Copy &amp; Hooks
              </TabsTrigger>
              <TabsTrigger value="hotspots" className="text-xs">
                Hotspot Callouts
              </TabsTrigger>
              <TabsTrigger value="tryon" className="text-xs">
                Outfit Try-On
              </TabsTrigger>
            </TabsList>
            <TabsContent value="copy" className="mt-4">
              <AdCopyTab />
            </TabsContent>
            <TabsContent value="hotspots" className="mt-4">
              <HotspotTab
                hotspots={hotspots}
                onRename={renameHotspot}
                onDelete={deleteHotspot}
                armedId={armedId}
                setArmedId={setArmedId}
                hasModel={!!mesh}
              />
            </TabsContent>
            <TabsContent value="tryon" className="mt-4">
              <TryOnTab />
            </TabsContent>
          </Tabs>
        </aside>
      </main>
    </div>
  );
}
