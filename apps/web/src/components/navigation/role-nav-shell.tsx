'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { RouteGuard } from '@/components/access/route-guard';

type RequiredAccess = 'authenticated' | 'customer' | 'provider' | 'admin';

type RoleNavItem = {
  href: string;
  label: string;
};

type RoleNavShellProps = {
  requiredAccess: RequiredAccess;
  title: string;
  items: RoleNavItem[];
  children: ReactNode;
};

export function RoleNavShell({
  requiredAccess,
  title,
  items,
  children,
}: RoleNavShellProps) {
  const pathname = usePathname();

  return (
    <RouteGuard requiredAccess={requiredAccess}>
      <div className='min-h-screen bg-slate-50'>
        <header className='sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur'>
          <div className='mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
            <p className='text-sm font-semibold uppercase tracking-wide text-slate-600'>
              {title}
            </p>
            <nav
              className='flex items-center gap-2 overflow-x-auto pb-1'
              aria-label={`Navegação ${title}`}
            >
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div className='mx-auto w-full max-w-6xl px-4 py-6 sm:px-6'>{children}</div>
      </div>
    </RouteGuard>
  );
}
