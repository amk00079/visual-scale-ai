export type HotspotView = "model" | "card";

export interface Hotspot {
  id: string;
  label: string;
  position: string;
  normal: string;
  view: HotspotView;
  source: "manual" | "ai";
}

export const newHotspotId = () =>
  `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
