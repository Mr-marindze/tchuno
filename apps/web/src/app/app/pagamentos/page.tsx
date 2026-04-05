'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { listMyCustomerPaymentIntents, PaymentIntent } from '@/lib/payments';

const paymentStatusLabel: Record<string, string> = {
  CREATED: 'Criado',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_PARTIAL: 'Sinal pago',
  PENDING_CONFIRMATION: 'Em confirmação',
  SUCCEEDED: 'Pago',
  FAILED: 'Falhado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
};

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveStatusBadgeClass(status: string): string {
  if (status === 'SUCCEEDED' || status === 'PAID_PARTIAL') {
    return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
  }

  if (status === 'AWAITING_PAYMENT' || status === 'PENDING_CONFIRMATION') {
    return 'bg-orange-100 text-orange-700 ring-orange-200';
  }

  if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELED') {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }

  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

export default function CustomerPaymentsPage() {
  const [items, setItems] = useState<PaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar pagamentos...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar pagamentos...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setItems([]);
          }
          return;
        }

        const response = await listMyCustomerPaymentIntents(
          session.auth.accessToken,
          {
            page: 1,
            limit: 30,
          },
        );

        if (!active) {
          return;
        }

        setItems(response.data);
        setStatus(
          response.data.length > 0
            ? `Encontrados ${response.data.length} pagamento(s).`
            : 'Ainda não tens pagamentos registados.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar pagamentos.'));
          setItems([]);
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

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status === 'SUCCEEDED' || item.status === 'PAID_PARTIAL') {
          acc.totalPaid += item.amount;
        }

        if (['CREATED', 'AWAITING_PAYMENT', 'PENDING_CONFIRMATION'].includes(item.status)) {
          acc.pending += 1;
        }

        return acc;
      },
      {
        totalPaid: 0,
        pending: 0,
      },
    );
  }, [items]);

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Pagamentos</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Histórico financeiro dos teus pedidos com estado de cada intent.
            </p>
          </div>
          <Link
            href='/app/pedidos'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Ver pedidos
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Total pago
            </p>
            <p className='mt-1 text-lg font-semibold text-slate-900'>
              {formatCurrencyMzn(summary.totalPaid)}
            </p>
          </article>
          <article className='rounded-xl border border-orange-200 bg-orange-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-orange-700'>
              Pendentes
            </p>
            <p className='mt-1 text-lg font-semibold text-orange-700'>
              {summary.pending}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      {items.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Sem pagamentos para mostrar neste momento.
        </section>
      ) : (
        <section className='space-y-3'>
          {items.map((item) => (
            <article
              key={item.id}
              className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <p className='font-semibold text-slate-900'>
                    Intent #{item.id.slice(0, 8)}
                  </p>
                  <p>
                    <strong>Job:</strong> {item.jobId.slice(0, 10)}
                  </p>
                  <p>
                    <strong>Valor:</strong> {formatCurrencyMzn(item.amount)}
                  </p>
                  <p>
                    <strong>Data:</strong>{' '}
                    {new Date(item.createdAt).toLocaleString('pt-PT')}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${resolveStatusBadgeClass(item.status)}`}
                >
                  {paymentStatusLabel[item.status] ?? item.status}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
