import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { activeChain } from '../config';
import { gweiText, useEthPrice, useGiwaLive, useMainnetGas } from '../lib/live';
import { CurrencySwitch } from '../lib/currency';
import { useAppConfig } from '../lib/appConfig';
import { SocialLink } from './Social';

/**
 * Always-visible bottom bar: live chain + block, gas, ETH price, the ETH/USD switch, community links and legal links.
 * On phones it keeps the essentials (chain, ETH price, switch); everything else is also in the footer.
 */
export function StatusBar() {
  const { t, lang } = useI18n();
  const { socials } = useAppConfig();
  const price = useEthPrice();
  const giwa = useGiwaLive();
  const l1 = useMainnetGas();
  const usd = price.data?.usd;
  const change = price.data?.change24h;
  const transferUsd = usd && giwa.data ? (Number(giwa.data.gasPrice) * 21_000 * usd) / 1e18 : null;
  const fmtUsd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const explorer = activeChain.blockExplorers?.default.url;

  return (
    <div className="status-bar" role="status" aria-live="off">
      <div className="status-bar__inner">
        <a className="status-item status-item--chain" href={explorer} target="_blank" rel="noreferrer" title={t('status.liveChain')}>
          <span className={`live-dot ${giwa.isError ? 'is-down' : ''}`} />
          <span className="strong">{activeChain.name}</span>
          <span className="muted mono-num">{giwa.data ? `#${Number(giwa.data.block).toLocaleString()}` : '—'}</span>
        </a>
        <span className="status-item hide-sm">
          <span className="muted">{t('status.giwaGas')}</span>
          <span className="mono-num strong">{gweiText(giwa.data?.gasPrice)} gwei</span>
          {transferUsd !== null && <span className="muted mono-num hide-lg">{t('status.transfer')} {transferUsd < 0.01 ? '<$0.01' : fmtUsd(transferUsd)}</span>}
        </span>
        <span className="status-item hide-lg">
          <span className="muted">{t('status.ethGas')}</span>
          <span className="mono-num strong">{gweiText(l1.data)} gwei</span>
        </span>
        <span className="spacer" />
        <span className="status-item status-item--price">
          <span className="eth-glyph" aria-hidden="true">Ξ</span>
          <span className="mono-num strong">{usd ? fmtUsd(usd) : '—'}</span>
          {change !== null && change !== undefined && (
            <span className={`mono-num ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
          )}
          {lang === 'ko' && price.data?.krw && <span className="mono-num muted hide-md">₩{Math.round(price.data.krw).toLocaleString('ko-KR')}</span>}
        </span>
        <span className="status-item status-item--switch">
          <CurrencySwitch compact />
        </span>
        {(socials?.x || socials?.discord || socials?.telegram) && (
          <span className="status-item status-item--social hide-md" aria-label={t('footer.community')}>
            {socials?.x && <SocialLink kind="x" href={socials.x} size={12} />}
            {socials?.discord && <SocialLink kind="discord" href={socials.discord} size={13} />}
            {socials?.telegram && <SocialLink kind="telegram" href={socials.telegram} size={13} />}
          </span>
        )}
        <span className="status-item status-item--links hide-md">
          <Link to="/support">{t('nav.support')}</Link>
          <Link to="/privacy">{t('legal.privacy')}</Link>
          <Link to="/terms">{t('legal.terms')}</Link>
        </span>
      </div>
    </div>
  );
}
