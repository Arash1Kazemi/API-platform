'use client';
import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

interface Row {
  id: string;
  name: string;
  endpoint: string;
  stored: number;
  live: number | null;
  unit: string | null;
  status: 'same' | 'changed' | 'applied' | 'review' | 'missing';
  reason?: string;
}
interface Result {
  checked: number;
  changed: number;
  applied: number;
  rows: Row[];
}

export default function PricingPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSame, setShowSame] = useState(false);

  async function run(apply: boolean) {
    if (apply && !confirm('Write the safe price changes into your database?')) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api<Result>(`/pricing/refresh-fal?apply=${apply}`, { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = result?.rows.filter((r) => showSame || r.status !== 'same') ?? [];

  return (
    <Shell>
      <h1>Refresh prices from fal</h1>
      <p className="muted">
        Asks fal for the live price of every fal model you track and compares it with what you stored. Needs <span className="mono">FAL_KEY</span> in the
        server&apos;s <span className="mono">.env</span>. Nothing is written until you press Apply, and Apply only changes models that have one price
        and a non-estimated price. The rest are marked &quot;review&quot;: check them by hand on the Edit data page.
      </p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => run(false)}>{busy ? 'Working…' : 'Check live prices'}</button>
        <button disabled={busy || !result || result.changed === 0} onClick={() => run(true)}>Apply safe changes</button>
        <label style={{ margin: 0 }}><input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} /> show unchanged</label>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="card" style={{ marginTop: 14 }}>
          <p>
            Checked {result.checked} models. {result.changed} differ{result.applied ? `, ${result.applied} updated` : ''}.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Model</th><th className="num">Stored</th><th className="num">fal now</th><th>Unit</th><th>Result</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}<div className="mono muted">{r.endpoint}</div></td>
                    <td className="num">{money(r.stored)}</td>
                    <td className="num">{r.live === null ? '-' : money(r.live)}</td>
                    <td className="muted small">{r.unit ?? ''}</td>
                    <td>
                      <span className={`badge ${r.status === 'applied' ? 'good' : r.status === 'same' ? '' : 'warn'}`}>{r.status}</span>
                      {r.reason && <div className="muted small">{r.reason}</div>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="muted">Everything matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
