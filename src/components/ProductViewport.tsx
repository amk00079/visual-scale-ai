import { useEffect, useRef, useState } from "react";
import { Check, MoveRight, Pencil, Trash2, X } from "lucide-react";
import type { Hotspot } from "@/lib/hotspots";
import type { ModelViewerElement } from "@/types/model-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProductViewportProps {
  highUrl: string;
  lowUrl: string;
  hotspots: Hotspot[];
  onAdd: (position: string, normal: string) => string;
  onRename: (id: string, label: string) => void;
  onMove: (id: string, position: string, normal: string) => void;
  onDelete: (id: string) => void;
  armedId: string | null;
  setArmedId: (id: string | null) => void;
}

export function ProductViewport({
  highUrl,
  lowUrl,
  hotspots,
  onAdd,
  onRename,
  onMove,
  onDelete,
  armedId,
  setArmedId,
}: ProductViewportProps) {
  const ref = useRef<ModelViewerElement | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [quality, setQuality] = useState<"high" | "low">("high");

  // load the model-viewer custom element only in the browser
  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [ready, setReady] = useState(false);

  // performance: swap to the low-poly mesh while the user is dragging
  useEffect(() => {
    const mv = ref.current;
    if (!mv || !ready) return;
    const target = quality === "high" ? highUrl : lowUrl;
    if (mv.src !== target) mv.src = target;
  }, [quality, highUrl, lowUrl, ready]);

  const handlePointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
    setQuality("low");
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    // back to the full-resolution mesh once the view goes idle
    window.setTimeout(() => setQuality("high"), 90);
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > 6) return; // that was an orbit drag, not a click

    const mv = ref.current;
    const hit = mv?.positionAndNormalFromPoint(e.clientX, e.clientY);
    if (!hit) return;
    const position = hit.position.toString();
    const normal = hit.normal.toString();

    if (armedId) {
      onMove(armedId, position, normal);
      setArmedId(null);
      setMenuId(null);
      return;
    }
    const id = onAdd(position, normal);
    setOpenId(id);
    setEditingId(id);
    setDraft("");
  };

  const commit = (id: string) => {
    onRename(id, draft.trim() || "Untitled feature");
    setEditingId(null);
  };

  return (
    <div className="relative h-full w-full">
      {ready ? (
        <model-viewer
          ref={ref as never}
          src={highUrl}
          alt="3D-style view of the uploaded product"
          camera-controls
          disable-pan
          disable-tap
          touch-action="none"
          interaction-prompt="none"
          exposure="1.05"
          shadow-intensity="0.9"
          shadow-softness="1"
          min-camera-orbit="-45deg 45deg auto"
          max-camera-orbit="45deg 135deg auto"
          min-field-of-view="18deg"
          max-field-of-view="45deg"
          interpolation-decay="120"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
        >
          {hotspots.map((h) => (
            <div
              key={h.id}
              slot={`hotspot-${h.id}`}
              data-position={h.position}
              data-normal={h.normal}
              data-visibility-attribute="visible"
              className="relative"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={`Hotspot ${h.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId(null);
                  setOpenId((prev) => (prev === h.id ? null : h.id));
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setOpenId(null);
                  setMenuId((prev) => (prev === h.id ? null : h.id));
                }}
                className={cn(
                  "pin-pulse size-4 rounded-full border-2 border-primary-foreground/80 bg-primary",
                  armedId === h.id && "bg-primary-glow",
                )}
              />

              {menuId === h.id && (
                <div className="absolute left-6 top-0 z-20 w-36 rounded-lg border border-border bg-popover p-1 shadow-xl">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(null);
                      setOpenId(h.id);
                      setEditingId(h.id);
                      setDraft(h.label);
                    }}
                  >
                    <Pencil className="size-3" /> Edit label
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(null);
                      setArmedId(h.id);
                    }}
                  >
                    <MoveRight className="size-3" /> Move pin
                  </button>
                </div>
              )}

              {openId === h.id && (
                <div className="absolute left-6 top-0 z-20 w-52 rounded-lg border border-border bg-popover p-2 shadow-xl">
                  <div className="flex items-start justify-between gap-1">
                    {editingId === h.id ? (
                      <Input
                        autoFocus
                        value={draft}
                        placeholder="e.g. Ergonomic Grip"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(h.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <p className="pt-0.5 text-xs font-medium leading-snug">{h.label}</p>
                    )}
                    <div className="flex shrink-0 items-center">
                      {editingId === h.id ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => commit(h.id)}
                        >
                          <Check className="size-3" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => {
                            setEditingId(h.id);
                            setDraft(h.label);
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-destructive"
                        aria-label="Delete hotspot"
                        onClick={() => {
                          onDelete(h.id);
                          setOpenId(null);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        aria-label="Close"
                        onClick={() => setOpenId(null)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Double-click the pin for edit / move
                  </p>
                </div>
              )}
            </div>
          ))}
        </model-viewer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading viewer…
        </div>
      )}

      {armedId && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full border border-primary/40 bg-popover/90 px-4 py-1.5 text-xs text-primary-glow">
          Move armed — click anywhere on the product to reposition this pin
        </div>
      )}
    </div>
  );
}
