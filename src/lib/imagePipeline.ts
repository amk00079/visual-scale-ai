/**
 * Fully client-side image pipeline:
 *  1. background segmentation (border-seeded flood fill -> transparent pixels)
 *  2. depth/heightmap from brightness + edge detection + interior distance
 *  3. quality gate on contrast / depth signal
 */

export interface ProcessedImage {
  /** working resolution */
  width: number;
  height: number;
  /** cut-out RGBA at working resolution */
  rgba: Uint8ClampedArray;
  /** 0..1 alpha mask */
  mask: Float32Array;
  /** 0..1 heightmap */
  depth: Float32Array;
  /** full-quality cut-out canvas used as the mesh texture */
  textureCanvas: HTMLCanvasElement;
  contrast: number;
  coverage: number;
}

export class LowContrastError extends Error {
  constructor() {
    super(
      "This image doesn't have enough contrast for a good 3D effect — try a product photo with clear lighting and shadow",
    );
    this.name = "LowContrastError";
  }
}

const WORK_MAX = 384;
const TEX_MAX = 1024;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file"));
    img.src = src;
  });
}

function drawToCanvas(img: HTMLImageElement, max: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

/** Border-seeded flood fill: everything colour-connected to the frame is background. */
function segment(data: Uint8ClampedArray, w: number, h: number, tolerance = 46) {
  const n = w * h;
  const bg = new Uint8Array(n);
  const queue: number[] = [];
  const seeds: number[] = [];

  const push = (i: number) => {
    if (!bg[i]) {
      bg[i] = 1;
      queue.push(i);
      seeds.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }

  // average border colour reference
  let br = 0,
    bgc = 0,
    bb = 0;
  for (const i of seeds) {
    br += data[i * 4];
    bgc += data[i * 4 + 1];
    bb += data[i * 4 + 2];
  }
  br /= seeds.length;
  bgc /= seeds.length;
  bb /= seeds.length;

  const tol2 = tolerance * tolerance * 3;
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const neighbours = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of neighbours) {
      if (j < 0 || bg[j]) continue;
      const dr = data[j * 4] - br;
      const dg = data[j * 4 + 1] - bgc;
      const db = data[j * 4 + 2] - bb;
      if (dr * dr + dg * dg + db * db <= tol2) {
        bg[j] = 1;
        queue.push(j);
      }
    }
  }
  return bg;
}

function blur(src: Float32Array, w: number, h: number, radius = 1) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx];
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

/** Chamfer distance transform of the interior of the mask (0 outside, 1 deep inside). */
function interiorDistance(mask: Float32Array, w: number, h: number) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] > 0.5 ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) m = Math.min(m, d[i - w] + 1);
      if (x > 0 && y > 0) m = Math.min(m, d[i - w - 1] + 1.414);
      if (x < w - 1 && y > 0) m = Math.min(m, d[i - w + 1] + 1.414);
      d[i] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x < w - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < h - 1) m = Math.min(m, d[i + w] + 1);
      if (x < w - 1 && y < h - 1) m = Math.min(m, d[i + w + 1] + 1.414);
      if (x > 0 && y < h - 1) m = Math.min(m, d[i + w - 1] + 1.414);
      d[i] = m;
    }
  }
  let max = 0;
  for (let i = 0; i < d.length; i++) if (d[i] < INF && d[i] > max) max = d[i];
  if (max <= 0) max = 1;
  for (let i = 0; i < d.length; i++) d[i] = Math.min(1, d[i] / max);
  return d;
}

const tick = () => new Promise((r) => setTimeout(r, 16));

export type Stage = "segment" | "depth" | "mesh" | "finalize";

export async function processImage(
  img: HTMLImageElement,
  onStage?: (stage: Stage) => void,
): Promise<ProcessedImage> {
  onStage?.("segment");
  await tick();

  const work = drawToCanvas(img, WORK_MAX);
  const { w, h } = work;
  const imageData = work.ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const bg = segment(data, w, h);

  // soften the mask edge
  const rawMask = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) rawMask[i] = bg[i] ? 0 : 1;
  const mask = blur(rawMask, w, h, 1);
  for (let i = 0; i < mask.length; i++) mask[i] = mask[i] < 0.35 ? 0 : Math.min(1, mask[i] * 1.15);

  let coverage = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) coverage++;
  coverage /= mask.length;

  // write alpha back for the working buffer
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = Math.round(mask[i] * 255);

  onStage?.("depth");
  await tick();

  // brightness
  const bright = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    bright[i] =
      (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }
  const smooth = blur(bright, w, h, 2);

  // sobel edge magnitude (edges pull depth down -> creases)
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -smooth[i - w - 1] -
        2 * smooth[i - 1] -
        smooth[i + w - 1] +
        smooth[i - w + 1] +
        2 * smooth[i + 1] +
        smooth[i + w + 1];
      const gy =
        -smooth[i - w - 1] -
        2 * smooth[i - w] -
        smooth[i - w + 1] +
        smooth[i + w - 1] +
        2 * smooth[i + w] +
        smooth[i + w + 1];
      edge[i] = Math.min(1, Math.hypot(gx, gy));
    }
  }

  // contrast signal measured inside the product only
  let sum = 0,
    sum2 = 0,
    count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0.5) {
      sum += bright[i];
      sum2 += bright[i] * bright[i];
      count++;
    }
  }
  const mean = count ? sum / count : 0;
  const contrast = count ? Math.sqrt(Math.max(0, sum2 / count - mean * mean)) : 0;

  if (coverage < 0.015 || coverage > 0.995 || contrast < 0.055) {
    throw new LowContrastError();
  }

  const dist = interiorDistance(mask, w, h);

  const rawDepth = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (mask[i] <= 0.5) {
      rawDepth[i] = 0;
      continue;
    }
    const body = Math.sqrt(dist[i]); // rounded volume
    const shade = smooth[i];
    rawDepth[i] = Math.max(0, 0.58 * body + 0.42 * shade - 0.35 * edge[i]);
  }
  const depth = blur(rawDepth, w, h, 2);
  let dmax = 0;
  for (let i = 0; i < depth.length; i++) if (depth[i] > dmax) dmax = depth[i];
  if (dmax > 0) for (let i = 0; i < depth.length; i++) depth[i] = (depth[i] / dmax) * mask[i];

  // high resolution texture (same segmentation, upscaled mask)
  const tex = drawToCanvas(img, TEX_MAX);
  const texData = tex.ctx.getImageData(0, 0, tex.w, tex.h);
  for (let y = 0; y < tex.h; y++) {
    const sy = Math.min(h - 1, Math.floor((y / tex.h) * h));
    for (let x = 0; x < tex.w; x++) {
      const sx = Math.min(w - 1, Math.floor((x / tex.w) * w));
      texData.data[(y * tex.w + x) * 4 + 3] = Math.round(mask[sy * w + sx] * 255);
    }
  }
  tex.ctx.putImageData(texData, 0, 0);

  return {
    width: w,
    height: h,
    rgba: data,
    mask,
    depth,
    textureCanvas: tex.canvas,
    contrast,
    coverage,
  };
}
