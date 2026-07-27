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
          "disable-zoom"?: boolean;
          "auto-rotate"?: boolean;
          "auto-rotate-delay"?: string;
          "rotation-per-second"?: string;
          "touch-action"?: string;
          "interaction-prompt"?: string;
          "camera-orbit"?: string;
          "camera-target"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "min-field-of-view"?: string;
          "max-field-of-view"?: string;
          "field-of-view"?: string;
          "interpolation-decay"?: string;
          "environment-image"?: string;
          "tone-mapping"?: string;
          loading?: string;
          reveal?: string;
          style?: CSSProperties;
        },
        HTMLElement
      >;
    }
  }
}

export interface CameraOrbit {
  theta: number;
  phi: number;
  radius: number;
  toString(): string;
}

export interface ModelViewerElement extends HTMLElement {
  src: string;
  cameraOrbit: string;
  fieldOfView: string;
  loaded: boolean;
  getCameraOrbit(): CameraOrbit;
  getFieldOfView(): number;
  jumpCameraToGoal(): void;
  positionAndNormalFromPoint(
    x: number,
    y: number,
  ): { position: { toString(): string }; normal: { toString(): string } } | null;
}
