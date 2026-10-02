'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' || p.startsWith('/c/') },
  { href: '/planner', label: 'Cost planner', match: (p: string) => p.startsWith('/planner') },
  { href: '/admin/models', label: 'Edit data', match: (p: string) => p.startsWith('/admin/models') },
  { href: '/admin/pricing', label: 'Refresh prices', match: (p: string) => p.startsWith('/admin/pricing') },
];

/** Page frame with the top navigation. Wrap every page in it. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">API Platform</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={l.match(path) ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
