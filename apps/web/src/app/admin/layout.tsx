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
        { href: '/admin', label: 'Overview' },
        { href: '/admin/payments', label: 'Pagamentos' },
        { href: '/admin/moderation', label: 'Trust & Safety' },
        { href: '/admin/users', label: 'Utilizadores' },
        { href: '/admin/support', label: 'Suporte' },
        { href: '/admin/audit', label: 'Auditoria' },
      ]}
    >
      {children}
    </RoleNavShell>
  );
}
