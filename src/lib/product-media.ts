// shortcut: media is found by file name under public/ (move to the database with A11 content editing).
// To add or replace an image, put the file at its path below; no code change is needed.
import { existsSync } from "node:fs";
import path from "node:path";

export type Media = {
  /** Where the camera goes for each page tab, as "turn tilt distance". */
  angles: Record<string, string>;
  photo?: string;
  art?: string;
  model?: string;
  /** assets/products/<slug>/detail-1..3: close-up photos. */
  details: (string | undefined)[];
  /** assets/products/<slug>/desk: a wide shot of the product on a desk. */
  desk?: string;
};

// Camera for each page tab: "turn tilt distance". Smaller is closer. Each distance is the closest that keeps the whole
// model on screen with room around it (measured at 1280x800, 1920x960, 1280x650 and 900x700).
const FILES: Record<string, { name: string; model: string; version?: string; angles?: Record<string, string> }> = {
  "static-one": {
    name: "speaker", model: "statix_cube", version: "3",
    // close: the driver face. run: the volume dial on top.
    angles: { buy: "30deg 72deg 116%", close: "90deg 80deg 103%", specs: "180deg 78deg 102%", run: "0deg 12deg 92%" },
  },
  signal: {
    name: "amp", model: "statix_amp", version: "1",
    // specs: the front I/O. run: the driver on top.
    angles: { buy: "30deg 72deg 118%", close: "90deg 75deg 90%", specs: "0deg 80deg 106%", run: "0deg 12deg 95%" },
  },
  stand: {
    name: "stand", model: "statix_stand", version: "1",
    angles: { buy: "30deg 72deg 123%", close: "90deg 80deg 114%", specs: "180deg 75deg 119%", run: "270deg 80deg 115%" },
  },
  wire: { name: "wire", model: "statix_wire" },
};

const found = (url: string) => (existsSync(path.join(process.cwd(), "public", url)) ? url : undefined);
const image = (base: string) => ["webp", "jpg", "png"].map((ext) => found(`${base}.${ext}`)).find(Boolean);

/** Server only. Returns just the files that exist. */
export function productMedia(slug: string): Media {
  const files = FILES[slug];
  const model = files && found(`/assets/${files.model}.glb`);
  return {
    angles: (model && files?.angles) || {},
    photo: files && found(`/assets/${files.name}.jpg`),
    art: files && found(`/assets/${files.name}_art.webp`),
    model: model && (files.version ? `${model}?v=${files.version}` : model),
    details: [1, 2, 3].map((n) => image(`/assets/products/${slug}/detail-${n}`)),
    desk: image(`/assets/products/${slug}/desk`),
  };
}
