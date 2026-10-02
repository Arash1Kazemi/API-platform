'use client';
import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { api, useApi } from '@/lib/api';
import { ago } from '@/lib/format';
import type { ApiKeyRow } from '@/lib/types';

export default function KeysPage() {
  const keys = useApi<ApiKeyRow[]>('/keys');
  const [name, setName] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ key: string }>('/keys', { method: 'POST', json: { name, canWrite } });
      setFresh(r.key);
      setName('');
      keys.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(k: ApiKeyRow) {
    if (!confirm(`Revoke "${k.name}"? Anything using it stops working.`)) return;
    await api(`/keys/${k.id}`, { method: 'DELETE' });
    keys.reload();
  }

  return (
    <Shell>
      <h1>API keys</h1>
      <p className="muted">Keys let your own scripts and apps read (or write) your data. Send one as the <span className="mono">x-api-key</span> header.</p>

      <form className="card row" onSubmit={create}>
        <input placeholder="Key name, e.g. my-app" value={name} onChange={(e) => setName(e.target.value)} required />
        <label style={{ margin: 0 }}><input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} /> can also change data</label>
        <button className="primary" disabled={!name.trim()}>Create key</button>
      </form>
      {error && <p className="error">{error}</p>}

      {fresh && (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>Copy this key now. It is shown only once.</strong>
          <pre>{fresh}</pre>
          <button onClick={() => setFresh(null)}>I copied it</button>
        </div>
      )}

      <div className="card table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Name</th><th>Starts with</th><th>Access</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {keys.data?.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="mono">{k.prefix}…</td>
                <td><span className={`badge ${k.canWrite ? 'warn' : ''}`}>{k.canWrite ? 'read + write' : 'read only'}</span></td>
                <td className="muted">{ago(k.lastUsedAt)}</td>
                <td><button className="danger" onClick={() => revoke(k)}>Revoke</button></td>
              </tr>
            ))}
            {keys.data?.length === 0 && <tr><td colSpan={5} className="muted">No keys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
