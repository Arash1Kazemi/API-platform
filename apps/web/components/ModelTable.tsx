'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';
import type { Model } from '@/lib/types';

type SortKey = 'name' | 'maker' | 'chartPrice' | 'elo';

interface Props {
  models: Model[];
  nameOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ModelTable({ models, nameOf, selectedId, onSelect }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'chartPrice', dir: 1 });
  const [copied, setCopied] = useState<string | null>(null);

  const rows = useMemo(() => {
    const { key, dir } = sort;
    return [...models].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // Models without a score always go last, whichever way the column is sorted.
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * dir;
    });
  }, [models, sort]);

  const head = (key: SortKey, label: string, num = false) => (
    <th
      className={`sort ${num ? 'num' : ''}`}
      aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'elo' ? -1 : 1 }))}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
    } catch {
      /* clipboard can be blocked on plain http; the endpoint is also shown as text */
    }
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head('name', 'Model')}
            {head('maker', 'Maker')}
            {head('chartPrice', 'Price', true)}
            {head('elo', 'Score', true)}
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <Row key={m.id} m={m} open={m.id === selectedId} onToggle={() => onSelect(m.id === selectedId ? null : m.id)} nameOf={nameOf} copied={copied === m.endpoint} copy={() => copy(m.endpoint)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ m, open, onToggle, nameOf, copied, copy }: { m: Model; open: boolean; onToggle: () => void; nameOf: (id: string) => string; copied: boolean; copy: () => void }) {
  return (
    <>
      <tr className={open ? 'pick' : ''} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td>{m.name}</td>
        <td className="muted">{m.maker}</td>
        <td className="num">
          {m.approx ? '≈' : ''}
          {money(m.chartPrice)}
        </td>
        <td className="num">
          {m.elo ?? <span className="muted">n/a</span>}
          {m.ci ? <span className="muted small"> ±{m.ci}</span> : null}
        </td>
        <td>
          {m.bestValue === true && <span className="badge good">best value</span>}
          {m.bestValue === false && <span className="muted small">beaten by {m.beatenBy ? nameOf(m.beatenBy) : '?'}</span>}
          {m.bestValue === null && <span className="muted small">not ranked</span>}
        </td>
      </tr>
      {open && (
        <tr className="pick">
          <td colSpan={5}>
            <p>{m.note || <span className="muted">No note.</span>}</p>
            <p className="small muted">
              Price shown: {m.basis || 'default'}. {m.approx ? 'This price is an estimate. ' : ''}
              {m.tiers.length > 1 && <>All prices: {m.tiers.map((t) => `${t.label} ${money(t.price)}`).join(' · ')}. </>}
            </p>
            <div className="row small" onClick={(e) => e.stopPropagation()}>
              <span className="mono">{m.endpoint}</span>
              <button onClick={copy}>{copied ? 'Copied' : 'Copy endpoint'}</button>
              <Link href={`/admin/models?edit=${m.id}`} className="btn">Edit</Link>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
