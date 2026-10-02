'use client';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useApi } from '@/lib/api';
import { ago, daysSince, money } from '@/lib/format';
import type { Category, Model } from '@/lib/types';

export default function Overview() {
  const cats = useApi<Category[]>('/categories');
  const best = useApi<Model[]>('/models?bestValue=true');

  return (
    <Shell>
      <h1>Overview</h1>
      <p className="muted">Each card shows the best-value line: models that no other model beats on both price and quality.</p>
      {(cats.error || best.error) && <p className="error">{cats.error ?? best.error}</p>}
      <div className="grid">
        {cats.data?.map((c) => {
          const line = (best.data ?? [])
            .filter((m) => m.categoryId === c.id)
            .sort((a, b) => a.chartPrice - b.chartPrice);
          const stale = daysSince(c.oldestCheck) > 30;
          return (
            <div className="card stack" key={c.id}>
              <div>
                <h2>
                  <Link href={`/c/${c.id}`}>{c.name}</Link>
                </h2>
                <span className="muted small">
                  {c.modelCount} models, {c.rankedCount} with a quality score
                </span>
              </div>
              <div className="small">
                {line.map((m) => (
                  <div className="row" key={m.id} style={{ justifyContent: 'space-between' }}>
                    <span>{m.name}</span>
                    <span className="mono">
                      {m.approx ? '≈' : ''}
                      {money(m.chartPrice)} · {m.elo}
                    </span>
                  </div>
                ))}
                {line.length === 0 && <span className="muted">No scored models yet.</span>}
              </div>
              <span className={`badge ${stale ? 'warn' : ''}`}>
                prices checked {ago(c.oldestCheck)}
                {stale ? ' (old)' : ''}
              </span>
            </div>
          );
        })}
      </div>
      <h2 style={{ marginTop: 28 }}>Use it from your own code</h2>
      <p className="muted small">No key or login is needed. Call the same address as this website:</p>
      <pre>{`curl "https://YOUR-SERVER/api/models?category=t2i&bestValue=true"
curl "https://YOUR-SERVER/api/export?format=csv" -o models.csv`}</pre>
    </Shell>
  );
}
