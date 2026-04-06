'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useMemo, useState, useEffect } from 'react';
import {
  buildAuthRoute,
  getRoleHomePath,
  resolveAppRole,
  resolveAppRoleFromMe,
  saveAuthIntent,
} from '@/lib/access-control';
import { ensureSession } from '@/lib/auth';
import { getMyWorkerProfile } from '@/lib/worker-profile';

type RequiredAccess = 'authenticated' | 'customer' | 'provider' | 'admin';

type RouteGuardProps = {
  requiredAccess: RequiredAccess;
  children: ReactNode;
};

type GuardState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | {
      status: 'forbidden';
      title: string;
      message: string;
      fallbackPath?: string;
    };

const adminRoles = new Set(['admin', 'ops_admin', 'support_admin', 'super_admin']);

function GuardMessage({
  title,
  message,
  tone,
  action,
}: {
  title: string;
  message: string;
  tone: 'loading' | 'error';
  action?: ReactNode;
}) {
  return (
    <main className='shell'>
      <section className='card state-card'>
        <h1>{title}</h1>
        <p className={`status status--${tone}`}>{message}</p>
        {action}
      </section>
    </main>
  );
}

export function RouteGuard({ requiredAccess, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>({ status: 'loading' });

  const currentPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return pathname;
    }

    const query = window.location.search ?? '';
    return query.length > 0 ? `${pathname}${query}` : pathname;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function runGuard() {
      const session = await ensureSession();

      if (!active) {
        return;
      }

      if (!session) {
        saveAuthIntent({
          nextPath: currentPath,
          sourcePath: currentPath,
        });

        router.replace(
          buildAuthRoute({
            mode: 'login',
            nextPath: currentPath,
          }),
        );
        return;
      }

      if (requiredAccess === 'authenticated') {
        setState({ status: 'allowed' });
        return;
      }

      let role = resolveAppRoleFromMe(session.me);

      if (!role && session.auth.user.role === 'ADMIN') {
        role =
          session.auth.user.adminSubrole === 'SUPPORT_ADMIN'
            ? 'support_admin'
            : session.auth.user.adminSubrole === 'OPS_ADMIN'
              ? 'ops_admin'
              : session.auth.user.adminSubrole === 'SUPER_ADMIN'
                ? 'super_admin'
                : 'admin';
      }

      if (requiredAccess === 'admin') {
        if (role && adminRoles.has(role)) {
          setState({ status: 'allowed' });
          return;
        }

        setState({
          status: 'forbidden',
          title: '403 · Acesso restrito',
          message:
            'Esta área é exclusiva para administração. Usa uma conta com permissões de admin.',
          fallbackPath: role ? getRoleHomePath(role) : '/',
        });
        return;
      }

      if (requiredAccess === 'provider') {
        if (!role) {
          try {
            const workerProfile = await getMyWorkerProfile(session.auth.accessToken);
            if (!active) {
              return;
            }

            role = resolveAppRole({
              auth: session.auth,
              hasWorkerProfile: Boolean(workerProfile),
            });
          } catch {
        setState({
          status: 'forbidden',
          title: '403 · Área para prestadores',
          message:
            'Não foi possível validar o teu perfil profissional neste momento.',
          fallbackPath: '/app/pedidos',
        });
            return;
          }
        }

        if (role === 'provider') {
          setState({ status: 'allowed' });
          return;
        }

        setState({
          status: 'forbidden',
          title: '403 · Área para prestadores',
          message:
            'Esta parte do Tchuno é para profissionais com perfil ativo.',
          fallbackPath: getRoleHomePath(role),
        });
        return;
      }

      if (!role) {
        role = resolveAppRole({
          auth: session.auth,
          hasWorkerProfile: false,
        });
      }

      if (requiredAccess === 'customer') {
        if (role === 'customer') {
          setState({ status: 'allowed' });
          return;
        }

        setState({
          status: 'forbidden',
          title: '403 · Área para clientes',
          message:
            'Esta parte do Tchuno é para quem está a pedir um serviço. Para continuar, entra na tua área.',
          fallbackPath: getRoleHomePath(role),
        });
        return;
      }

      setState({ status: 'allowed' });
    }

    void runGuard();

    return () => {
      active = false;
    };
  }, [currentPath, requiredAccess, router]);

  if (state.status === 'loading') {
    return (
      <GuardMessage
        title='A validar permissões...'
        message='Estamos a confirmar o teu acesso.'
        tone='loading'
      />
    );
  }

  if (state.status === 'forbidden') {
    return (
      <GuardMessage
        title={state.title}
        message={state.message}
        tone='error'
        action={
          <p className='status'>
            <Link href={state.fallbackPath ?? '/'} className='nav-link'>
              Ir para a minha área
            </Link>
          </p>
        }
      />
    );
  }

  return <>{children}</>;
}
