import { useState } from 'react';
import { BRAND } from '../config';
import { useAppConfig } from '../lib/appConfig';
import { fixImageUrl } from './Art';

/** Site logo with a clean fallback if the image cannot load. */
export function Logo({ size = 34, className = '' }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { ipfsGateway } = useAppConfig();
  if (failed) return <span className={`logo-fallback ${className}`} style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">S</span>;
  return <img src={fixImageUrl(BRAND.logo, ipfsGateway)} alt="" width={size} height={size} className={`logo-img ${className}`} onError={() => setFailed(true)} />;
}
