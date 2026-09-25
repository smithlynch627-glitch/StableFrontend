import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GIWA_COWS } from '../config';
import { blobPath, hashSeed, mulberry32 } from '../lib/art';
import type { Attribute } from '../lib/types';

/** Official GIWA COWS artwork by index (wraps around the 18 published pieces). */
export function CowImage({ index, alt }: { index: number; alt?: string }) {
  const src = GIWA_COWS.images[((index % GIWA_COWS.images.length) + GIWA_COWS.images.length) % GIWA_COWS.images.length];
  return <SmartImage src={src} alt={alt || `${GIWA_COWS.name} artwork`} fallback={<TileArt seed={`cow-${index}`} />} />;
}

/** Placeholder for creator collections: roof-tile rows, a nod to "giwa" (Korean roof tile). */
export function TileArt({ seed, wide = false }: { seed: string; wide?: boolean }) {
  const s = useMemo(() => {
    const rand = mulberry32(hashSeed(seed));
    const inverted = rand() > 0.55;
    const cols = 3 + Math.floor(rand() * 4);
    const stroke = 5 + rand() * 9;
    const filledEvery = 2 + Math.floor(rand() * 4);
    const shift = rand() > 0.5;
    const blob = rand() > 0.6;
    return { rand, inverted, cols, stroke, filledEvery, shift, blob, blobSeed: rand() };
  }, [seed]);
  const W = wide ? 300 : 100;
  const H = wide ? 100 : 100;
  const fg = s.inverted ? '#fff' : '#000';
  const bg = s.inverted ? '#000' : '#fff';
  const w = W / s.cols;
  const rows = Math.ceil(H / (w * 0.55)) + 1;
  const arcs: ReactNode[] = [];
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c <= s.cols; c++) {
      const x = c * w + (s.shift && r % 2 ? w / 2 : 0);
      const y = r * w * 0.55;
      const filled = (k++ % s.filledEvery) === 0;
      arcs.push(
        <path
          key={`${r}-${c}`}
          d={`M${x + 2} ${y} Q${x + w / 2} ${y + w * 0.55} ${x + w - 2} ${y}`}
          fill="none"
          stroke={fg}
          strokeWidth={filled ? s.stroke : Math.max(1.2, s.stroke / 4)}
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="art" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width={W} height={H} fill={bg} />
      {arcs}
      {s.blob && <path d={blobPath(W / 2, H / 2, H * 0.24, mulberry32(Math.floor(s.blobSeed * 1e9)), 8)} fill={fg} stroke={bg} strokeWidth="3" />}
    </svg>
  );
}

/** Image with skeleton while loading and generated art if it fails. */
/**
 * IPFS image links are tried in order: as given → without a file name after the CID (single-file uploads) →
 * the same on a second gateway. A "bafkrei…" CID is one raw file, so a file name after it is dropped up front.
 */
export function imageCandidates(src: string): string[] {
  const m = src.match(/^(https?:\/\/[^/]+\/ipfs\/)([a-z0-9]{40,})(\/[^?#]*)?/i);
  if (!m) return [src];
  const [, gw, cid, rawPath] = m;
  const path = rawPath && rawPath !== '/' ? rawPath : '';
  const raw = /^bafkrei/i.test(cid);
  const out = raw || !path ? [`${gw}${cid}`] : [`${gw}${cid}${path}`, `${gw}${cid}`];
  const alt = /dweb\.link/.test(gw) ? 'https://ipfs.io/ipfs/' : 'https://dweb.link/ipfs/';
  out.push(...out.map((u) => u.replace(gw, alt)));
  return [...new Set(out)];
}
export const fixImageUrl = (src: string) => imageCandidates(src)[0];

export function SmartImage({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const list = useMemo(() => imageCandidates(src), [src]);
  const [i, setI] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => { setI(0); setState('loading'); }, [src]);
  if (state === 'error') return <>{fallback}</>;
  return (
    <>
      {state === 'loading' && <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />}
      <img
        className="art"
        src={list[i]}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState('ok')}
        onError={() => (i + 1 < list.length ? setI(i + 1) : setState('error'))}
        style={state === 'loading' ? { opacity: 0 } : undefined}
      />
    </>
  );
}

type ColLike = { address: string; art_style?: 'cow' | 'tile' | string | null; image_url?: string | null; banner_url?: string | null; name?: string };
type TokLike = { token_id: string; image_url?: string | null; attributes?: Attribute[] | null; name?: string | null };

export function TokenArt({ collection, token }: { collection: ColLike; token: TokLike }) {
  const id = Number(token.token_id);
  const generated =
    collection.art_style === 'cow' ? (
      <SmartImage src={GIWA_COWS.logo} alt={`#${id}`} fallback={<TileArt seed={`${collection.address}:${token.token_id}`} />} />
    ) : (
      <TileArt seed={`${collection.address}:${token.token_id}`} />
    );
  if (token.image_url) return <SmartImage src={token.image_url} alt={token.name || `#${token.token_id}`} fallback={generated} />;
  return generated;
}

export function CollectionAvatar({ collection }: { collection: ColLike }) {
  const generated =
    collection.art_style === 'cow' ? <SmartImage src={GIWA_COWS.logo} alt={GIWA_COWS.name} fallback={<TileArt seed={collection.address} />} /> : <TileArt seed={collection.address} />;
  if (collection.image_url) return <SmartImage src={collection.image_url} alt={collection.name || ''} fallback={generated} />;
  return generated;
}

export function CollectionBanner({ collection }: { collection: ColLike }) {
  const generated =
    collection.art_style === 'cow' ? (
      <SmartImage src={GIWA_COWS.banner} alt="" fallback={<TileArt seed={`${collection.address}:banner`} wide />} />
    ) : (
      <TileArt seed={`${collection.address}:banner`} wide />
    );
  if (collection.banner_url) return <SmartImage src={collection.banner_url} alt="" fallback={generated} />;
  return generated;
}

/** Wallet avatar: a cow-hide circle unique to the address. */
export function Avatar({ address, size = 32 }: { address: string; size?: number }) {
  const paths = useMemo(() => {
    const rand = mulberry32(hashSeed(address.toLowerCase()));
    const inverted = rand() > 0.5;
    return { inverted, d: Array.from({ length: 4 }).map(() => blobPath(rand() * 40, rand() * 40, 6 + rand() * 7, rand)) };
  }, [address]);
  return (
    <span className="avatar" style={{ width: size, height: size, display: 'inline-block' }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <rect width="40" height="40" fill={paths.inverted ? '#000' : '#fff'} />
        {paths.d.map((d, i) => <path key={i} d={d} fill={paths.inverted ? '#fff' : '#000'} />)}
        <circle cx="20" cy="20" r="19.4" fill="none" stroke="#000" strokeOpacity="0.15" />
      </svg>
    </span>
  );
}
