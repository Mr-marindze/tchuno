'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getProviderEarningsSummary, ProviderEarningsSummary } from '@/lib/payments';

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
        setStatus('Resumo financeiro atualizado com sucesso.');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar ganhos.'));
        setSummary(null);
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

  const lastEntries = useMemo(() => summary?.entries.slice(0, 10) ?? [], [summary]);

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <RouteGuard requiredAccess='provider'>
      <main className='shell'>
        <section className='card'>
          <header className='header'>
            <p className='kicker'>Financeiro</p>
            <h1>Ganhos</h1>
            <p className='subtitle'>
              Controla saldos retidos, disponíveis para payout e histórico de
              movimentos financeiros ligados aos teus serviços.
            </p>
          </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='item-label'>Saldo retido</p>
              <p className='item-title'>
                {formatCurrencyMzn(summary?.balances.held ?? 0)}
              </p>
            </article>
            <article className='flow-summary-item'>
              <p className='item-label'>Saldo disponível</p>
              <p className='item-title'>
                {formatCurrencyMzn(summary?.balances.available ?? 0)}
              </p>
            </article>
            <article className='flow-summary-item'>
              <p className='item-label'>Total pago</p>
              <p className='item-title'>
                {formatCurrencyMzn(summary?.balances.paidOut ?? 0)}
              </p>
            </article>
          </div>

          <p className='status'>{status}</p>

          {loading ? null : lastEntries.length === 0 ? (
            <p className='muted'>Sem movimentos financeiros registados ainda.</p>
          ) : (
            <div className='list'>
              {lastEntries.map((entry) => (
                <article key={entry.id} className='list-item'>
                  <p className='item-title'>
                    {entry.entryType}
                    <span className='badge badge--neutral'>{entry.bucket}</span>
                  </p>
                  <p>
                    <strong>Direção:</strong> {entry.direction}
                  </p>
                  <p>
                    <strong>Valor:</strong> {formatCurrencyMzn(entry.amount)}
                  </p>
                  <p>
                    <strong>Data:</strong>{' '}
                    {new Date(entry.createdAt).toLocaleString('pt-PT')}
                  </p>
                </article>
              ))}
            </div>
          )}

          <div className='actions actions--inline'>
            <Link href='/pro/pedidos' className='primary'>
              Ver pedidos
            </Link>
            <Link href='/pro/dashboard' className='primary primary--ghost'>
              Voltar ao painel
            </Link>
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
