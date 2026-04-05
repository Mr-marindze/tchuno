import { ReactNode } from 'react';
import { RoleNavShell } from '@/components/navigation/role-nav-shell';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleNavShell
      requiredAccess='admin'
      title='Tchuno Admin'
      items={[
        { href: '/admin', label: 'Painel' },
        { href: '/admin/payments', label: 'Payments' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/audit', label: 'Audit' },
      ]}
    >
      {children}
    </RoleNavShell>
  );
}
