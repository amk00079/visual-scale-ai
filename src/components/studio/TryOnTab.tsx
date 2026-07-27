import { useState } from "react";
import { Loader2, Shirt, Sparkles, User, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadBox } from "@/components/UploadBox";
import { HDImageCard, type ImageAsset } from "@/components/HDImageCard";
import { fileToAsset, urlToAsset } from "@/lib/fileAsset";
import defaultModel from "@/assets/default-model.jpg";
import { cn } from "@/lib/utils";

interface TryOnResult {
  id: string;
  itemName: string;
  itemThumb: string;
  image: string;
}

export function TryOnTab() {
  const [item, setItem] = useState<ImageAsset | null>(null);
  const [person, setPerson] = useState<ImageAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TryOnResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = history.find((h) => h.id === activeId) ?? null;

  const useDefaultModel = async () => {
    setPerson(await urlToAsset(defaultModel, "default-model.jpg"));
  };

  const generate = async () => {
    if (!item || !person) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemImage: item.url, personImage: person.url }),
      });
      const data = await res.json();
      if (!res.ok || !data.image) throw new Error(data.error ?? "failed");
      const result: TryOnResult = {
        id: `t${Date.now()}`,
        itemName: item.name,
        itemThumb: item.url,
        image: data.image,
      };
      setHistory((prev) => [...prev, result]);
      setActiveId(result.id);
    } catch {
      setError(
        "Couldn't generate this preview — try a clearer photo of the item or person",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Shirt className="size-3.5" /> Clothing item
          </p>
          {item ? (
            <HDImageCard
              asset={item}
              title="Item image"
              compact
              onReplace={() => setItem(null)}
            />
          ) : (
            <UploadBox
              compact
              label="Upload item photo"
              hint="T-shirt, trousers, jacket…"
              onFile={async (f) => setItem(await fileToAsset(f))}
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <User className="size-3.5" /> Person
          </p>
          {person ? (
            <HDImageCard
              asset={person}
              title="Person image"
              compact
              onReplace={() => setPerson(null)}
            />
          ) : (
            <>
              <UploadBox
                compact
                label="Upload your photo"
                hint="Full-body works best"
                onFile={async (f) => setPerson(await fileToAsset(f))}
              />
              <Button variant="ghost" size="sm" className="w-full" onClick={useDefaultModel}>
                Use default model photo
              </Button>
            </>
          )}
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!item || !person || loading}
        onClick={generate}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Generating outfit preview…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" /> Generate Try-On
          </>
        )}
      </Button>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {active && (
        <div className="surface-panel glow-ring space-y-3 rounded-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Try-on preview · {active.itemName}
          </p>
          <img
            src={active.image}
            alt={`Generated preview of the person wearing ${active.itemName}`}
            className="w-full rounded-xl border border-primary/25"
          />
          <Button variant="secondary" className="w-full" onClick={() => setItem(null)}>
            <RotateCcw className="mr-2 size-4" /> Try Another Item
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Session history
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => setActiveId(h.id)}
                title={h.itemName}
                className={cn(
                  "size-16 shrink-0 overflow-hidden rounded-lg border border-border transition-all",
                  activeId === h.id && "border-primary glow-ring",
                )}
              >
                <img src={h.image} alt={h.itemName} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
