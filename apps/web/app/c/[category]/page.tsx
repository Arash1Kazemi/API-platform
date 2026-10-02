'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ModelTable } from '@/components/ModelTable';
import { Shell } from '@/components/Shell';
import { ValueChart } from '@/components/ValueChart';
import { useApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { Category, Model } from '@/lib/types';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const cats = useApi<Category[]>('/categories');
  const models = useApi<Model[]>(`/models?category=${encodeURIComponent(category)}`);
  const [q, setQ] = useState('');
  const [bestOnly, setBestOnly] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cat = cats.data?.find((c) => c.id === category);
  const all = models.data ?? [];
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((m) => (!bestOnly || m.bestValue) && (!needle || `${m.name} ${m.maker}`.toLowerCase().includes(needle)));
  }, [all, q, bestOnly]);

  const focus = byId.get(hoverId ?? selectedId ?? '');

  return (
    <Shell>
      <div className="tabs">
        {cats.data?.map((c) => (
          <Link key={c.id} href={`/c/${c.id}`} className={c.id === category ? 'on' : ''}>
            {c.name}
          </Link>
        ))}
      </div>

      {(cats.error || models.error) && <p className="error">{cats.error ?? models.error}</p>}
      {cats.data && !cat && <p className="error">No such category.</p>}

      {cat && (
        <div className="stack">
          <div>
            <h1>{cat.name}</h1>
            <p className="muted small">
              Quality: {cat.board || 'no source set'}.{cat.anchor ? ` ${cat.anchor}.` : ''} Scores only compare inside this category.
            </p>
          </div>

          <div className="card">
            <ValueChart
              models={shown}
              xTitle={cat.chartUnit || cat.unit}
              hoverId={hoverId}
              selectedId={selectedId}
              onHover={setHoverId}
              onSelect={setSelectedId}
            />
            <div className="readout small">
              {focus ? (
                <>
                  <strong>{focus.name}</strong> <span className="muted">by {focus.maker}</span>
                  <div>
                    {focus.approx ? '≈' : ''}
                    {money(focus.chartPrice)} · score {focus.elo ?? 'n/a'}
                    {focus.ci ? ` ±${focus.ci}` : ''} ·{' '}
                    {focus.bestValue ? 'on the best-value line' : focus.beatenBy ? `beaten by ${nameOf(focus.beatenBy)}` : 'not ranked'}
                  </div>
                  <div className="muted">{focus.note}</div>
                </>
              ) : (
                <span className="muted">Hover or click a dot. Blue = best value, grey = another model is cheaper and at least as good.</span>
              )}
            </div>
            {cat.footnote && <p className="muted small">{cat.footnote}</p>}
          </div>

          <div className="row">
            <input placeholder="Search model or maker" value={q} onChange={(e) => setQ(e.target.value)} />
            <label style={{ margin: 0 }}>
              <input type="checkbox" checked={bestOnly} onChange={(e) => setBestOnly(e.target.checked)} /> best value only
            </label>
            <span className="muted small">{shown.length} of {all.length}</span>
            <span style={{ flex: 1 }} />
            <a className="btn" href={`/api/export?format=csv&category=${cat.id}`}>Download CSV</a>
            <a className="btn" href={`/api/export?format=json&category=${cat.id}`}>Download JSON</a>
          </div>

          <div className="card">
            <ModelTable models={shown} nameOf={nameOf} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      )}
    </Shell>
  );
}
