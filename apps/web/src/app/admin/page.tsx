'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getAdminPaymentsOverview } from '@/lib/payments';

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar painel admin...');
  const [kpis, setKpis] = useState<{
    totalIntents: number;
    pendingPayouts: number;
    pendingRefunds: number;
    failedTransactions: number;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar painel admin...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setKpis(null);
          }
          return;
        }

        const overview = await getAdminPaymentsOverview(session.auth.accessToken);

        if (!active) {
          return;
        }

        setKpis({
          totalIntents: overview.kpis.totalIntents,
          pendingPayouts: overview.kpis.pendingPayouts,
          pendingRefunds: overview.kpis.pendingRefunds,
          failedTransactions: overview.kpis.failedTransactions,
        });
        setStatus('Painel admin atualizado com sucesso.');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar painel admin.'));
        setKpis(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Admin</p>
          <h1>Painel Operacional</h1>
          <p className='subtitle'>
            Entrada única para operação financeira, utilizadores e auditoria.
          </p>
        </header>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        <div className='flow-summary'>
          <article className='flow-summary-item'>
            <p className='item-label'>Payment intents</p>
            <p className='item-title'>{kpis?.totalIntents ?? 0}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Payouts pendentes</p>
            <p className='item-title'>{kpis?.pendingPayouts ?? 0}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Refunds pendentes</p>
            <p className='item-title'>{kpis?.pendingRefunds ?? 0}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Transações falhadas</p>
            <p className='item-title'>{kpis?.failedTransactions ?? 0}</p>
          </article>
        </div>

        <div className='actions actions--inline'>
          <Link href='/admin/payments' className='primary'>
            Abrir payments
          </Link>
          <Link href='/admin/users' className='primary primary--ghost'>
            Abrir users
          </Link>
          <Link href='/admin/audit' className='primary primary--ghost'>
            Abrir audit
          </Link>
        </div>
      </section>
    </main>
  );
}
