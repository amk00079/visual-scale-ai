import { useState } from "react";
import { Loader2, Shirt, Sparkles, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadBox } from "@/components/UploadBox";
import { HDImageCard, type ImageAsset } from "@/components/HDImageCard";
import { compressDataUrl, fileToAsset, urlToAsset } from "@/lib/fileAsset";
import { generateOutfit } from "@/lib/outfitGen";
import modelA from "@/assets/model-a.jpg";
import modelB from "@/assets/model-b.jpg";
import modelC from "@/assets/model-c.jpg";
import { cn } from "@/lib/utils";

interface OutfitResult {
  id: string;
  label: string;
  image: string;
}

const PRESETS = [
  { id: "a", name: "Model A — Mid-toned male", src: modelA },
  { id: "b", name: "Model B — Light-toned female", src: modelB },
  { id: "c", name: "Model C — Non-binary", src: modelC },
];

export function OutfitStudioTab() {
  const [top, setTop] = useState<ImageAsset | null>(null);
  const [bottom, setBottom] = useState<ImageAsset | null>(null);
  const [person, setPerson] = useState<ImageAsset | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<OutfitResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = history.find((h) => h.id === activeId) ?? null;

  const choosePreset = async (id: string, src: string, name: string) => {
    setPresetId(id);
    setPerson(await urlToAsset(src, `${name}.jpg`));
  };

  const generate = async () => {
    if (!person || (!top && !bottom)) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [topImage, bottomImage, personImage] = await Promise.all([
        top ? compressDataUrl(top.url) : Promise.resolve(undefined),
        bottom ? compressDataUrl(bottom.url) : Promise.resolve(undefined),
        compressDataUrl(person.url),
      ]);

      const out = await generateOutfit({ topImage, bottomImage, personImage });
      if (out.note) setNotice(out.note);

      const label = [top?.name, bottom?.name].filter(Boolean).join(" + ") || "Outfit";
      const result: OutfitResult = { id: `o${Date.now()}`, label, image: out.image };
      setHistory((prev) => [...prev, result]);
      setActiveId(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outfit generation failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-5">
      {/* 1. upload mix */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          1 · Upload mix
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Shirt className="size-3.5 text-primary-glow" /> Slot A — Top
            </p>
            {top ? (
              <HDImageCard asset={top} title="Top garment" compact onReplace={() => setTop(null)} />
            ) : (
              <UploadBox
                compact
                label="Upload Top (Garment)"
                hint="T-shirt, shirt, jacket…"
                onFile={async (f) => setTop(await fileToAsset(f))}
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Shirt className="size-3.5 rotate-180 text-primary-glow" /> Slot B — Bottom
            </p>
            {bottom ? (
              <HDImageCard
                asset={bottom}
                title="Bottom garment"
                compact
                onReplace={() => setBottom(null)}
              />
            ) : (
              <UploadBox
                compact
                label="Upload Bottom (Garment)"
                hint="Trousers, skirt, shorts…"
                onFile={async (f) => setBottom(await fileToAsset(f))}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. model selection */}
      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          2 · Select model to wear outfit
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choosePreset(p.id, p.src, p.name)}
              className={cn(
                "overflow-hidden rounded-xl border border-border bg-surface text-left transition-all hover:border-primary/60",
                presetId === p.id && "border-primary glow-ring",
              )}
            >
              <img
                src={p.src}
                alt={p.name}
                loading="lazy"
                width={1024}
                height={1536}
                className="h-24 w-full object-cover object-top"
              />
              <span className="block px-2 py-1.5 text-[10px] leading-tight text-muted-foreground">
                {p.name}
              </span>
            </button>
          ))}
        </div>
        {person && !presetId ? (
          <HDImageCard
            asset={person}
            title="Your photo"
            compact
            onReplace={() => setPerson(null)}
          />
        ) : (
          <UploadBox
            compact
            label="Or upload your photo"
            hint="Full-body works best"
            onFile={async (f) => {
              setPresetId(null);
              setPerson(await fileToAsset(f));
            }}
          />
        )}
        {person && presetId && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5" /> Wearing on{" "}
            {PRESETS.find((p) => p.id === presetId)?.name}
          </p>
        )}
      </section>

      {/* 3. generate */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          3 · Generate &amp; compare
        </p>
        <Button
          className="w-full"
          size="lg"
          disabled={!person || (!top && !bottom) || loading}
          onClick={generate}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Assembling outfit…
            </>
          ) : (
            <>
              <Wand2 className="mr-2 size-4" /> Assemble &amp; Visualize Outfit
            </>
          )}
        </Button>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-muted-foreground">
            {notice}
          </p>
        )}

        {active && (
          <div className="surface-panel glow-ring space-y-2 rounded-2xl p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="size-3" /> {active.label}
            </p>
            <img
              src={active.image}
              alt={`Generated outfit preview: ${active.label}`}
              className="w-full rounded-xl border border-primary/25"
            />
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              History strip · compare combinations
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveId(h.id)}
                  title={h.label}
                  className={cn(
                    "size-16 shrink-0 overflow-hidden rounded-lg border border-border transition-all",
                    activeId === h.id && "border-primary glow-ring",
                  )}
                >
                  <img src={h.image} alt={h.label} className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
