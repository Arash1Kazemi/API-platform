'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' || p.startsWith('/c/') },
  { href: '/planner', label: 'Cost planner', match: (p: string) => p.startsWith('/planner') },
  { href: '/admin/models', label: 'Edit data', match: (p: string) => p.startsWith('/admin/models') },
  { href: '/admin/pricing', label: 'Refresh prices', match: (p: string) => p.startsWith('/admin/pricing') },
  { href: '/admin/keys', label: 'API keys', match: (p: string) => p.startsWith('/admin/keys') },
];

/** Page frame with the top navigation. Wrap every logged-in page in it. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">API Platform</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={l.match(path) ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
        <span className="spacer" />
        <button onClick={logout}>Log out</button>
      </nav>
      {children}
    </div>
  );
}
