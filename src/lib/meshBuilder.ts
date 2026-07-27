import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { ProcessedImage } from "./imagePipeline";

/**
 * Builds a sealed solid "relief" mesh from the processed image and exports it
 * as a GLB blob URL for <model-viewer>.
 *
 * All falloff / UV / displacement math runs once, here, at generation time —
 * never per frame.
 */

interface BuildOptions {
  segments: number;
  thickness: number;
}

function sampler(field: Float32Array, w: number, h: number) {
  return (u: number, v: number) => {
    const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
    const y = Math.min(h - 1, Math.max(0, Math.round(v * (h - 1))));
    return field[y * w + x];
  };
}

function buildGeometries(img: ProcessedImage, opts: BuildOptions) {
  const { segments, thickness } = opts;
  const aspect = img.width / img.height;
  const nx = Math.max(8, Math.round(segments * (aspect >= 1 ? 1 : aspect)));
  const ny = Math.max(8, Math.round(segments * (aspect >= 1 ? 1 / aspect : 1)));

  const sampleDepth = sampler(img.depth, img.width, img.height);
  const sampleMask = sampler(img.mask, img.width, img.height);

  const planeW = aspect >= 1 ? 1 : aspect;
  const planeH = aspect >= 1 ? 1 / aspect : 1;

  const gx = nx + 1;
  const gy = ny + 1;
  const front = new Float32Array(gx * gy * 3);
  const back = new Float32Array(gx * gy * 3);
  const uvs = new Float32Array(gx * gy * 2);
  const solid = new Uint8Array(gx * gy);

  for (let j = 0; j < gy; j++) {
    const v = j / ny;
    for (let i = 0; i < gx; i++) {
      const u = i / nx;
      const idx = j * gx + i;

      const d = sampleDepth(u, v);
      const m = sampleMask(u, v);

      // radial / spherical falloff so silhouette edges curve inward
      const rx = (u - 0.5) * 2;
      const ry = (v - 0.5) * 2;
      const r = Math.min(1, Math.hypot(rx, ry) / 1.25);
      const falloff = Math.sqrt(Math.max(0, 1 - r * r));

      const z = d * thickness * (0.35 + 0.65 * falloff);

      const px = (u - 0.5) * planeW;
      const py = (0.5 - v) * planeH;

      front[idx * 3] = px;
      front[idx * 3 + 1] = py;
      front[idx * 3 + 2] = z;

      back[idx * 3] = px;
      back[idx * 3 + 1] = py;
      back[idx * 3 + 2] = -z * 0.4 - thickness * 0.05;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = 1 - v;

      solid[idx] = m > 0.5 ? 1 : 0;
    }
  }

  const cellFilled = (i: number, j: number) =>
    i >= 0 &&
    j >= 0 &&
    i < nx &&
    j < ny &&
    solid[j * gx + i] === 1 &&
    solid[j * gx + i + 1] === 1 &&
    solid[(j + 1) * gx + i] === 1 &&
    solid[(j + 1) * gx + i + 1] === 1;

  const frontPos: number[] = [];
  const frontUv: number[] = [];
  const shellPos: number[] = [];

  const pushTri = (
    target: number[],
    src: Float32Array,
    a: number,
    b: number,
    c: number,
  ) => {
    for (const k of [a, b, c]) {
      target.push(src[k * 3], src[k * 3 + 1], src[k * 3 + 2]);
    }
  };
  const pushUv = (a: number, b: number, c: number) => {
    for (const k of [a, b, c]) frontUv.push(uvs[k * 2], uvs[k * 2 + 1]);
  };

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cellFilled(i, j)) continue;
      const a = j * gx + i;
      const b = j * gx + i + 1;
      const c = (j + 1) * gx + i;
      const d = (j + 1) * gx + i + 1;

      // front (textured, front-facing)
      pushTri(frontPos, front, a, c, b);
      pushUv(a, c, b);
      pushTri(frontPos, front, b, c, d);
      pushUv(b, c, d);

      // back (neutral material, reversed winding)
      pushTri(shellPos, back, a, b, c);
      pushTri(shellPos, back, b, d, c);

      // side walls on silhouette boundary edges
      const edges: Array<[number, number, boolean]> = [
        [a, b, !cellFilled(i, j - 1)], // top
        [c, d, !cellFilled(i, j + 1)], // bottom
        [a, c, !cellFilled(i - 1, j)], // left
        [b, d, !cellFilled(i + 1, j)], // right
      ];
      for (const [p, q, isBoundary] of edges) {
        if (!isBoundary) continue;
        // quad: frontP, frontQ, backQ, backP
        shellPos.push(
          front[p * 3],
          front[p * 3 + 1],
          front[p * 3 + 2],
          front[q * 3],
          front[q * 3 + 1],
          front[q * 3 + 2],
          back[q * 3],
          back[q * 3 + 1],
          back[q * 3 + 2],
        );
        shellPos.push(
          front[p * 3],
          front[p * 3 + 1],
          front[p * 3 + 2],
          back[q * 3],
          back[q * 3 + 1],
          back[q * 3 + 2],
          back[p * 3],
          back[p * 3 + 1],
          back[p * 3 + 2],
        );
      }
    }
  }

  const frontGeo = new THREE.BufferGeometry();
  frontGeo.setAttribute("position", new THREE.Float32BufferAttribute(frontPos, 3));
  frontGeo.setAttribute("uv", new THREE.Float32BufferAttribute(frontUv, 2));
  frontGeo.computeVertexNormals();

  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute("position", new THREE.Float32BufferAttribute(shellPos, 3));
  shellGeo.computeVertexNormals();

  return { frontGeo, shellGeo, triangles: frontPos.length / 9 + shellPos.length / 9 };
}

function toScene(img: ProcessedImage, opts: BuildOptions) {
  const { frontGeo, shellGeo, triangles } = buildGeometries(img, opts);

  const texture = new THREE.CanvasTexture(img.textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // side/back geometry never samples the photo — UVs stay clamped to the front
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const frontMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.62,
    metalness: 0.06,
  });
  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#141c30"),
    roughness: 0.85,
    metalness: 0.15,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(frontGeo, frontMat));
  scene.add(new THREE.Mesh(shellGeo, shellMat));
  return { scene, triangles };
}

function exportGlb(scene: THREE.Scene): Promise<string> {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        resolve(URL.createObjectURL(blob));
      },
      (err) => reject(err instanceof Error ? err : new Error("Mesh export failed")),
      { binary: true },
    );
  });
}

export interface MeshResult {
  highUrl: string;
  lowUrl: string;
  triangles: number;
}

export async function buildMeshes(img: ProcessedImage): Promise<MeshResult> {
  const high = toScene(img, { segments: 200, thickness: 0.32 });
  const low = toScene(img, { segments: 64, thickness: 0.32 });

  const [highUrl, lowUrl] = await Promise.all([exportGlb(high.scene), exportGlb(low.scene)]);
  return { highUrl, lowUrl, triangles: high.triangles };
}
