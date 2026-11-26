// shortcut: media is found by file name under public/ (move to the database with A11 content editing).
// To add or replace an image, put the file at its path below; no code change is needed.
import { existsSync } from "node:fs";
import path from "node:path";

export type Media = {
  photo?: string;
  art?: string;
  model?: string;
  cameraDistance?: string;
  /** assets/products/<slug>/detail-1..3: close-up photos. */
  details: (string | undefined)[];
  /** assets/products/<slug>/desk: a wide shot of the product on a desk. */
  desk?: string;
};

const FILES: Record<string, { name: string; model: string; version?: string; cameraDistance?: string }> = {
  "static-one": { name: "speaker", model: "statix_cube", version: "3" },
  signal: { name: "amp", model: "statix_amp", version: "1" },
  stand: { name: "stand", model: "statix_stand", version: "1", cameraDistance: "140%" },
  wire: { name: "wire", model: "statix_wire" },
};

const found = (url: string) => (existsSync(path.join(process.cwd(), "public", url)) ? url : undefined);
const image = (base: string) => ["webp", "jpg", "png"].map((ext) => found(`${base}.${ext}`)).find(Boolean);

/** Server only. Returns just the files that exist. */
export function productMedia(slug: string): Media {
  const files = FILES[slug];
  const model = files && found(`/assets/${files.model}.glb`);
  return {
    photo: files && found(`/assets/${files.name}.jpg`),
    art: files && found(`/assets/${files.name}_art.webp`),
    model: model && (files.version ? `${model}?v=${files.version}` : model),
    cameraDistance: files?.cameraDistance,
    details: [1, 2, 3].map((n) => image(`/assets/products/${slug}/detail-${n}`)),
    desk: image(`/assets/products/${slug}/desk`),
  };
}
