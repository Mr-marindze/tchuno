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

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProviderRequestsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [priceInputByRequest, setPriceInputByRequest] = useState<
    Record<string, string>
  >({});
  const [commentInputByRequest, setCommentInputByRequest] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('A carregar pedidos disponíveis...');

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
            setRequests([]);
            setAccessToken(null);
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
            : 'Sem pedidos abertos neste momento.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar pedidos.'));
          setRequests([]);
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

  async function reloadRequests() {
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

    const parsedPrice = Number(priceInputByRequest[requestId] ?? '0');
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setStatus('Define um preço válido para enviar proposta.');
      return;
    }

    setSaving(true);
    setStatus('A enviar proposta...');

    try {
      await submitProposal(accessToken, requestId, {
        price: Math.trunc(parsedPrice),
        comment: commentInputByRequest[requestId]?.trim() || undefined,
      });

      setStatus('Proposta enviada com sucesso.');
      setExpandedRequestId(null);
      await reloadRequests();
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao enviar proposta.'));
    } finally {
      setSaving(false);
    }
  }

  const requestsWithoutProposal = useMemo(
    () => requests.filter((request) => (request.proposals?.length ?? 0) === 0).length,
    [requests],
  );

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Pedidos</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Escolhe pedidos abertos e envia proposta para entrar na seleção do
              cliente.
            </p>
          </div>
          <Link
            href='/pro/propostas'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Ver propostas
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Pedidos abertos
            </p>
            <p className='mt-1 text-lg font-semibold text-slate-900'>
              {requests.length}
            </p>
          </article>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Sem tua proposta
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {requestsWithoutProposal}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      {requests.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Sem pedidos abertos para proposta neste momento.
        </section>
      ) : (
        <section className='space-y-3'>
          {requests.map((request) => {
            const ownProposal = request.proposals?.[0] ?? null;
            const isExpanded = expandedRequestId === request.id;

            return (
              <article
                key={request.id}
                className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
              >
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-2'>
                    <h2 className='text-base font-semibold text-slate-900'>
                      {request.title}
                    </h2>
                    <p className='text-sm text-slate-600'>
                      {request.description.length > 180
                        ? `${request.description.slice(0, 180)}...`
                        : request.description}
                    </p>
                    <div className='text-xs text-slate-500'>
                      <p>Local: {request.location ?? 'n/d'}</p>
                      <p>Categoria: {request.category?.name ?? request.categoryId}</p>
                    </div>

                    {ownProposal ? (
                      <p className='text-xs text-amber-700'>
                        Última proposta: {formatCurrencyMzn(ownProposal.price)} (
                        {ownProposal.status})
                      </p>
                    ) : (
                      <p className='text-xs text-blue-700'>Ainda sem tua proposta.</p>
                    )}
                  </div>

                  <button
                    type='button'
                    className='inline-flex shrink-0 items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700'
                    onClick={() =>
                      setExpandedRequestId((current) =>
                        current === request.id ? null : request.id,
                      )
                    }
                  >
                    {isExpanded ? 'Fechar' : 'Enviar proposta'}
                  </button>
                </div>

                {isExpanded ? (
                  <div className='mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3'>
                    <label className='block space-y-1 text-sm text-slate-700'>
                      <span>Preço (MZN)</span>
                      <input
                        type='number'
                        min={1}
                        value={priceInputByRequest[request.id] ?? ''}
                        onChange={(event) =>
                          setPriceInputByRequest((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      />
                    </label>

                    <label className='block space-y-1 text-sm text-slate-700'>
                      <span>Comentário</span>
                      <textarea
                        value={commentInputByRequest[request.id] ?? ''}
                        onChange={(event) =>
                          setCommentInputByRequest((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        maxLength={320}
                        className='min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      />
                    </label>

                    <button
                      type='button'
                      className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
                      onClick={() => {
                        void handleSubmitProposal(request.id);
                      }}
                      disabled={saving}
                    >
                      {saving ? 'A enviar...' : 'Confirmar proposta'}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
