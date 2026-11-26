// shortcut: product page copy lives in code until the A11 content editor exists.
// Only say what is confirmed or visible in the product images. The cost lines in the business analysis
// (battery, ports, shell material) are assumptions, not specs: don't publish them.

/** A close-up cut from the main photo, used until a real detail shot is added. x and y are % of the photo. */
export type Detail = { label: string; x: number; y: number; zoom: number };

export type ProductContent = {
  word: string; // the giant outline word behind the stage
  kind: string;
  note: string; // handwritten aside
  details: Detail[];
  specs: [string, string][];
  inBox: string[];
};

export const productContent: Record<string, ProductContent | undefined> = {
  "static-one": {
    word: "ONE", kind: "Desk speaker", note: "see right through it",
    details: [
      { label: "Top dial", x: 51, y: 24, zoom: 3 },
      { label: "Front ring", x: 56, y: 45, zoom: 3 },
      { label: "Clear shell", x: 46, y: 55, zoom: 2 },
    ],
    specs: [], inBox: [],
  },
  signal: {
    word: "SIGNAL", kind: "Desktop DAC / amp with line out", note: "nothing to hide",
    details: [
      { label: "The knob", x: 66, y: 57, zoom: 3 },
      { label: "Board on show", x: 41, y: 59, zoom: 3 },
      { label: "Clear shell", x: 50, y: 48, zoom: 2 },
    ],
    specs: [], inBox: [],
  },
  stand: {
    word: "STAND", kind: "Stand", note: "violet, on purpose",
    details: [
      { label: "Top arm", x: 59, y: 24, zoom: 3 },
      { label: "Violet slab", x: 52, y: 52, zoom: 2.4 },
      { label: "The base", x: 55, y: 80, zoom: 3 },
    ],
    specs: [], inBox: [],
  },
  wire: { word: "WIRE", kind: "Cable", note: "the link", details: [], specs: [], inBox: [] },
};
