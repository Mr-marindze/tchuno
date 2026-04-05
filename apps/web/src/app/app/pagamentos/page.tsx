'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { listMyCustomerPaymentIntents, PaymentIntent } from '@/lib/payments';

const statusLabel: Record<string, string> = {
  CREATED: 'Criado',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_PARTIAL: 'Sinal pago',
  PENDING_CONFIRMATION: 'Em confirmação',
  SUCCEEDED: 'Pago',
  FAILED: 'Falhado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
};

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
            limit: 20,
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
        if (!active) {
          return;
        }

        setStatus(
          humanizeUnknownError(error, 'Falha ao carregar pagamentos.'),
        );
        setItems([]);
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

  const totalPaid = useMemo(
    () =>
      items
        .filter((item) => item.status === 'SUCCEEDED')
        .reduce((acc, item) => acc + item.amount, 0),
    [items],
  );

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <RouteGuard requiredAccess='customer'>
      <main className='shell'>
        <section className='card'>
          <header className='header'>
            <p className='kicker'>Financeiro</p>
            <h1>Pagamentos</h1>
            <p className='subtitle'>
              Acompanha o estado financeiro dos teus pedidos e os valores
              registados pela plataforma.
            </p>
          </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='item-label'>Pagamentos listados</p>
              <p className='item-title'>{items.length}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='item-label'>Total pago</p>
              <p className='item-title'>{formatCurrencyMzn(totalPaid)}</p>
            </article>
          </div>

          <p className='status'>{status}</p>

          {loading ? null : items.length === 0 ? (
            <p className='muted'>Nenhum pagamento ainda nesta conta.</p>
          ) : (
            <div className='list'>
              {items.map((item) => (
                <article key={item.id} className='list-item'>
                  <p className='item-title'>
                    Intent #{item.id.slice(0, 8)}
                    <span className='badge badge--neutral'>
                      {statusLabel[item.status] ?? item.status}
                    </span>
                  </p>
                  <p>
                    <strong>Job:</strong> {item.jobId.slice(0, 10)}
                  </p>
                  <p>
                    <strong>Valor bruto:</strong> {formatCurrencyMzn(item.amount)}
                  </p>
                  <p>
                    <strong>Taxa Tchuno:</strong>{' '}
                    {formatCurrencyMzn(item.platformFeeAmount)}
                  </p>
                  <p>
                    <strong>Líquido prestador:</strong>{' '}
                    {formatCurrencyMzn(item.providerNetAmount)}
                  </p>
                  <p>
                    <strong>Criado:</strong>{' '}
                    {new Date(item.createdAt).toLocaleString('pt-PT')}
                  </p>
                </article>
              ))}
            </div>
          )}

          <div className='actions actions--inline'>
            <Link href='/app/pedidos' className='primary'>
              Ver pedidos
            </Link>
            <Link href='/app' className='primary primary--ghost'>
              Voltar ao início
            </Link>
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
