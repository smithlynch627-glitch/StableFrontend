import { useI18n } from '../i18n';
import { activeChain } from '../config';
import { gweiText, useEthPrice, useGiwaLive, useMainnetGas } from '../lib/live';

/** Always-visible live strip: ETH price, GIWA block + gas, Ethereum gas. */
export function StatusBar() {
  const { t, lang } = useI18n();
  const price = useEthPrice();
  const giwa = useGiwaLive();
  const l1 = useMainnetGas();
  const usd = price.data?.usd;
  const change = price.data?.change24h;
  const transferUsd = usd && giwa.data ? (Number(giwa.data.gasPrice) * 21_000 * usd) / 1e18 : null;
  const fmtUsd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  return (
    <div className="status-bar" role="status" aria-live="off">
      <div className="status-bar__inner">
        <span className="status-item">
          <span className={`live-dot ${giwa.isError ? 'is-down' : ''}`} />
          <span className="strong">{activeChain.name}</span>
          <span className="muted mono-num">{giwa.data ? `#${Number(giwa.data.block).toLocaleString()}` : '—'}</span>
        </span>
        <span className="status-item">
          <span className="muted">{t('status.giwaGas')}</span>
          <span className="mono-num strong">{gweiText(giwa.data?.gasPrice)} gwei</span>
          {transferUsd !== null && <span className="muted mono-num hide-md">{t('status.transfer')} {transferUsd < 0.01 ? '<$0.01' : fmtUsd(transferUsd)}</span>}
        </span>
        <span className="status-item hide-sm">
          <span className="muted">{t('status.ethGas')}</span>
          <span className="mono-num strong">{gweiText(l1.data)} gwei</span>
        </span>
        <span className="spacer" />
        <span className="status-item">
          <span className="muted">ETH</span>
          <span className="mono-num strong">{usd ? fmtUsd(usd) : '—'}</span>
          {change !== null && change !== undefined && (
            <span className={`mono-num ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
          )}
          {lang === 'ko' && price.data?.krw && <span className="mono-num muted hide-sm">₩{Math.round(price.data.krw).toLocaleString('ko-KR')}</span>}
        </span>
      </div>
    </div>
  );
}
