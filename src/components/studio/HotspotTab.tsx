import { useState } from "react";
import { Check, Download, MapPin, MoveRight, Pencil, Trash2 } from "lucide-react";
import type { Hotspot } from "@/lib/hotspots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface HotspotTabProps {
  hotspots: Hotspot[];
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  armedId: string | null;
  setArmedId: (id: string | null) => void;
  hasModel: boolean;
}

export function HotspotTab({
  hotspots,
  onRename,
  onDelete,
  armedId,
  setArmedId,
  hasModel,
}: HotspotTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  if (!hasModel) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted-foreground">
        Upload a product image to start placing hotspot callouts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
        Click the product to add a pin. Double-click a pin for{" "}
        <span className="text-foreground">Edit</span> or{" "}
        <span className="text-foreground">Move</span>. Everything here stays in sync with the
        viewport.
      </p>

      {hotspots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted-foreground">
          No hotspots yet — click anywhere on the product view.
        </p>
      ) : (
        <ul className="space-y-2">
          {hotspots.map((h, i) => (
            <li
              key={h.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5",
                armedId === h.id && "border-primary glow-ring",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary-glow">
                {i + 1}
              </span>
              {editingId === h.id ? (
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRename(h.id, draft.trim() || h.label);
                      setEditingId(null);
                    }
                  }}
                  className="h-8 text-sm"
                />
              ) : (
                <span className="flex-1 truncate text-sm">{h.label}</span>
              )}
              <div className="flex shrink-0 items-center">
                {editingId === h.id ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => {
                      onRename(h.id, draft.trim() || h.label);
                      setEditingId(null);
                    }}
                  >
                    <Check className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Rename hotspot"
                    onClick={() => {
                      setEditingId(h.id);
                      setDraft(h.label);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("size-7", armedId === h.id && "text-primary-glow")}
                  aria-label="Move hotspot"
                  onClick={() => setArmedId(armedId === h.id ? null : h.id)}
                >
                  <MoveRight className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  aria-label="Delete hotspot"
                  onClick={() => onDelete(h.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        className="w-full"
        disabled={hotspots.length === 0}
        onClick={() => setExportOpen(true)}
      >
        <Download className="mr-2 size-4" /> Export Annotations
      </Button>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Annotation summary</DialogTitle>
          <div className="surface-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-3 space-y-2">
              {hotspots.map((h, i) => (
                <li key={h.id} className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary-glow" />
                  <span>
                    <span className="font-medium">
                      {i + 1}. {h.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      position {h.position}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            onClick={() => {
              const text = hotspots
                .map((h, i) => `${i + 1}. ${h.label} — position ${h.position}`)
                .join("\n");
              const blob = new Blob([`VisualScale 3D — Hotspot annotations\n\n${text}\n`], {
                type: "text/plain",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "visualscale-annotations.txt";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Download className="mr-2 size-4" /> Download as .txt
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
