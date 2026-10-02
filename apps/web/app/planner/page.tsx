'use client';
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/Shell';
import { api, useApi } from '@/lib/api';
import { money } from '@/lib/format';
import type { Category, Model, Plan, PlanLine } from '@/lib/types';

const perWhat = (unit: string) => unit.replace(/^USD per /, '');

export default function Planner() {
  const cats = useApi<Category[]>('/categories');
  const models = useApi<Model[]>('/models');
  const plans = useApi<Plan[]>('/plans');

  const [planId, setPlanId] = useState<string | null>(null);
  const [name, setName] = useState('My app');
  const [budget, setBudget] = useState(50);
  const [lines, setLines] = useState<PlanLine[]>([]);
  const [msg, setMsg] = useState('');

  const byId = useMemo(() => new Map((models.data ?? []).map((m) => [m.id, m])), [models.data]);
  const catOf = (m: Model) => cats.data?.find((c) => c.id === m.categoryId);

  // Start with one empty line once the models have loaded.
  useEffect(() => {
    if (models.data?.length && lines.length === 0 && !planId) setLines([{ modelId: models.data[0].id, perMonth: 1000 }]);
  }, [models.data, lines.length, planId]);

  const costs = lines.map((l) => (byId.get(l.modelId)?.price ?? 0) * l.perMonth);
  const total = costs.reduce((a, b) => a + b, 0);
  const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;

  const setLine = (i: number, patch: Partial<PlanLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function load(id: string) {
    const p = plans.data?.find((x) => x.id === id);
    if (!p) return;
    setPlanId(p.id);
    setName(p.name);
    setBudget(p.budget);
    setLines(p.lines);
    setMsg('');
  }

  async function save() {
    const id = planId ?? crypto.randomUUID();
    try {
      await api(`/plans/${id}`, { method: 'PUT', json: { name, budget, lines } });
      setPlanId(id);
      setMsg('Saved.');
      plans.reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function remove() {
    if (!planId || !confirm(`Delete plan "${name}"?`)) return;
    await api(`/plans/${planId}`, { method: 'DELETE' });
    setPlanId(null);
    setMsg('Deleted.');
    plans.reload();
  }

  return (
    <Shell>
      <h1>Cost planner</h1>
      <p className="muted">Pick the models your app would use and how much of each per month. Prices use each model&apos;s default setting.</p>
      {(models.error || cats.error) && <p className="error">{models.error ?? cats.error}</p>}

      <div className="card stack">
        <div className="row">
          <select value={planId ?? ''} onChange={(e) => (e.target.value ? load(e.target.value) : (setPlanId(null), setLines([]), setName('My app')))}>
            <option value="">New plan</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" />
          <label style={{ margin: 0 }}>
            Monthly budget $ <input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ width: 100 }} />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Model</th><th className="num">Amount per month</th><th className="num">Price each</th><th className="num">Cost per month</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const m = byId.get(l.modelId);
                const c = m && catOf(m);
                return (
                  <tr key={i}>
                    <td>
                      <select value={l.modelId} onChange={(e) => setLine(i, { modelId: e.target.value })}>
                        {cats.data?.map((cat) => (
                          <optgroup key={cat.id} label={cat.name}>
                            {models.data?.filter((x) => x.categoryId === cat.id).map((x) => (
                              <option key={x.id} value={x.id}>{x.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input type="number" min={0} value={l.perMonth} onChange={(e) => setLine(i, { perMonth: Number(e.target.value) })} style={{ width: 110 }} />
                      <div className="muted small">{c ? perWhat(c.unit) : ''}</div>
                    </td>
                    <td className="num">{m ? `${m.approx ? '≈' : ''}${money(m.price)}` : '-'}</td>
                    <td className="num">{money(costs[i])}</td>
                    <td><button className="danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="row">
          <button onClick={() => models.data?.length && setLines((ls) => [...ls, { modelId: models.data![0].id, perMonth: 1000 }])}>Add a line</button>
          <button className="primary" onClick={save}>Save plan</button>
          {planId && <button className="danger" onClick={remove}>Delete plan</button>}
          <span className="muted small">{msg}</span>
        </div>

        <div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Total per month: {money(total)}</strong>
            <span className={total > budget ? 'error' : 'ok'}>
              {budget > 0 ? (total > budget ? `${money(total - budget)} over budget` : `${money(budget - total)} left in budget`) : ''}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, marginTop: 6 }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: total > budget ? 'var(--bad)' : 'var(--accent)' }} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
