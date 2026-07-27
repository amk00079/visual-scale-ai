import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Expand,
  ImageIcon,
  Boxes,
  Minus,
  MoveRight,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Hotspot, HotspotView } from "@/lib/hotspots";
import type { ModelViewerElement } from "@/types/model-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UnifiedViewportProps {
  modelUrl: string | null;
  cardUrl: string | null;
  view: HotspotView;
  onViewChange: (view: HotspotView) => void;
  hotspots: Hotspot[];
  onAdd: (position: string, normal: string, view: HotspotView, label?: string) => string;
  onRename: (id: string, label: string) => void;
  onMove: (id: string, position: string, normal: string) => void;
  onDelete: (id: string) => void;
  armedId: string | null;
  setArmedId: (id: string | null) => void;
  pendingLabels: string[];
  onLabelsPlaced: () => void;
}

const DEFAULT_ORBIT = "0deg 78deg 105%";

export function UnifiedViewport({
  modelUrl,
  cardUrl,
  view,
  onViewChange,
  hotspots,
  onAdd,
  onRename,
  onMove,
  onDelete,
  armedId,
  setArmedId,
  pendingLabels,
  onLabelsPlaced,
}: UnifiedViewportProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mvRef = useRef<ModelViewerElement | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const src = view === "model" ? modelUrl : cardUrl;
  const visible = hotspots.filter((h) => h.view === view);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  // ---- auto-placement of AI generated hotspots -----------------------------
  const placeLabels = useCallback(() => {
    const mv = mvRef.current;
    if (!mv || !pendingLabels.length) return;
    const rect = mv.getBoundingClientRect();
    const candidates: Array<[number, number]> = [
      [0.5, 0.32],
      [0.36, 0.55],
      [0.64, 0.55],
      [0.5, 0.72],
      [0.42, 0.42],
      [0.58, 0.42],
      [0.5, 0.5],
      [0.34, 0.68],
      [0.66, 0.68],
    ];
    const hits: Array<{ position: string; normal: string }> = [];
    for (const [fx, fy] of candidates) {
      if (hits.length >= pendingLabels.length) break;
      const hit = mv.positionAndNormalFromPoint(
        rect.left + rect.width * fx,
        rect.top + rect.height * fy,
      );
      if (hit) hits.push({ position: hit.position.toString(), normal: hit.normal.toString() });
    }
    if (!hits.length) return;
    pendingLabels.forEach((label, i) => {
      const hit = hits[i % hits.length];
      onAdd(hit.position, hit.normal, "model", label);
    });
    onLabelsPlaced();
  }, [pendingLabels, onAdd, onLabelsPlaced]);

  useEffect(() => {
    if (loaded && view === "model" && pendingLabels.length) {
      const t = window.setTimeout(placeLabels, 250);
      return () => window.clearTimeout(t);
    }
  }, [loaded, view, pendingLabels, placeLabels]);

  // ---- camera controls -----------------------------------------------------
  const zoom = (factor: number) => {
    const mv = mvRef.current;
    if (!mv) return;
    const orbit = mv.getCameraOrbit();
    orbit.radius = Math.max(0.4, Math.min(12, orbit.radius * factor));
    mv.cameraOrbit = orbit.toString();
  };

  const resetCamera = () => {
    const mv = mvRef.current;
    if (!mv) return;
    mv.cameraOrbit = DEFAULT_ORBIT;
    mv.fieldOfView = "auto";
  };

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const download = async (url: string | null, filename: string) => {
    if (!url) return;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---- pointer / picking ---------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (view !== "card") return;
    // holographic parallax: tilt the card toward the pointer
    const mv = mvRef.current;
    const rect = mv?.getBoundingClientRect();
    if (!mv || !rect) return;
    const fx = (e.clientX - rect.left) / rect.width - 0.5;
    const fy = (e.clientY - rect.top) / rect.height - 0.5;
    mv.cameraOrbit = `${(fx * 34).toFixed(2)}deg ${(78 + fy * 22).toFixed(2)}deg 105%`;
  };

  const handlePointerLeave = () => {
    if (view === "card" && mvRef.current) mvRef.current.cameraOrbit = DEFAULT_ORBIT;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;

    const mv = mvRef.current;
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
    const id = onAdd(position, normal, view);
    setOpenId(id);
    setEditingId(id);
    setDraft("");
  };

  const commit = (id: string) => {
    onRename(id, draft.trim() || "Untitled feature");
    setEditingId(null);
  };

  return (
    <div ref={shellRef} className="relative flex h-full w-full flex-col bg-background/40">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-surface/60 px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => onViewChange("model")}
            disabled={!modelUrl}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
              view === "model" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Boxes className="size-3.5" /> 3D Model
          </button>
          <button
            type="button"
            onClick={() => onViewChange("card")}
            disabled={!cardUrl}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
              view === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <ImageIcon className="size-3.5" /> HD Card
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" aria-label="Zoom in" onClick={() => zoom(0.85)}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="Zoom out" onClick={() => zoom(1.18)}>
            <Minus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="Reset camera" onClick={resetCamera}>
            <RotateCcw className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="Fullscreen" onClick={toggleFullscreen}>
            <Expand className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="h-8 text-xs">
                <Download className="mr-1.5 size-3.5" /> Download Assets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!modelUrl}
                onClick={() => download(modelUrl, "visualscale-3d-mesh.glb")}
              >
                Download Smooth 3D Mesh (.glb)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!cardUrl}
                onClick={() => download(cardUrl, "visualscale-parallax-card.glb")}
              >
                Download HD Parallax Card (.glb)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* viewport */}
      <div className="grid-backdrop relative flex-1">
        {ready && src ? (
          <model-viewer
            key={view}
            ref={mvRef as never}
            src={src}
            alt={
              view === "model"
                ? "Interactive 360 degree 3D model generated from the product photo"
                : "HD product image card with holographic depth parallax"
            }
            camera-controls={view === "model" ? true : undefined}
            disable-pan
            disable-tap
            touch-action="none"
            interaction-prompt="none"
            exposure="1.05"
            shadow-intensity="0.9"
            shadow-softness="1"
            camera-orbit={DEFAULT_ORBIT}
            min-field-of-view="16deg"
            max-field-of-view="45deg"
            interpolation-decay={view === "card" ? "60" : "140"}
            onLoad={() => setLoaded(true)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerUp={handlePointerUp}
            style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          >
            {visible.map((h) => (
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
                      <MoveRight className="size-3" /> Move
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
                          <Button size="icon" variant="ghost" className="size-6" onClick={() => commit(h.id)}>
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
                      Double-click the pin for Edit / Move
                    </p>
                  </div>
                )}
              </div>
            ))}
          </model-viewer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {ready ? "This view isn't ready yet." : "Loading viewer…"}
          </div>
        )}

        {armedId && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full border border-primary/40 bg-popover/90 px-4 py-1.5 text-xs text-primary-glow">
            Move armed — click anywhere on the product to reposition this pin
          </div>
        )}
        {view === "card" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border border-border bg-popover/80 px-3 py-1 text-[11px] text-muted-foreground">
            Move your cursor across the card for holographic depth
          </div>
        )}
      </div>
    </div>
  );
}
