import type { ImageAsset } from "@/components/HDImageCard";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

export async function fileToAsset(file: File): Promise<ImageAsset> {
  const url = await readFileAsDataUrl(file);
  const dims = await imageDimensions(url);
  return { url, name: file.name, bytes: file.size, ...dims };
}

export function imageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}

/**
 * Downscale + JPEG-compress a data URL so the Base64 payload stays small
 * enough for the API (max width 600px, quality 0.6).
 */
export function compressDataUrl(
  dataUrl: string,
  maxWidth = 600,
  quality = 0.6,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not process that image"));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = dataUrl;
  });
}

export async function urlToAsset(url: string, name: string): Promise<ImageAsset> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await readFileAsDataUrl(new File([blob], name, { type: blob.type }));
  const dims = await imageDimensions(dataUrl);
  return { url: dataUrl, name, bytes: blob.size, ...dims };
}
