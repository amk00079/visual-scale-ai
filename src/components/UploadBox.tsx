import { useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadBoxProps {
  label: string;
  hint?: string;
  onFile: (file: File) => void;
  compact?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];

export function UploadBox({ label, hint, onFile, compact }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (file?: File | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Only JPEG and PNG files are supported");
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/60 text-center transition-all hover:border-primary/70 hover:bg-accent/30",
          compact ? "px-3 py-5" : "px-6 py-10",
          dragging && "border-primary bg-accent/40",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary-glow transition-transform group-hover:scale-105">
          {dragging ? <Upload className="size-5" /> : <ImageIcon className="size-5" />}
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {hint ?? "Drop a JPEG or PNG, or click to browse"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
