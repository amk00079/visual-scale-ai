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

export async function urlToAsset(url: string, name: string): Promise<ImageAsset> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await readFileAsDataUrl(new File([blob], name, { type: blob.type }));
  const dims = await imageDimensions(dataUrl);
  return { url: dataUrl, name, bytes: blob.size, ...dims };
}
