import { useState } from "react";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Campaign {
  headline: string;
  hooks: string[];
  description: string;
}

const TONES = ["Playful", "Luxury", "Minimal", "Bold", "Friendly"];

interface AdCopyTabProps {
  features: string[];
  suggestedName?: string;
}

export function AdCopyTab({ features, suggestedName }: AdCopyTabProps) {
  const [productName, setProductName] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Bold");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const generate = async () => {
    if (!productName.trim() || !audience.trim()) {
      setError("Add a product name and target audience first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, audience, tone, features }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setCampaign({
        headline: String(data.headline ?? ""),
        hooks: Array.isArray(data.hooks) ? data.hooks.map(String) : [],
        description: String(data.description ?? ""),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!campaign) return;
    navigator.clipboard.writeText(
      `${campaign.headline}\n\n${campaign.hooks.map((h) => `• ${h}`).join("\n")}\n\n${campaign.description}`,
    );
    toast.success("Campaign copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
        {features.length ? (
          <>
            Copy will be written around your{" "}
            <span className="text-foreground">{features.length} hotspot callout(s)</span>:{" "}
            <span className="text-primary-glow">{features.join(" · ")}</span>
          </>
        ) : (
          "Add hotspot callouts to constrain the campaign to your product's real features."
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="product-name">Product name</Label>
        <Input
          id="product-name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder={suggestedName || "Aero Ceramic Travel Mug"}
        />
        {suggestedName && !productName && (
          <button
            type="button"
            className="text-[11px] text-primary-glow underline-offset-2 hover:underline"
            onClick={() => setProductName(suggestedName)}
          >
            Use AI suggestion: {suggestedName}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="audience">Target audience</Label>
        <Input
          id="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Remote workers who commute by bike"
        />
      </div>
      <div className="space-y-2">
        <Label>Brand tone</Label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={generate} disabled={loading} className="w-full" size="lg">
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Writing your campaign…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" /> Generate AI Campaign
          </>
        )}
      </Button>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {campaign && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Headline
            </p>
            <p className="mt-1 text-lg font-semibold leading-snug gradient-text">
              {campaign.headline}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hook variations
            </p>
            <ul className="mt-2 space-y-2">
              {campaign.hooks.map((hook, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-primary-glow">0{i + 1}</span>
                  <span>{hook}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Product description
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">
              {campaign.description}
            </p>
          </div>
          <Button variant="secondary" className="w-full" onClick={copyAll}>
            <Copy className="mr-2 size-4" /> Copy campaign
          </Button>
        </div>
      )}
    </div>
  );
}
