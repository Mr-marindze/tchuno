import { ReactNode } from 'react';
import { RoleNavShell } from '@/components/navigation/role-nav-shell';

export default function ProviderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleNavShell
      requiredAccess='provider'
      title='Tchuno Prestador'
      items={[
        { href: '/pro/pedidos', label: 'Pedidos' },
        { href: '/pro/propostas', label: 'Propostas' },
        { href: '/pro/mensagens', label: 'Mensagens' },
        { href: '/pro/ganhos', label: 'Ganhos' },
        { href: '/pro/perfil', label: 'Perfil' },
      ]}
    >
      {children}
    </RoleNavShell>
  );
}
