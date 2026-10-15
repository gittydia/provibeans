export type ProductArtwork = {
  file: string;
  width: number;
  height: number;
  alt: string;
};

const ARTWORK: Record<string, ProductArtwork> = {
  "PB-HN-250": {
    file: "/images/hanoi.png",
    width: 156,
    height: 296,
    alt: "Hà Nội coffee pouch in deep green with an illustrated city scene and a cream lower band.",
  },
  "PB-HUE-250": {
    file: "/images/hue.png",
    width: 185,
    height: 296,
    alt: "Huế coffee pouch in violet and indigo with a haloed figure and a dark lower band.",
  },
  "PB-SGN-250": {
    file: "/images/saigon.png",
    width: 180,
    height: 299,
    alt: "Saigon coffee pouch in cyan and orange with a raised-arm figure and a red lower band.",
  },
};

export function productArtwork(sku: string): ProductArtwork | null {
  return ARTWORK[sku] ?? null;
}