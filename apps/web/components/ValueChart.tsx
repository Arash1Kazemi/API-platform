'use client';
import { useMemo } from 'react';
import { money } from '@/lib/format';
import type { Model } from '@/lib/types';

const W = 900;
const H = 500;
const M = { l: 62, r: 28, t: 16, b: 52 };

/** 1, 2, 5 x 10^k steps that fall inside [lo, hi]. */
function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v);
    }
  }
  return out;
}

interface Props {
  models: Model[];
  xTitle: string;
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

/**
 * Price (log scale, left = cheaper) against quality (up = better). Blue dots are on the best-value
 * line, grey dots are beaten by a cheaper-or-equal, better-or-equal model. Unscored models are not drawn.
 */
export function ValueChart({ models, xTitle, hoverId, selectedId, onHover, onSelect }: Props) {
  const ranked = useMemo(() => models.filter((m) => m.elo !== null), [models]);

  const geo = useMemo(() => {
    if (ranked.length === 0) return null;
    const prices = ranked.map((m) => m.chartPrice);
    const elos = ranked.map((m) => m.elo!);
    const lo = Math.min(...prices) / 1.25;
    const hi = Math.max(...prices) * 1.25;
    const eMin = Math.floor((Math.min(...elos) - 15) / 25) * 25;
    const eMax = Math.ceil((Math.max(...elos) + 15) / 25) * 25;
    const x = (p: number) => M.l + ((Math.log(p) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (W - M.l - M.r);
    const y = (e: number) => M.t + (1 - (e - eMin) / (eMax - eMin)) * (H - M.t - M.b);
    const yTicks: number[] = [];
    const step = eMax - eMin > 400 ? 100 : 50;
    for (let e = Math.ceil(eMin / step) * step; e <= eMax; e += step) yTicks.push(e);
    return { lo, hi, x, y, xTicks: logTicks(lo, hi), yTicks };
  }, [ranked]);

  if (!geo) return <p className="muted">No models with a quality score in this category yet.</p>;
  const { x, y } = geo;

  const line = ranked.filter((m) => m.bestValue).sort((a, b) => a.chartPrice - b.chartPrice);

  // Label only the best-value dots, and skip a label that would land on one already placed.
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labels = line.flatMap((m) => {
    const w = m.name.length * 6.3;
    let lx = x(m.chartPrice) + 9;
    let anchor: 'start' | 'end' = 'start';
    // Not enough room on the right edge: write the label to the left of the dot instead.
    if (lx + w > W - 4) {
      lx = x(m.chartPrice) - 11;
      anchor = 'end';
    }
    const ly = y(m.elo!) + 4;
    const box = anchor === 'start' ? { x0: lx, x1: lx + w, y0: ly - 12, y1: ly + 3 } : { x0: lx - w, x1: lx, y0: ly - 12, y1: ly + 3 };
    if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) return [];
    placed.push(box);
    return [{ id: m.id, text: m.name, x: lx, y: ly, anchor }];
  });

  // Draw gray first so blue dots sit on top; the hovered or selected dot is drawn last.
  const order = [...ranked].sort(
    (a, b) => Number(!!a.bestValue) - Number(!!b.bestValue) || Number(a.id === selectedId) - Number(b.id === selectedId),
  );

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price versus quality chart" onMouseLeave={() => onHover(null)}>
      {geo.yTicks.map((e) => (
        <g key={e}>
          <line className="grid-line" x1={M.l} x2={W - M.r} y1={y(e)} y2={y(e)} />
          <text x={M.l - 8} y={y(e) + 4} textAnchor="end">{e}</text>
        </g>
      ))}
      {geo.xTicks.map((p) => (
        <g key={p}>
          <line className="grid-line" x1={x(p)} x2={x(p)} y1={M.t} y2={H - M.b} />
          <text x={x(p)} y={H - M.b + 18} textAnchor="middle">{money(p)}</text>
        </g>
      ))}
      <line className="axis" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
      <line className="axis" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />
      <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle">{xTitle} (log scale, cheaper to the left)</text>
      <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">Quality score (higher is better, axis does not start at zero)</text>

      {line.length > 1 && <polyline className="line" points={line.map((m) => `${x(m.chartPrice)},${y(m.elo!)}`).join(' ')} />}

      {order.map((m) => (
        <circle
          key={m.id}
          className={`dot ${m.bestValue ? 'best' : 'beaten'} ${m.id === selectedId || m.id === hoverId ? 'sel' : ''}`}
          cx={x(m.chartPrice)}
          cy={y(m.elo!)}
          r={m.id === selectedId || m.id === hoverId ? 8 : 6}
          tabIndex={0}
          aria-label={`${m.name}, ${money(m.chartPrice)}, score ${m.elo}`}
          onMouseEnter={() => onHover(m.id)}
          onFocus={() => onHover(m.id)}
          onClick={() => onSelect(m.id === selectedId ? null : m.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(m.id === selectedId ? null : m.id)}
        />
      ))}
      {labels.map((l) => (
        <text key={l.id} className="lbl" x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>
      ))}
    </svg>
  );
}
