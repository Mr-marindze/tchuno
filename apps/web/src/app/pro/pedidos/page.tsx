'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  listOpenServiceRequests,
  ServiceRequest,
  submitProposal,
} from '@/lib/service-requests';

export default function ProviderOrdersPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [status, setStatus] = useState('A carregar pedidos disponíveis...');
  const [loading, setLoading] = useState(true);

  const [proposalPrice, setProposalPrice] = useState<Record<string, string>>({});
  const [proposalComment, setProposalComment] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar pedidos disponíveis...');

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
        const response = await listOpenServiceRequests(token, {
          status: 'OPEN',
          page: 1,
          limit: 30,
        });

        if (!active) {
          return;
        }

        setAccessToken(token);
        setRequests(response.data);
        setStatus(
          response.data.length > 0
            ? `Encontrados ${response.data.length} pedido(s) aberto(s).`
            : 'Nenhum pedido aberto neste momento.',
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(
          humanizeUnknownError(error, 'Falha ao carregar pedidos disponíveis.'),
        );
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

  async function reload() {
    if (!accessToken) {
      return;
    }

    const response = await listOpenServiceRequests(accessToken, {
      status: 'OPEN',
      page: 1,
      limit: 30,
    });

    setRequests(response.data);
  }

  async function handleSubmitProposal(requestId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const numericPrice = Number(proposalPrice[requestId] ?? '0');
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setStatus('Define um preço válido para enviar proposta.');
      return;
    }

    try {
      await submitProposal(accessToken, requestId, {
        price: Math.trunc(numericPrice),
        comment: proposalComment[requestId] || undefined,
      });

      setStatus('Proposta enviada com sucesso.');
      await reload();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar proposta.'));
    }
  }

  const openCount = useMemo(() => requests.length, [requests]);

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Novo Fluxo</p>
          <h1>Pedidos Disponíveis</h1>
          <p className='subtitle'>
            Envia proposta de preço para pedidos abertos. O cliente escolhe uma
            proposta e o contacto só é desbloqueado após pagamento do sinal.
          </p>
        </header>

        <div className='flow-summary'>
          <article className='flow-summary-item'>
            <p className='item-label'>Pedidos abertos</p>
            <p className='item-title'>{openCount}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Regra operacional</p>
            <p className='item-title'>Propor {'->'} esperar seleção</p>
          </article>
        </div>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        {requests.length === 0 ? (
          <p className='muted'>Não há pedidos abertos para proposta agora.</p>
        ) : (
          <div className='list'>
            {requests.map((request) => {
              const ownLatestProposal = request.proposals?.[0] ?? null;

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

                  {ownLatestProposal ? (
                    <p className='muted'>
                      Tua última proposta: {formatCurrencyMzn(ownLatestProposal.price)} ({' '}
                      {ownLatestProposal.status})
                    </p>
                  ) : (
                    <p className='muted'>Ainda não enviaste proposta para este pedido.</p>
                  )}

                  <div className='form'>
                    <label>
                      Preço proposto (MZN)
                      <input
                        type='number'
                        min={1}
                        value={proposalPrice[request.id] ?? ''}
                        onChange={(event) =>
                          setProposalPrice((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      Comentário
                      <textarea
                        value={proposalComment[request.id] ?? ''}
                        onChange={(event) =>
                          setProposalComment((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                        maxLength={320}
                      />
                    </label>
                  </div>

                  <div className='actions actions--inline'>
                    <button
                      type='button'
                      className='primary'
                      onClick={() => {
                        void handleSubmitProposal(request.id);
                      }}
                    >
                      Enviar proposta
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className='actions actions--inline'>
          <Link href='/pro/propostas' className='primary primary--ghost'>
            Ver propostas enviadas
          </Link>
          <Link href='/pro/ganhos' className='primary'>
            Ver ganhos
          </Link>
        </div>
      </section>
    </main>
  );
}
