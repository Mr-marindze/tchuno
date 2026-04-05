'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { listCategories, Category } from '@/lib/categories';
import { humanizeUnknownError } from '@/lib/http-errors';
import { payPaymentIntent } from '@/lib/payments';
import {
  createServiceRequest,
  listMyServiceRequests,
  listRequestProposals,
  selectProposal,
  Proposal,
  ServiceRequest,
} from '@/lib/service-requests';

export default function CustomerOrdersPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [proposalsByRequest, setProposalsByRequest] = useState<Record<string, Proposal[]>>({});
  const [pendingIntentByRequest, setPendingIntentByRequest] = useState<
    Record<string, { id: string; amount: number; status: string } | null>
  >({});

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar pedidos...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar pedidos...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setAccessToken(null);
            setRequests([]);
          }
          return;
        }

        const token = session.auth.accessToken;
        const [allCategories, requestResponse] = await Promise.all([
          listCategories(),
          listMyServiceRequests(token, { page: 1, limit: 20 }),
        ]);

        if (!active) {
          return;
        }

        setAccessToken(token);
        setCategories(allCategories.filter((item) => item.isActive));
        setRequests(requestResponse.data);

        const pendingMap: Record<string, { id: string; amount: number; status: string } | null> = {};
        requestResponse.data.forEach((request) => {
          pendingMap[request.id] = null;
        });
        setPendingIntentByRequest(pendingMap);

        setStatus(
          requestResponse.data.length > 0
            ? `Encontrados ${requestResponse.data.length} pedido(s).`
            : 'Ainda não tens pedidos abertos.',
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar pedidos.'));
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

  async function refreshRequests() {
    if (!accessToken) {
      return;
    }

    const response = await listMyServiceRequests(accessToken, { page: 1, limit: 20 });
    setRequests(response.data);
  }

  async function loadProposals(requestId: string) {
    if (!accessToken) {
      return;
    }

    try {
      const proposals = await listRequestProposals(accessToken, requestId);
      setProposalsByRequest((prev) => ({
        ...prev,
        [requestId]: proposals,
      }));
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao carregar propostas.'));
    }
  }

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    try {
      await createServiceRequest(accessToken, {
        categoryId,
        title,
        description,
        location: location || undefined,
      });

      setTitle('');
      setDescription('');
      setLocation('');
      setCategoryId('');
      setStatus('Pedido criado com sucesso. Agora espera propostas.');
      await refreshRequests();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao criar pedido.'));
    }
  }

  async function handleSelectProposal(requestId: string, proposalId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    try {
      const result = await selectProposal(accessToken, requestId, proposalId, {
        depositPercent: 30,
      });

      setPendingIntentByRequest((prev) => ({
        ...prev,
        [requestId]: result.paymentIntent,
      }));

      setStatus(
        result.paymentIntent
          ? 'Prestador selecionado. Paga o sinal para desbloquear contacto.'
          : 'Prestador selecionado com sucesso.',
      );

      await Promise.all([refreshRequests(), loadProposals(requestId)]);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao selecionar proposta.'));
    }
  }

  async function handlePayDeposit(requestId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const intent = pendingIntentByRequest[requestId];
    if (!intent) {
      setStatus('Nenhum pagamento pendente para este pedido.');
      return;
    }

    try {
      await payPaymentIntent(accessToken, intent.id, {
        simulate: 'success',
      });

      setPendingIntentByRequest((prev) => ({
        ...prev,
        [requestId]: null,
      }));

      setStatus('Sinal pago com sucesso. Contacto desbloqueado para execução.');
      await refreshRequests();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao pagar sinal.'));
    }
  }

  const requestsCount = useMemo(() => requests.length, [requests]);

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
            <p className='kicker'>Novo Fluxo</p>
            <h1>Pedidos de Serviço</h1>
            <p className='subtitle'>
              Cria pedido aberto, recebe múltiplas propostas, seleciona prestador e
              paga sinal para desbloquear contacto.
            </p>
          </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='item-label'>Pedidos</p>
              <p className='item-title'>{requestsCount}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='item-label'>Regra crítica</p>
              <p className='item-title'>Sem sinal, sem contacto</p>
            </article>
          </div>

          <form className='form' onSubmit={handleCreateRequest}>
            <label>
              Categoria
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                <option value=''>Seleciona</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Título
              <input
                type='text'
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={140}
                required
              />
            </label>

            <label>
              Descrição
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={10}
                maxLength={2000}
                required
              />
            </label>

            <label>
              Localização
              <input
                type='text'
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={240}
              />
            </label>

            <div className='actions actions--inline'>
              <button type='submit' className='primary'>
                Criar pedido
              </button>
              <button
                type='button'
                onClick={() => {
                  void refreshRequests();
                }}
              >
                Recarregar
              </button>
            </div>
          </form>

          <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

          {requests.length === 0 ? (
            <p className='muted'>Sem pedidos ainda. Cria o primeiro acima.</p>
          ) : (
            <div className='list'>
              {requests.map((request) => {
                const proposals = proposalsByRequest[request.id] ?? [];
                const pendingIntent = pendingIntentByRequest[request.id];
                const contactUnlocked = Boolean(request.job?.contactUnlockedAt);

                return (
                  <article key={request.id} className='list-item'>
                    <p className='item-title'>
                      {request.title}
                      <span className='badge badge--neutral'>{request.status}</span>
                    </p>
                    <p>{request.description}</p>
                    <p>
                      <strong>Local:</strong> {request.location ?? 'n/a'}
                    </p>

                    <div className='actions actions--inline'>
                      <button
                        type='button'
                        onClick={() => {
                          void loadProposals(request.id);
                        }}
                      >
                        Ver propostas
                      </button>

                      {pendingIntent ? (
                        <button
                          type='button'
                          className='primary'
                          onClick={() => {
                            void handlePayDeposit(request.id);
                          }}
                        >
                          Pagar sinal ({formatCurrencyMzn(pendingIntent.amount)})
                        </button>
                      ) : null}
                    </div>

                    {contactUnlocked ? (
                      <p className='status status--success'>
                        Contacto desbloqueado após pagamento do sinal.
                      </p>
                    ) : (
                      <p className='muted'>
                        Contacto direto permanece bloqueado até o sinal ser pago.
                      </p>
                    )}

                    {proposals.length > 0 ? (
                      <div className='list'>
                        {proposals.map((proposal) => (
                          <article key={proposal.id} className='list-item'>
                            <p className='item-title'>
                              Prestador {proposal.provider?.name ?? proposal.providerId.slice(0, 8)}
                              <span className='badge badge--neutral'>{proposal.status}</span>
                            </p>
                            <p>
                              <strong>Preço:</strong> {formatCurrencyMzn(proposal.price)}
                            </p>
                            <p>
                              <strong>Comentário:</strong> {proposal.comment ?? 'Sem comentário'}
                            </p>
                            <p>
                              <strong>Rating:</strong>{' '}
                              {proposal.provider?.workerProfile
                                ? `${proposal.provider.workerProfile.ratingAvg} (${proposal.provider.workerProfile.ratingCount})`
                                : 'n/a'}
                            </p>

                            {request.status === 'OPEN' ? (
                              <div className='actions actions--inline'>
                                <button
                                  type='button'
                                  className='primary'
                                  onClick={() => {
                                    void handleSelectProposal(request.id, proposal.id);
                                  }}
                                >
                                  Selecionar
                                </button>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <div className='actions actions--inline'>
            <Link href='/app/pagamentos' className='primary'>
              Ver pagamentos
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
