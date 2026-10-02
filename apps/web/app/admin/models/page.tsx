'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/Shell';
import { api, useApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { Category, Model } from '@/lib/types';

interface Draft {
  isNew: boolean;
  id: string;
  categoryId: string;
  provider: string;
  name: string;
  maker: string;
  endpoint: string;
  basis: string;
  approx: boolean;
  elo: string;
  ci: string;
  note: string;
  price: string; // only used while there are no tiers
  tiers: { label: string; price: string }[];
  priceIdx: number; // which tier is the chart price
}

const blank = (categoryId: string): Draft => ({
  isNew: true, id: '', categoryId, provider: 'fal', name: '', maker: '', endpoint: '', basis: '', approx: false,
  elo: '', ci: '', note: '', price: '', tiers: [], priceIdx: 0,
});

const toDraft = (m: Model): Draft => ({
  isNew: false, id: m.id, categoryId: m.categoryId, provider: m.provider, name: m.name, maker: m.maker, endpoint: m.endpoint,
  basis: m.basis, approx: m.approx, elo: m.elo?.toString() ?? '', ci: m.ci?.toString() ?? '', note: m.note, price: String(m.price),
  tiers: m.tiers.map((t) => ({ label: t.label, price: String(t.price) })),
  priceIdx: Math.max(0, m.tiers.findIndex((t) => t.price === m.price)),
});

const intOrNull = (s: string) => (s.trim() === '' ? null : Math.round(Number(s)));

export default function Page() {
  return (
    <Suspense>
      <ModelsAdmin />
    </Suspense>
  );
}

function ModelsAdmin() {
  const search = useSearchParams();
  const cats = useApi<Category[]>('/categories');
  const models = useApi<Model[]>('/models');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCats, setShowCats] = useState(false);

  // Open the model named in ?edit=... once the data is there.
  const wanted = search.get('edit');
  useEffect(() => {
    const m = wanted && models.data?.find((x) => x.id === wanted);
    if (m) setDraft(toDraft(m));
  }, [wanted, models.data]);

  const shown = useMemo(() => {
    const n = filter.trim().toLowerCase();
    return (models.data ?? []).filter((m) => !n || `${m.name} ${m.maker} ${m.id}`.toLowerCase().includes(n));
  }, [models.data, filter]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save() {
    if (!draft) return;
    const tiers = draft.tiers.map((t) => ({ label: t.label, price: Number(t.price) }));
    const price = tiers.length ? tiers[draft.priceIdx]?.price : Number(draft.price);
    const body = {
      categoryId: draft.categoryId, provider: draft.provider, name: draft.name, maker: draft.maker, endpoint: draft.endpoint,
      price, basis: draft.basis, approx: draft.approx, elo: intOrNull(draft.elo), ci: intOrNull(draft.ci), note: draft.note,
      tiers: tiers.length ? tiers : undefined,
    };
    try {
      if (draft.isNew) await api('/models', { method: 'POST', json: { id: draft.id, ...body } });
      else await api(`/models/${draft.id}`, { method: 'PATCH', json: body });
      setMsg({ ok: true, text: 'Saved.' });
      await models.reload();
      cats.reload();
      if (draft.isNew) setDraft({ ...draft, isNew: false });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function remove() {
    if (!draft || draft.isNew || !confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    await api(`/models/${draft.id}`, { method: 'DELETE' });
    setDraft(null);
    setMsg({ ok: true, text: 'Deleted.' });
    models.reload();
    cats.reload();
  }

  return (
    <Shell>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Edit data</h1>
        <button onClick={() => setShowCats((s) => !s)}>{showCats ? 'Back to models' : 'Edit categories'}</button>
      </div>
      {(models.error || cats.error) && <p className="error">{models.error ?? cats.error}</p>}

      {showCats ? (
        <CategoryAdmin cats={cats.data ?? []} reload={cats.reload} />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 340px) 1fr', alignItems: 'start' }}>
          <div className="card stack">
            <div className="row">
              <input placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
              <button className="primary" disabled={!cats.data?.length} onClick={() => (setDraft(blank(cats.data![0].id)), setMsg(null))}>New</button>
            </div>
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {cats.data?.map((c) => {
                const list = shown.filter((m) => m.categoryId === c.id);
                if (!list.length) return null;
                return (
                  <div key={c.id}>
                    <div className="muted small" style={{ margin: '8px 0 2px' }}>{c.name}</div>
                    {list.map((m) => (
                      <div key={m.id} onClick={() => (setDraft(toDraft(m)), setMsg(null))} className={draft?.id === m.id ? 'pick' : ''} style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 6 }}>
                        {m.name} <span className="muted small">{money(m.price)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            {!draft ? (
              <p className="muted">Pick a model on the left, or press New.</p>
            ) : (
              <div className="stack">
                <h2>{draft.isNew ? 'New model' : draft.name}</h2>
                <div className="fields">
                  <div className="field"><label>Id (short, no spaces)</label><input value={draft.id} disabled={!draft.isNew} onChange={(e) => set('id', e.target.value)} /></div>
                  <div className="field"><label>Category</label>
                    <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                      {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Name</label><input value={draft.name} onChange={(e) => set('name', e.target.value)} /></div>
                  <div className="field"><label>Maker</label><input value={draft.maker} onChange={(e) => set('maker', e.target.value)} /></div>
                  <div className="field"><label>Provider</label><input value={draft.provider} onChange={(e) => set('provider', e.target.value)} /></div>
                  <div className="field"><label>Endpoint id</label><input value={draft.endpoint} onChange={(e) => set('endpoint', e.target.value)} /></div>
                  <div className="field"><label>Quality score (blank = not ranked)</label><input type="number" value={draft.elo} onChange={(e) => set('elo', e.target.value)} /></div>
                  <div className="field"><label>Score ± interval (optional)</label><input type="number" value={draft.ci} onChange={(e) => set('ci', e.target.value)} /></div>
                  <div className="field"><label>Which setting is the price? (words)</label><input value={draft.basis} onChange={(e) => set('basis', e.target.value)} /></div>
                </div>
                <label style={{ margin: 0 }}><input type="checkbox" checked={draft.approx} onChange={(e) => set('approx', e.target.checked)} /> price is an estimate</label>

                <div>
                  <label>Prices ({draft.tiers.length ? 'choose the one drawn on the chart' : 'single price'})</label>
                  {draft.tiers.length === 0 && (
                    <input type="number" step="any" placeholder="Price in USD" value={draft.price} onChange={(e) => set('price', e.target.value)} />
                  )}
                  {draft.tiers.map((t, i) => (
                    <div className="row" key={i} style={{ marginBottom: 6 }}>
                      <input type="radio" name="chartTier" checked={draft.priceIdx === i} onChange={() => set('priceIdx', i)} aria-label="Use for chart" />
                      <input placeholder="Label, e.g. 1K" value={t.label} onChange={(e) => set('tiers', draft.tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <input type="number" step="any" placeholder="USD" value={t.price} onChange={(e) => set('tiers', draft.tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} style={{ width: 120 }} />
                      <button className="danger" onClick={() => (set('tiers', draft.tiers.filter((_, j) => j !== i)), set('priceIdx', 0))}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => set('tiers', [...draft.tiers, { label: '', price: draft.price || '' }])}>Add price tier</button>
                </div>

                <div className="field"><label>Note</label><textarea value={draft.note} onChange={(e) => set('note', e.target.value)} /></div>
                <div className="row">
                  <button className="primary" onClick={save}>Save</button>
                  {!draft.isNew && <button className="danger" onClick={remove}>Delete</button>}
                  {msg && <span className={msg.ok ? 'ok' : 'error'}>{msg.text}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

interface CatDraft {
  isNew: boolean; id: string; name: string; unit: string; chartFactor: string; chartUnit: string; board: string; anchor: string; footnote: string;
}
const blankCat: CatDraft = { isNew: true, id: '', name: '', unit: 'USD per call', chartFactor: '1', chartUnit: '', board: '', anchor: '', footnote: '' };

function CategoryAdmin({ cats, reload }: { cats: Category[]; reload: () => void }) {
  const [d, setD] = useState<CatDraft>(blankCat);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof CatDraft, v: string) => setD((x) => ({ ...x, [k]: v }));

  async function save() {
    const { isNew, id, chartFactor, ...rest } = d;
    const body = { ...rest, chartFactor: Number(chartFactor) };
    try {
      if (isNew) await api('/categories', { method: 'POST', json: { id, ...body } });
      else await api(`/categories/${id}`, { method: 'PATCH', json: body });
      setMsg({ ok: true, text: 'Saved.' });
      setD((x) => ({ ...x, isNew: false }));
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}" and its ${c.modelCount} models? This cannot be undone.`)) return;
    await api(`/categories/${c.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 340px) 1fr', alignItems: 'start' }}>
      <div className="card stack">
        <button className="primary" onClick={() => (setD(blankCat), setMsg(null))}>New category</button>
        {cats.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
            <a href="#" onClick={(e) => (e.preventDefault(), setMsg(null), setD({ isNew: false, id: c.id, name: c.name, unit: c.unit, chartFactor: String(c.chartFactor), chartUnit: c.chartUnit, board: c.board, anchor: c.anchor, footnote: c.footnote }))}>
              {c.name} <span className="muted small">({c.modelCount})</span>
            </a>
            <button className="danger" onClick={() => remove(c)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="card stack">
        <h2>{d.isNew ? 'New category' : d.name}</h2>
        <div className="fields">
          <div className="field"><label>Id (short, no spaces)</label><input value={d.id} disabled={!d.isNew} onChange={(e) => set('id', e.target.value)} /></div>
          <div className="field"><label>Name</label><input value={d.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="field"><label>Price is… (unit)</label><input value={d.unit} onChange={(e) => set('unit', e.target.value)} /></div>
          <div className="field"><label>Chart multiplier (60 turns per second into per minute)</label><input type="number" step="any" value={d.chartFactor} onChange={(e) => set('chartFactor', e.target.value)} /></div>
          <div className="field"><label>Chart axis title</label><input value={d.chartUnit} onChange={(e) => set('chartUnit', e.target.value)} /></div>
          <div className="field"><label>Where quality scores come from</label><input value={d.board} onChange={(e) => set('board', e.target.value)} /></div>
          <div className="field"><label>Score anchor (optional)</label><input value={d.anchor} onChange={(e) => set('anchor', e.target.value)} /></div>
        </div>
        <div className="field"><label>Footnote shown under the chart</label><textarea value={d.footnote} onChange={(e) => set('footnote', e.target.value)} /></div>
        <div className="row">
          <button className="primary" onClick={save} disabled={!d.id || !d.name}>Save</button>
          {msg && <span className={msg.ok ? 'ok' : 'error'}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}
