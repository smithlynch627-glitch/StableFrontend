// Deterministic helpers for placeholder art. Real images (image_url) always win.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Smooth organic blob (cow-hide spot) through `points` jittered radii. */
export function blobPath(cx: number, cy: number, r: number, rand: () => number, points = 7, wobble = 0.45) {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + rand() * 0.4;
    const rr = r * (1 - wobble / 2 + rand() * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points], p1 = pts[i], p2 = pts[(i + 1) % points], p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

// Placeholder traits for GIWA COWS previews before real metadata is revealed.
const TABLE: [string, [string, number][]][] = [
  ['Background', [['Paper', 30], ['Ink', 18], ['Fog', 24], ['Roof Tile', 16], ['Hanji', 12]]],
  ['Hide', [['Classic Spots', 34], ['Big Patch', 20], ['Freckles', 18], ['Midnight', 12], ['Ghost', 10], ['Marble', 6]]],
  ['Horns', [['Short', 38], ['Long', 26], ['Curled', 16], ['None', 12], ['Chrome', 8]]],
  ['Eyes', [['Calm', 34], ['Sleepy', 26], ['Wide', 20], ['Shades', 12], ['Wink', 8]]],
  ['Outfit', [['None', 28], ['Hoodie', 20], ['GIWA Tee', 18], ['Hanbok', 13], ['Suit', 11], ['Varsity', 10]]],
  ['Accessory', [['None', 44], ['Nose Ring', 20], ['Bell', 16], ['Earring', 11], ['Headphones', 9]]],
];

export function cowAttributes(tokenId: number) {
  const rand = mulberry32(tokenId * 2654435761);
  return TABLE.map(([trait_type, options]) => {
    const total = options.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    let value = options[options.length - 1][0];
    for (const [v, w] of options) if ((r -= w) <= 0) { value = v; break; }
    return { trait_type, value };
  });
}
