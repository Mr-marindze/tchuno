'use client';

import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { listAdminPaymentIntents, PaymentIntent } from '@/lib/payments';

export default function AdminUsersPage() {
  const [items, setItems] = useState<PaymentIntent[]>([]);
  const [status, setStatus] = useState('A carregar utilizadores ativos...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar utilizadores ativos...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setItems([]);
          }
          return;
        }

        const response = await listAdminPaymentIntents(session.auth.accessToken, {
          page: 1,
          limit: 100,
        });

        if (!active) {
          return;
        }

        setItems(response.data);
        setStatus(
          response.data.length > 0
            ? 'Utilizadores financeiros carregados com sucesso.'
            : 'Sem atividade financeira de utilizadores ainda.',
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar utilizadores.'));
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

  const uniqueCustomers = useMemo(
    () => new Set(items.map((item) => item.customerId)).size,
    [items],
  );

  const uniqueProviders = useMemo(
    () => new Set(items.map((item) => item.providerUserId).filter(Boolean)).size,
    [items],
  );

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Admin</p>
          <h1>Users</h1>
          <p className='subtitle'>
            Visão operacional dos utilizadores com atividade financeira no fluxo oficial.
          </p>
        </header>

        <div className='flow-summary'>
          <article className='flow-summary-item'>
            <p className='item-label'>Clientes ativos</p>
            <p className='item-title'>{uniqueCustomers}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Prestadores ativos</p>
            <p className='item-title'>{uniqueProviders}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Intents analisados</p>
            <p className='item-title'>{items.length}</p>
          </article>
        </div>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        {items.length === 0 ? (
          <p className='muted'>Sem utilizadores para mostrar neste momento.</p>
        ) : (
          <div className='list'>
            {items.slice(0, 25).map((item) => (
              <article key={item.id} className='list-item'>
                <p className='item-title'>Intent #{item.id.slice(0, 8)}</p>
                <p>
                  <strong>Cliente:</strong> {item.customerId.slice(0, 10)}
                </p>
                <p>
                  <strong>Prestador:</strong> {item.providerUserId?.slice(0, 10) ?? 'n/a'}
                </p>
                <p>
                  <strong>Status:</strong> {item.status}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className='actions actions--inline'>
          <a href='/admin/payments' className='primary'>
            Abrir payments
          </a>
          <a href='/admin/audit' className='primary primary--ghost'>
            Abrir audit
          </a>
        </div>
      </section>
    </main>
  );
}
