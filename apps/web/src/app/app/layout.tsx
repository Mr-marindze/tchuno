import { ReactNode } from 'react';
import { RoleNavShell } from '@/components/navigation/role-nav-shell';

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleNavShell
      requiredAccess='customer'
      title='Tchuno Cliente'
      items={[
        { href: '/app/pedidos', label: 'Pedidos' },
        { href: '/app/pagamentos', label: 'Pagamentos' },
        { href: '/app/perfil', label: 'Perfil' },
      ]}
    >
      {children}
    </RoleNavShell>
  );
}
