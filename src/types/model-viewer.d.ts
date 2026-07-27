import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          ar?: boolean;
          exposure?: string;
          "shadow-intensity"?: string;
          "shadow-softness"?: string;
          "camera-controls"?: boolean;
          "disable-pan"?: boolean;
          "disable-tap"?: boolean;
          "touch-action"?: string;
          "interaction-prompt"?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
          "field-of-view"?: string;
          "interpolation-decay"?: string;
          "environment-image"?: string;
          style?: CSSProperties;
        },
        HTMLElement
      >;
    }
  }
}

export interface ModelViewerElement extends HTMLElement {
  src: string;
  positionAndNormalFromPoint(
    x: number,
    y: number,
  ): { position: { toString(): string }; normal: { toString(): string } } | null;
}
