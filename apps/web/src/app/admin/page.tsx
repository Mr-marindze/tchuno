'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { getAdminOpsOverview } from '@/lib/admin-ops';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getAdminPaymentsOverview } from '@/lib/payments';

type AdminKpis = {
  openRequestsProxy: number;
  runningJobs: number;
  pendingPayments: number;
  pendingRefunds: number;
  pendingPayouts: number;
};

export default function AdminOverviewPage() {
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar visão admin...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar visão admin...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setKpis(null);
          }
          return;
        }

        const [opsOverview, paymentsOverview] = await Promise.all([
          getAdminOpsOverview(session.auth.accessToken),
          getAdminPaymentsOverview(session.auth.accessToken),
        ]);

        if (!active) {
          return;
        }

        setKpis({
          openRequestsProxy: opsOverview.kpis.jobsByStatus.REQUESTED,
          runningJobs: opsOverview.kpis.jobsByStatus.IN_PROGRESS,
          pendingPayments: paymentsOverview.kpis.intentsAwaitingPayment,
          pendingRefunds: paymentsOverview.kpis.pendingRefunds,
          pendingPayouts: paymentsOverview.kpis.pendingPayouts,
        });
        setStatus('Overview operacional atualizada.');
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar overview.'));
          setKpis(null);
        }
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
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Overview</h1>
        <p className='mt-1 text-sm text-slate-600'>
          Visão operacional rápida para pedidos, execução e financeiro.
        </p>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>

        <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          <KpiCard
            label='Pedidos abertos'
            value={kpis?.openRequestsProxy ?? 0}
            tone='blue'
          />
          <KpiCard
            label='Jobs em execução'
            value={kpis?.runningJobs ?? 0}
            tone='emerald'
          />
          <KpiCard
            label='Pagamentos pendentes'
            value={kpis?.pendingPayments ?? 0}
            tone='orange'
          />
          <KpiCard
            label='Refunds pendentes'
            value={kpis?.pendingRefunds ?? 0}
            tone='rose'
          />
          <KpiCard
            label='Payouts pendentes'
            value={kpis?.pendingPayouts ?? 0}
            tone='amber'
          />
        </div>
      </section>

      <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Link
          href='/admin/payments'
          className='rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300'
        >
          Pagamentos
        </Link>
        <Link
          href='/admin/users'
          className='rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300'
        >
          Utilizadores
        </Link>
        <Link
          href='/admin/moderation'
          className='rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300'
        >
          Trust & Safety
        </Link>
        <Link
          href='/admin/audit'
          className='rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300'
        >
          Auditoria
        </Link>
        <Link
          href='/admin/payments'
          className='rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm hover:border-blue-300'
        >
          Reconciliação
        </Link>
      </section>
    </main>
  );
}

function KpiCard(input: {
  label: string;
  value: number;
  tone: 'blue' | 'emerald' | 'orange' | 'rose' | 'amber';
}) {
  const toneClass = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  }[input.tone];

  return (
    <article className={`rounded-xl border p-3 ${toneClass}`}>
      <p className='text-xs font-medium uppercase tracking-wide'>{input.label}</p>
      <p className='mt-1 text-lg font-semibold'>{input.value}</p>
    </article>
  );
}
