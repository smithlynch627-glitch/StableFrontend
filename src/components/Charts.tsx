// Lightweight SVG charts (single series each, in the site's ink colour). Every chart has a hover tooltip and a
// table view. Marks follow one spec: 2px lines, ≤24px columns with 4px rounded tops and 2px gaps, ≥8px dots with
// a 2px surface ring, hairline grid.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Point = { t: number; v: number; label?: string };

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(220, el.clientWidth));
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(range: number, count: number) {
  const raw = range / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function yTicks(min: number, max: number, count = 4, zero = true) {
  let lo = zero ? 0 : min;
  let hi = max;
  if (hi === lo) hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.2);
  const step = niceStep(hi - lo, count);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { lo, hi, ticks };
}

const M = { top: 14, right: 14, bottom: 28, left: 58 };

function Frame({ width, height, ticks, lo, hi, fmt, xLabels, children }: {
  width: number; height: number; ticks: number[]; lo: number; hi: number; fmt: (v: number) => string;
  xLabels: { x: number; text: string }[]; children: ReactNode;
}) {
  const y = (v: number) => M.top + (height - M.top - M.bottom) * (1 - (v - lo) / (hi - lo || 1));
  return (
    <svg width={width} height={height} className="chart__svg" role="img">
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={M.left} x2={width - M.right} y1={y(tk)} y2={y(tk)} className="chart__grid" />
          <text x={M.left - 8} y={y(tk)} className="chart__tick" textAnchor="end" dominantBaseline="middle">{fmt(tk)}</text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 8} className="chart__tick" textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{l.text}</text>
      ))}
      {children}
    </svg>
  );
}

function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 12, 8), width - 190);
  return <div className="chart__tip" style={{ left, top: Math.max(0, y - 58) }}>{children}</div>;
}

function xLabelsFor(t0: number, t1: number, width: number, fmtT: (t: number) => string) {
  const n = width < 420 ? 3 : 5;
  return Array.from({ length: n }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    return { x: M.left + ((width - M.left - M.right) * i) / (n - 1), text: fmtT(t) };
  });
}

/** Columns over time buckets (e.g. volume per day). */
export function ColumnChart({ data, fmt, fmtT, tip, height = 220 }: {
  data: Point[]; fmt: (v: number) => string; fmtT: (t: number) => string; tip: (p: Point) => ReactNode; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.v));
  const { lo, hi, ticks } = yTicks(0, max);
  const inner = width - M.left - M.right;
  const band = data.length ? inner / data.length : inner;
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => M.top + (height - M.top - M.bottom) * (1 - (v - lo) / (hi - lo || 1));
  const base = y(0);
  const xl = data.length ? xLabelsFor(data[0].t, data[data.length - 1].t, width, fmtT) : [];
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setHover(null)}>
      <Frame width={width} height={height} ticks={ticks} lo={lo} hi={hi} fmt={fmt} xLabels={xl}>
        {data.map((d, i) => {
          const cx = M.left + band * i + band / 2;
          const top = y(d.v);
          const h = Math.max(0, base - top);
          const r = Math.min(4, barW / 2, h);
          const x0 = cx - barW / 2;
          const path = h <= 0 ? '' : `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
          return (
            <g key={d.t}>
              {path && <path d={path} className={`chart__bar ${hover === i ? 'is-hover' : ''}`} />}
              <rect x={M.left + band * i} y={M.top} width={band} height={height - M.top - M.bottom} fill="transparent"
                onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
            </g>
          );
        })}
        <line x1={M.left} x2={width - M.right} y1={base} y2={base} className="chart__axis" />
      </Frame>
      {hover !== null && data[hover] && <Tip x={M.left + band * hover + band / 2} y={y(data[hover].v)} width={width}>{tip(data[hover])}</Tip>}
    </div>
  );
}

/** A single line over time (e.g. floor price), with a light area wash and a crosshair. */
export function LineChart({ data, fmt, fmtT, tip, height = 220, t0, t1 }: {
  data: Point[]; fmt: (v: number) => string; fmtT: (t: number) => string; tip: (p: Point) => ReactNode; height?: number; t0?: number; t1?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map((d) => d.v);
  const { lo, hi, ticks } = yTicks(Math.min(...vals, 0), Math.max(...vals, 0), 4, true);
  const a = t0 ?? data[0]?.t ?? 0;
  const b = t1 ?? data[data.length - 1]?.t ?? 1;
  const x = (t: number) => M.left + (width - M.left - M.right) * ((t - a) / (b - a || 1));
  const y = (v: number) => M.top + (height - M.top - M.bottom) * (1 - (v - lo) / (hi - lo || 1));
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t)},${y(d.v)}`).join(' ');
  const area = data.length ? `${line} L${x(data[data.length - 1].t)},${y(lo)} L${x(data[0].t)},${y(lo)} Z` : '';
  function move(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    data.forEach((d, i) => { if (Math.abs(x(d.t) - px) < Math.abs(x(data[best].t) - px)) best = i; });
    setHover(data.length ? best : null);
  }
  const last = data[data.length - 1];
  return (
    <div className="chart" ref={ref} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <Frame width={width} height={height} ticks={ticks} lo={lo} hi={hi} fmt={fmt} xLabels={xLabelsFor(a, b, width, fmtT)}>
        {area && <path d={area} className="chart__area" />}
        {line && <path d={line} className="chart__line" />}
        {hover !== null && <line x1={x(data[hover].t)} x2={x(data[hover].t)} y1={M.top} y2={height - M.bottom} className="chart__cross" />}
        {hover !== null && <circle cx={x(data[hover].t)} cy={y(data[hover].v)} r={4} className="chart__dot" />}
        {last && hover === null && (
          <>
            <circle cx={x(last.t)} cy={y(last.v)} r={4} className="chart__dot" />
            <text x={Math.min(x(last.t), width - M.right) - 6} y={y(last.v) - 10} className="chart__label" textAnchor="end">{fmt(last.v)}</text>
          </>
        )}
      </Frame>
      {hover !== null && <Tip x={x(data[hover].t)} y={y(data[hover].v)} width={width}>{tip(data[hover])}</Tip>}
    </div>
  );
}

/** Individual sales as dots over time; the nearest dot to the pointer shows its details. */
export function ScatterChart({ data, fmt, fmtT, tip, height = 260, t0, t1 }: {
  data: Point[]; fmt: (v: number) => string; fmtT: (t: number) => string; tip: (p: Point) => ReactNode; height?: number; t0: number; t1: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { lo, hi, ticks } = yTicks(0, Math.max(0, ...data.map((d) => d.v)));
  const x = (t: number) => M.left + (width - M.left - M.right) * ((t - t0) / (t1 - t0 || 1));
  const y = (v: number) => M.top + (height - M.top - M.bottom) * (1 - (v - lo) / (hi - lo || 1));
  const pts = useMemo(() => data.map((d) => ({ ...d, px: x(d.t), py: y(d.v) })), [data, width, lo, hi, t0, t1]); // eslint-disable-line react-hooks/exhaustive-deps
  function move(e: React.PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best = -1;
    let dist = 28 * 28; // hit radius larger than the dot
    pts.forEach((p, i) => {
      const d = (p.px - mx) ** 2 + (p.py - my) ** 2;
      if (d < dist) { dist = d; best = i; }
    });
    setHover(best >= 0 ? best : null);
  }
  return (
    <div className="chart" ref={ref} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <Frame width={width} height={height} ticks={ticks} lo={lo} hi={hi} fmt={fmt} xLabels={xLabelsFor(t0, t1, width, fmtT)}>
        <line x1={M.left} x2={width - M.right} y1={y(lo)} y2={y(lo)} className="chart__axis" />
        {pts.map((p, i) => <circle key={i} cx={p.px} cy={p.py} r={hover === i ? 6 : 4} className={`chart__dot ${hover === i ? 'is-hover' : ''}`} />)}
      </Frame>
      {hover !== null && pts[hover] && <Tip x={pts[hover].px} y={pts[hover].py} width={width}>{tip(data[hover])}</Tip>}
    </div>
  );
}

/** Horizontal bars with the value at the tip (e.g. holder distribution). */
export function HBars({ rows, fmt }: { rows: { label: string; v: number }[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbars__row" key={r.label}>
          <span className="hbars__label">{r.label}</span>
          <span className="hbars__track">
            <span className="hbars__bar" style={{ width: `${(r.v / max) * 100}%` }} />
            <span className="hbars__value mono-num">{fmt(r.v)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Card with title, optional controls, and a Chart / Table toggle so every value is reachable without hovering. */
export function ChartCard({ title, sub, table, children, empty, emptyText, tableLabel, chartLabel }: {
  title: string; sub?: ReactNode; table?: { head: string[]; rows: ReactNode[][] }; children: ReactNode; empty?: boolean; emptyText?: string;
  tableLabel: string; chartLabel: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="chart-card">
      <header className="chart-card__head">
        <div>
          <h3 className="h3">{title}</h3>
          {sub && <div className="small muted">{sub}</div>}
        </div>
        {table && !empty && (
          <div className="segmented segmented--xs">
            <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>{chartLabel}</button>
            <button aria-pressed={view === 'table'} onClick={() => setView('table')}>{tableLabel}</button>
          </div>
        )}
      </header>
      {empty ? (
        <div className="chart-card__empty small muted">{emptyText}</div>
      ) : view === 'chart' || !table ? (
        children
      ) : (
        <div className="table-wrap chart-card__table">
          <table className="table">
            <thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'mono-num' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
