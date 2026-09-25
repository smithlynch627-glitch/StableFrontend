// Rarity colours: a smooth colour scale from the rarest item (gold) through orange, red, pink, purple, blue and
// teal to the most common (green). The position on the scale is rank ÷ items in the collection, so every rank has
// its own colour and the scale always fits the collection's size (no fixed tiers or ranges).
// Two palettes: a lighter one for dark backgrounds (and on top of images) and a deeper one for white backgrounds.

export type RarityTone = { p: number; dark: string; light: string; topPct: number };

/** 0 = rarest, 1 = most common. */
export function rarityPosition(rank: number, of: number): number {
  if (!of || of <= 1) return 0;
  return Math.min(1, Math.max(0, (rank - 1) / (of - 1)));
}

/** Hue path (OKLCH degrees), walked from rare to common. */
const HUE_START = 88; // gold
const HUE_SPAN = 300; // … to green (88 - 300 = -212 ≡ 148)

function hueAt(p: number) {
  // More colour steps for the rare end, where differences matter most.
  const eased = Math.pow(p, 0.62);
  return (((HUE_START - HUE_SPAN * eased) % 360) + 360) % 360;
}

export function rarityColor(p: number, mode: 'dark' | 'light'): string {
  const h = hueAt(p);
  // Gold/yellow needs more lightness to read as gold, blues less.
  const warm = Math.max(0, Math.cos(((h - 90) * Math.PI) / 180)); // 1 at yellow, 0 away from it
  const L = mode === 'dark' ? 0.76 + 0.08 * warm : 0.52 + 0.05 * warm;
  const C = mode === 'dark' ? 0.17 : 0.18;
  return oklchToHex(L, C, h);
}

export function rarityTone(rank: number, of: number): RarityTone {
  const p = rarityPosition(rank, of);
  return { p, dark: rarityColor(p, 'dark'), light: rarityColor(p, 'light'), topPct: of ? (rank / of) * 100 : 100 };
}

/** Same scale for one trait: share of items that have it (1 % → rare colours, 60 % → common colours). */
export function traitTone(count: number, total: number): RarityTone {
  const share = total ? Math.min(1, count / total) : 1;
  return { p: share, dark: rarityColor(share, 'dark'), light: rarityColor(share, 'light'), topPct: share * 100 };
}

/** CSS variables for the .rk classes (the stylesheet picks the palette that fits the theme). */
export const toneVars = (tone: RarityTone) => ({ '--rk-dark': tone.dark, '--rk-light': tone.light }) as React.CSSProperties;

/** Gradient of the whole scale, for the rarity bar. */
export function scaleGradient(mode: 'dark' | 'light', steps = 12) {
  const stops = Array.from({ length: steps + 1 }, (_, i) => `${rarityColor(i / steps, mode)} ${((i / steps) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** "Top 0.66%" style text: more decimals for the very rare. */
export function topText(pct: number) {
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${Number(pct.toFixed(1))}%`;
  return `${Number(pct.toPrecision(2))}%`;
}

// ── OKLCH → sRGB hex, reducing chroma until the colour fits the sRGB gamut ─────────────────────────────────────
function oklchToHex(L: number, C: number, h: number): string {
  for (let c = C; c >= 0; c -= 0.005) {
    const rgb = oklabToSrgb(L, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180));
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return toHex(rgb);
  }
  return toHex(oklabToSrgb(L, 0, 0));
}

function oklabToSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055)) as [number, number, number];
}

const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
