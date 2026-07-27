import { useState } from "react";
import { Maximize2, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageAsset {
  url: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
}

interface HDImageCardProps {
  asset: ImageAsset;
  title?: string;
  onReplace?: () => void;
  className?: string;
  compact?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HDImageCard({
  asset,
  title = "HD Image Card",
  onReplace,
  className,
  compact,
}: HDImageCardProps) {
  const [zoom, setZoom] = useState(false);

  return (
    <div className={cn("surface-panel glow-ring rounded-2xl p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        <div className="flex items-center gap-1">
          {onReplace && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReplace}>
              <RefreshCcw className="mr-1 size-3" /> Replace
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setZoom(true)}
          >
            <Maximize2 className="mr-1 size-3" /> Inspect
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block w-full overflow-hidden rounded-xl border border-primary/25 bg-background/60"
        style={{ boxShadow: "var(--shadow-glow)" }}
      >
        <img
          src={asset.url}
          alt={`Uploaded source product image: ${asset.name}`}
          className={cn("w-full object-contain", compact ? "max-h-40" : "max-h-72")}
        />
      </button>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground" title={asset.name}>
          {asset.name}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {asset.width}×{asset.height} · {formatBytes(asset.bytes)}
        </span>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-5xl border-border bg-popover p-3">
          <DialogTitle className="sr-only">Full quality preview of {asset.name}</DialogTitle>
          <div className="flex items-center justify-between pb-2 pr-8">
            <p className="text-sm font-medium">
              {asset.name}{" "}
              <span className="text-muted-foreground">
                — full quality {asset.width}×{asset.height}
              </span>
            </p>
          </div>
          <div className="max-h-[75vh] overflow-auto rounded-lg bg-background/70">
            <img src={asset.url} alt={asset.name} className="mx-auto" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
