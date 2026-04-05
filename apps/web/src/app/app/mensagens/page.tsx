'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getJobById, JobDetails } from '@/lib/jobs';
import { listMyServiceRequests, ServiceRequest } from '@/lib/service-requests';

type MessageAccessItem = {
  request: ServiceRequest;
  job: JobDetails | null;
};

export default function CustomerMessagesPage() {
  const [items, setItems] = useState<MessageAccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar estado de contacto...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar estado de contacto...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setItems([]);
          }
          return;
        }

        const accessToken = session.auth.accessToken;
        const response = await listMyServiceRequests(accessToken, {
          page: 1,
          limit: 30,
        });

        if (!active) {
          return;
        }

        const withJobs = response.data.filter((request) => Boolean(request.job?.id));
        const jobDetailsResults = await Promise.allSettled(
          withJobs.map((request) => getJobById(accessToken, request.job!.id)),
        );

        if (!active) {
          return;
        }

        const nextItems = withJobs.map((request, index) => ({
          request,
          job:
            jobDetailsResults[index].status === 'fulfilled'
              ? jobDetailsResults[index].value
              : null,
        }));

        setItems(nextItems);

        if (nextItems.length === 0) {
          setStatus(
            'Ainda não tens jobs ativos. O contacto aparece aqui após seleção de proposta.',
          );
        } else {
          const unlockedCount = nextItems.filter(
            (item) => item.job?.contactUnlocked,
          ).length;
          setStatus(
            `Encontrados ${nextItems.length} job(s): ${unlockedCount} com contacto desbloqueado.`,
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(
          humanizeUnknownError(error, 'Falha ao carregar mensagens/contacto.'),
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

  const unlockedCount = useMemo(
    () => items.filter((item) => item.job?.contactUnlocked).length,
    [items],
  );

  const blockedCount = items.length - unlockedCount;

  return (
    <RouteGuard requiredAccess='customer'>
      <main className='shell'>
        <section className='card card--wide'>
          <header className='header'>
            <p className='kicker'>Mensagens</p>
            <h1>Contacto Protegido</h1>
            <p className='subtitle'>
              Esta área controla quando o contacto direto fica disponível. Sem sinal
              confirmado, o contacto permanece bloqueado.
            </p>
          </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='metric-label'>Threads</p>
              <p className='metric-value'>{items.length}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Desbloqueados</p>
              <p className='metric-value'>{unlockedCount}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Bloqueados</p>
              <p className='metric-value'>{blockedCount}</p>
            </article>
          </div>

          <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

          {items.length === 0 ? (
            <p className='muted'>
              Sem conversas ativas ainda. Seleciona uma proposta em{' '}
              <Link href='/app/pedidos' className='nav-link'>
                pedidos
              </Link>{' '}
              para iniciar o fluxo.
            </p>
          ) : (
            <div className='list'>
              {items.map((item) => {
                const contactUnlocked = Boolean(item.job?.contactUnlocked);

                return (
                  <article key={item.request.id} className='list-item'>
                    <p className='item-title'>
                      {item.request.title}
                      <span
                        className={`status-pill ${contactUnlocked ? 'is-ok' : 'is-danger'}`}
                      >
                        {contactUnlocked ? 'Contacto desbloqueado' : 'Contacto bloqueado'}
                      </span>
                    </p>

                    <p>
                      <strong>Job:</strong> {item.request.job?.id ?? 'n/a'}
                    </p>
                    <p>
                      <strong>Estado do job:</strong> {item.request.job?.status ?? 'n/a'}
                    </p>

                    {contactUnlocked ? (
                      <p className='status status--success'>
                        Prestador:{' '}
                        {item.job?.providerContact?.name ?? 'Sem nome'} |{' '}
                        {item.job?.providerContact?.email ?? 'Sem email'}
                      </p>
                    ) : (
                      <p className='muted'>
                        Mensagens diretas ficam bloqueadas até pagamento do sinal.
                      </p>
                    )}

                    <div className='actions actions--inline'>
                      <Link href={`/app/pedidos/${item.request.id}`} className='primary'>
                        Abrir detalhe do pedido
                      </Link>
                      <Link href='/app/pagamentos' className='primary primary--ghost'>
                        Ver pagamentos
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className='actions actions--inline'>
            <Link href='/app/pedidos' className='primary'>
              Voltar aos pedidos
            </Link>
            <Link href='/app' className='primary primary--ghost'>
              Ir para início
            </Link>
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
