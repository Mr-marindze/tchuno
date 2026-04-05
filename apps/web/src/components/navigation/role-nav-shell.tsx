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
      <div className='shell'>
        <section className='card card--wide'>
          <header className='header'>
            <p className='kicker'>{title}</p>
          </header>
          <nav className='dashboard-nav' aria-label={`Navegação ${title}`}>
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? 'active' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </section>
      </div>
      {children}
    </RouteGuard>
  );
}
