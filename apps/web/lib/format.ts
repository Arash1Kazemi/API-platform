/** $1.50, $0.06, $0.0075: at least two decimals, more only when the price needs them. */
export function money(p: number): string {
  if (p >= 1) return '$' + p.toFixed(2);
  const [whole, frac = ''] = p.toFixed(4).replace(/0+$/, '').split('.');
  return `$${whole}.${frac.padEnd(2, '0')}`;
}

export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function daysSince(iso: string | null): number {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : Infinity;
}
