import { useCallback, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes, CheckCircle2, Loader2 } from "lucide-react";
import { UploadBox } from "@/components/UploadBox";
import { HDImageCard, type ImageAsset } from "@/components/HDImageCard";
import { UnifiedViewport } from "@/components/UnifiedViewport";
import { AdCopyTab } from "@/components/studio/AdCopyTab";
import { HotspotTab } from "@/components/studio/HotspotTab";
import { OutfitStudioTab } from "@/components/studio/OutfitStudioTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fileToAsset } from "@/lib/fileAsset";
import { loadImage, processImage } from "@/lib/imagePipeline";
import { buildMeshes } from "@/lib/meshBuilder";
import { newHotspotId, type Hotspot, type HotspotView } from "@/lib/hotspots";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VisualScale 3D — AI 3D Product Views & Marketing Studio" },
      {
        name: "description",
        content:
          "Turn one product photo into a true 360° AI 3D model, an HD holographic parallax card, AI hotspot callouts, aligned ad copy and outfit try-on.",
      },
      { property: "og:title", content: "VisualScale 3D — AI Product Studio for E-commerce" },
      {
        property: "og:description",
        content:
          "Server-side AI 3D generation, holographic HD cards, auto hotspots and a mix & match outfit studio for e-commerce stores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type StepKey = "mesh" | "card" | "features";
type StepState = "idle" | "running" | "done" | "failed";

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "mesh", label: "1/3 Analyzing geometry & generating smooth 3D mesh…" },
  { key: "card", label: "2/3 Building HD holographic parallax card…" },
  { key: "features", label: "3/3 Detecting key product features…" },
];

function Studio() {
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    mesh: "idle",
    card: "idle",
    features: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [view, setView] = useState<HotspotView>("model");
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [suggestedName, setSuggestedName] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);
  const [tab, setTab] = useState("copy");
  const runId = useRef(0);

  const running = Object.values(steps).some((s) => s === "running");

  const reset = () => {
    runId.current++;
    setAsset(null);
    setModelUrl(null);
    setCardUrl(null);
    setHotspots([]);
    setPendingLabels([]);
    setSuggestedName("");
    setArmedId(null);
    setError(null);
    setSteps({ mesh: "idle", card: "idle", features: "idle" });
  };

  const handleFile = useCallback(async (file: File) => {
    const id = ++runId.current;
    const mark = (key: StepKey, state: StepState) => {
      if (runId.current !== id) return;
      setSteps((prev) => ({ ...prev, [key]: state }));
    };

    setError(null);
    setModelUrl(null);
    setCardUrl(null);
    setHotspots([]);
    setPendingLabels([]);
    setView("model");
    setSteps({ mesh: "running", card: "running", features: "running" });

    const next = await fileToAsset(file);
    if (runId.current !== id) return;
    setAsset(next);

    // 1 — server-side AI 3D generation
    const meshJob = (async () => {
      const res = await fetch("/api/generate-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: next.url }),
      });
      const data = await res.json();
      if (!res.ok || !data.glbUrl) throw new Error(data.error ?? "3D generation failed");
      if (runId.current !== id) return;
      setModelUrl(data.glbUrl as string);
      mark("mesh", "done");
    })().catch((e: unknown) => {
      mark("mesh", "failed");
      if (runId.current === id) {
        setError(e instanceof Error ? e.message : "3D generation failed");
        setView("card");
      }
    });

    // 2 — HD holographic parallax card
    const cardJob = (async () => {
      const img = await loadImage(next.url);
      const processed = await processImage(img);
      const built = await buildMeshes(processed);
      if (runId.current !== id) return;
      setCardUrl(built.highUrl);
      mark("card", "done");
    })().catch(() => mark("card", "failed"));

    // 3 — Gemini feature detection -> auto hotspots
    const featureJob = (async () => {
      const res = await fetch("/api/hotspot-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: next.url }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.features)) throw new Error("features failed");
      if (runId.current !== id) return;
      setSuggestedName(String(data.productName ?? ""));
      setPendingLabels(data.features.map(String));
      mark("features", "done");
    })().catch(() => mark("features", "failed"));

    await Promise.allSettled([meshJob, cardJob, featureJob]);
  }, []);

  const addHotspot = useCallback(
    (position: string, normal: string, hview: HotspotView, label?: string) => {
      const id = newHotspotId();
      setHotspots((prev) => [
        ...prev,
        {
          id,
          label: label ?? `Feature ${prev.length + 1}`,
          position,
          normal,
          view: hview,
          source: label ? "ai" : "manual",
        },
      ]);
      return id;
    },
    [],
  );
  const renameHotspot = (id: string, label: string) =>
    setHotspots((prev) => prev.map((h) => (h.id === id ? { ...h, label } : h)));
  const moveHotspot = (id: string, position: string, normal: string) =>
    setHotspots((prev) => prev.map((h) => (h.id === id ? { ...h, position, normal } : h)));
  const deleteHotspot = (id: string) => {
    setHotspots((prev) => prev.filter((h) => h.id !== id));
    setArmedId((a) => (a === id ? null : a));
  };

  const hasViewport = !!modelUrl || !!cardUrl;

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
        <section className="space-y-4">
          {!asset ? (
            <div className="surface-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Start with one product photo</h2>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">
                Upload a JPEG or PNG. We generate a true AI 3D mesh, an HD parallax card and
                AI-detected feature hotspots.
              </p>
              <UploadBox label="Upload JPEG/PNG" onFile={handleFile} />
            </div>
          ) : (
            <HDImageCard asset={asset} title="Source image" onReplace={reset} compact />
          )}

          <div className="surface-panel relative min-h-[460px] overflow-hidden rounded-2xl lg:min-h-[620px]">
            {hasViewport ? (
              <div className="absolute inset-0">
                <UnifiedViewport
                  modelUrl={modelUrl}
                  cardUrl={cardUrl}
                  view={view}
                  onViewChange={setView}
                  hotspots={hotspots}
                  onAdd={addHotspot}
                  onRename={renameHotspot}
                  onMove={moveHotspot}
                  onDelete={deleteHotspot}
                  armedId={armedId}
                  setArmedId={setArmedId}
                  pendingLabels={pendingLabels}
                  onLabelsPlaced={() => setPendingLabels([])}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[460px] items-center justify-center p-6">
                {running ? (
                  <ol className="w-full max-w-sm space-y-2.5">
                    {STEPS.map((s) => {
                      const state = steps[s.key];
                      return (
                        <li
                          key={s.key}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border border-border/70 bg-surface/70 px-3 py-2 text-sm",
                            state === "running" && "border-primary/60 text-foreground glow-ring",
                            state === "idle" && "text-muted-foreground/60",
                            state === "failed" && "border-destructive/50 text-destructive",
                          )}
                        >
                          {state === "done" ? (
                            <CheckCircle2 className="size-4 shrink-0 text-success" />
                          ) : state === "running" ? (
                            <Loader2 className="size-4 shrink-0 animate-spin text-primary-glow" />
                          ) : state === "failed" ? (
                            <AlertTriangle className="size-4 shrink-0" />
                          ) : (
                            <span className="size-4 shrink-0 rounded-full border border-border" />
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
                    Upload a product image to generate the 3D model and HD card.
                  </p>
                )}
              </div>
            )}
          </div>

          {error && hasViewport && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </section>

        <aside className="surface-panel h-fit rounded-2xl p-4 lg:sticky lg:top-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            AI Marketing Studio
          </h2>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="copy" className="text-xs">
                Campaign
              </TabsTrigger>
              <TabsTrigger value="hotspots" className="text-xs">
                Hotspot Sync
              </TabsTrigger>
              <TabsTrigger value="outfit" className="text-xs">
                Mix &amp; Match
              </TabsTrigger>
            </TabsList>
            <TabsContent value="copy" className="mt-4">
              <AdCopyTab
                features={hotspots.map((h) => h.label)}
                suggestedName={suggestedName}
              />
            </TabsContent>
            <TabsContent value="hotspots" className="mt-4">
              <HotspotTab
                hotspots={hotspots}
                onRename={renameHotspot}
                onDelete={deleteHotspot}
                armedId={armedId}
                setArmedId={setArmedId}
                hasModel={hasViewport}
              />
            </TabsContent>
            <TabsContent value="outfit" className="mt-4">
              <OutfitStudioTab />
            </TabsContent>
          </Tabs>
        </aside>
      </main>
    </div>
  );
}
