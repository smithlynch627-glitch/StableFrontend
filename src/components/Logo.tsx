import { useState } from 'react';
import { BRAND } from '../config';

/** Site logo with a clean fallback if the image cannot load. */
export function Logo({ size = 34, className = '' }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`logo-fallback ${className}`} style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">S</span>;
  return <img src={BRAND.logo} alt="" width={size} height={size} className={`logo-img ${className}`} onError={() => setFailed(true)} />;
}
