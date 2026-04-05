'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getProviderEarningsSummary, ProviderEarningsSummary } from '@/lib/payments';

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProviderEarningsPage() {
  const [summary, setSummary] = useState<ProviderEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar ganhos...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar ganhos...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setSummary(null);
          }
          return;
        }

        const response = await getProviderEarningsSummary(session.auth.accessToken);
        if (!active) {
          return;
        }

        setSummary(response);
        setStatus('Resumo financeiro atualizado.');
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar ganhos.'));
          setSummary(null);
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

  const recentEntries = useMemo(() => summary?.entries.slice(0, 20) ?? [], [summary]);

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Ganhos</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Saldo retido, saldo disponível e histórico financeiro dos jobs.
            </p>
          </div>
          <Link
            href='/pro/propostas'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Ver propostas
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <article className='rounded-xl border border-amber-200 bg-amber-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-amber-700'>
              Saldo retido
            </p>
            <p className='mt-1 text-lg font-semibold text-amber-700'>
              {formatCurrencyMzn(summary?.balances.held ?? 0)}
            </p>
          </article>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Saldo disponível
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {formatCurrencyMzn(summary?.balances.available ?? 0)}
            </p>
          </article>
          <article className='rounded-xl border border-emerald-200 bg-emerald-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-emerald-700'>
              Total pago
            </p>
            <p className='mt-1 text-lg font-semibold text-emerald-700'>
              {formatCurrencyMzn(summary?.balances.paidOut ?? 0)}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <h2 className='text-lg font-semibold text-slate-900'>Movimentos</h2>
        <p className='mt-1 text-sm text-slate-600'>
          Registos do ledger ligados aos teus pagamentos e libertações.
        </p>

        {recentEntries.length === 0 ? (
          <p className='mt-3 text-sm text-slate-500'>
            Ainda sem movimentos financeiros.
          </p>
        ) : (
          <div className='mt-3 space-y-3'>
            {recentEntries.map((entry) => (
              <article
                key={entry.id}
                className='rounded-xl border border-slate-200 bg-slate-50 p-3'
              >
                <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-1 text-sm text-slate-700'>
                    <p className='font-semibold text-slate-900'>{entry.entryType}</p>
                    <p>
                      <strong>Direção:</strong> {entry.direction}
                    </p>
                    <p>
                      <strong>Bucket:</strong> {entry.bucket}
                    </p>
                    <p className='text-xs text-slate-500'>
                      {new Date(entry.createdAt).toLocaleString('pt-PT')}
                    </p>
                  </div>
                  <p className='text-sm font-semibold text-slate-900'>
                    {formatCurrencyMzn(entry.amount)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
