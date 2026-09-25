import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GIWA_COWS } from '../config';
import { useAppConfig } from '../lib/appConfig';
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
 * IPFS images can be slow or missing on any single gateway (new uploads take time to spread, public gateways
 * rate-limit). Each image is tried on: the marketplace's own gateway (if set) → the link as saved → Pinata's
 * public gateway → w3s.link → dweb.link. A "bafkrei…" CID is one raw file, so a file name after it is dropped;
 * for other CIDs the bare CID is tried last (images uploaded one by one with a name added by mistake).
 */
const PUBLIC_GATEWAYS = ['https://gateway.pinata.cloud/ipfs/', 'https://w3s.link/ipfs/', 'https://dweb.link/ipfs/'];
export function imageCandidates(src: string, preferred?: string | null): string[] {
  const m = src.match(/^(?:ipfs:\/\/(?:ipfs\/)?|https?:\/\/[^/]+\/ipfs\/)([a-z0-9]{40,})(\/[^?#]*)?/i);
  if (!m) return [src];
  const [, cid, rawPath] = m;
  const path = rawPath && rawPath !== '/' ? rawPath : '';
  const tail = /^bafkrei/i.test(cid) ? '' : path;
  const own = src.startsWith('http') ? src.slice(0, src.indexOf('/ipfs/') + 6) : null;
  const gateways = [preferred, own, ...PUBLIC_GATEWAYS].filter((g): g is string => !!g);
  const out = gateways.map((g) => `${g}${cid}${tail}`);
  if (tail) out.push(`${gateways[0]}${cid}`, `${PUBLIC_GATEWAYS[0]}${cid}`);
  return [...new Set(out)];
}
export const fixImageUrl = (src: string, preferred?: string | null) => imageCandidates(src, preferred)[0];

/** Video files (by extension or data: type) are shown as silent looping video; everything else as an image. */
export const isVideoUrl = (src: string) => /^data:video\//i.test(src) || /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(src);

/**
 * NFT media in any browser format: PNG, JPG, GIF, WebP, AVIF, SVG, BMP (as <img>) and MP4/WebM/MOV (as <video>).
 * Links without a file extension are tried as an image first and as a video if no gateway can show them as one.
 */
export function SmartImage({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const { ipfsGateway } = useAppConfig();
  const list = useMemo(() => imageCandidates(src, ipfsGateway), [src, ipfsGateway]);
  const [i, setI] = useState(0);
  const [kind, setKind] = useState<'img' | 'video'>(isVideoUrl(src) ? 'video' : 'img');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => { setI(0); setKind(isVideoUrl(src) ? 'video' : 'img'); setState('loading'); }, [src, ipfsGateway]);
  const next = () => {
    if (i + 1 < list.length) return setI(i + 1);
    // No gateway could show it as an image: an extension-less link may be a video.
    if (kind === 'img' && !/^data:image\//i.test(src)) { setKind('video'); setI(0); return; }
    setState('error');
  };
  // Lazy media only starts loading near the screen, so the timeout below starts only once it is visible.
  const ref = useRef<HTMLImageElement & HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, i, kind]);
  // A gateway that neither loads nor fails within 9 s is skipped (some hang instead of returning an error).
  useEffect(() => {
    if (!visible || state !== 'loading') return;
    const id = setTimeout(next, kind === 'video' ? 20_000 : 9_000);
    return () => clearTimeout(id);
  }, [i, kind, state, visible, list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === 'error') return <>{fallback}</>;
  const hidden = state === 'loading' ? { opacity: 0 } : undefined;
  return (
    <>
      {state === 'loading' && <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />}
      {kind === 'video' ? (
        <video
          key={`v:${list[i]}`}
          ref={ref}
          className="art"
          src={list[i]}
          aria-label={alt}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedData={() => setState('ok')}
          onError={next}
          style={hidden}
        />
      ) : (
        <img
          key={`i:${list[i]}`}
          ref={ref}
          className="art"
          src={list[i]}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={next}
          style={hidden}
        />
      )}
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
