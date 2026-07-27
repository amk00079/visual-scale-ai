export interface Hotspot {
  id: string;
  label: string;
  position: string;
  normal: string;
}

export const newHotspotId = () =>
  `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
