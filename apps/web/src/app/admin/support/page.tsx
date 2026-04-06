'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ensureSession,
  listPasswordRecoveryRequests,
  PasswordRecoveryRequest,
  PasswordRecoveryRequestStatus,
  updatePasswordRecoveryRequest,
} from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';

function statusLabel(status: PasswordRecoveryRequestStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Novo';
    case 'IN_PROGRESS':
      return 'Em tratamento';
    case 'RESOLVED':
      return 'Resolvido';
    case 'CANCELED':
      return 'Cancelado';
    default:
      return status;
  }
}

function statusClass(status: PasswordRecoveryRequestStatus): string {
  switch (status) {
    case 'OPEN':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'IN_PROGRESS':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'RESOLVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'CANCELED':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function buildResetCommand(request: PasswordRecoveryRequest): string {
  return [
    'yarn workspace @tchuno/database reset-password',
    `--email ${request.email}`,
    `--reason "password-recovery-request:${request.id}"`,
  ].join(' ');
}

export default function AdminSupportPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<PasswordRecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [status, setStatus] = useState('A carregar pedidos de recuperação...');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadCurrentRequests(tokenOverride?: string | null) {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setItems([]);
      return;
    }

    const response = await listPasswordRecoveryRequests(token, {
      page: 1,
      limit: 50,
    });

    setItems(response.data);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar pedidos de recuperação...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setItems([]);
          }
          return;
        }

        if (!active) {
          return;
        }

        setAccessToken(session.auth.accessToken);
        const response = await listPasswordRecoveryRequests(
          session.auth.accessToken,
          {
            page: 1,
            limit: 50,
          },
        );

        if (!active) {
          return;
        }

        setItems(response.data);
        setStatus(
          response.data.length > 0
            ? `Foram encontrados ${response.data.length} pedido(s) de recuperação.`
            : 'Ainda não existem pedidos de recuperação.',
        );
      } catch (error) {
        if (active) {
          setStatus(
            humanizeUnknownError(
              error,
              'Falha ao carregar pedidos de recuperação.',
            ),
          );
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
        acc.total += 1;
        if (item.status === 'OPEN') {
          acc.open += 1;
        }
        if (item.status === 'IN_PROGRESS') {
          acc.inProgress += 1;
        }
        if (item.status === 'RESOLVED') {
          acc.resolved += 1;
        }
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, resolved: 0 },
    );
  }, [items]);

  async function handleUpdate(
    requestId: string,
    nextStatus: Exclude<PasswordRecoveryRequestStatus, 'OPEN'>,
  ) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningId(requestId);
    setStatus('A atualizar pedido...');

    try {
      await updatePasswordRecoveryRequest(accessToken, requestId, {
        status: nextStatus,
      });
      await loadCurrentRequests(accessToken);
      setStatus(`Pedido atualizado para ${statusLabel(nextStatus).toLowerCase()}.`);
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao atualizar pedido de recuperação.'),
      );
    } finally {
      setRunningId(null);
    }
  }

  async function handleCopyCommand(request: PasswordRecoveryRequest) {
    try {
      if (!navigator.clipboard) {
        setStatus('Clipboard não disponível neste browser.');
        return;
      }

      await navigator.clipboard.writeText(buildResetCommand(request));
      setCopiedId(request.id);
      setStatus(`Comando copiado para ${request.email}.`);

      window.setTimeout(() => {
        setCopiedId((current) => (current === request.id ? null : current));
      }, 1500);
    } catch {
      setStatus('Falha ao copiar comando.');
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>
          Suporte e recuperação
        </h1>
        <p className='mt-1 text-sm text-slate-600'>
          Fila assistida para pedidos de recuperação de senha.
        </p>

        <div className='mt-4 grid gap-3 sm:grid-cols-4'>
          <SummaryCard label='Total' value={summary.total} />
          <SummaryCard label='Novos' value={summary.open} />
          <SummaryCard label='Em tratamento' value={summary.inProgress} />
          <SummaryCard label='Resolvidos' value={summary.resolved} />
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <p className='text-sm text-slate-600'>
          Fluxo sugerido: copiar o comando interno, redefinir a senha por canal
          seguro e depois marcar o pedido como resolvido.
        </p>
      </section>

      {items.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Ainda não há pedidos para tratar.
        </section>
      ) : (
        <section className='space-y-3'>
          {items.map((item) => (
            <article
              key={item.id}
              className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='font-semibold text-slate-900'>{item.email}</p>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        item.status,
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                    <span className='text-xs text-slate-500'>
                      {item.userId ? 'Conta encontrada' : 'Conta não encontrada'}
                    </span>
                  </div>

                  <div className='space-y-1 text-sm text-slate-600'>
                    <p>
                      Pedido em:{' '}
                      {new Date(item.requestedAt).toLocaleString('pt-PT')}
                    </p>
                    {item.resolvedBy ? (
                      <p>
                        Tratado por: {item.resolvedBy.name ?? item.resolvedBy.email}
                      </p>
                    ) : null}
                    {item.note ? <p>Nota: {item.note}</p> : null}
                  </div>
                </div>

                <div className='flex flex-wrap gap-2'>
                  {item.status === 'OPEN' ? (
                    <button
                      type='button'
                      className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                      onClick={() => {
                        void handleUpdate(item.id, 'IN_PROGRESS');
                      }}
                      disabled={runningId === item.id}
                    >
                      Em tratamento
                    </button>
                  ) : null}

                  {item.status !== 'RESOLVED' && item.status !== 'CANCELED' ? (
                    <button
                      type='button'
                      className='rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60'
                      onClick={() => {
                        void handleUpdate(item.id, 'RESOLVED');
                      }}
                      disabled={runningId === item.id}
                    >
                      Marcar como resolvido
                    </button>
                  ) : null}

                  {item.status !== 'RESOLVED' && item.status !== 'CANCELED' ? (
                    <button
                      type='button'
                      className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                      onClick={() => {
                        void handleUpdate(item.id, 'CANCELED');
                      }}
                      disabled={runningId === item.id}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className='mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                  Comando interno
                </p>
                <code className='mt-2 block overflow-x-auto text-xs text-slate-700'>
                  {buildResetCommand(item)}
                </code>
                <button
                  type='button'
                  className='mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                  onClick={() => {
                    void handleCopyCommand(item);
                  }}
                >
                  {copiedId === item.id ? 'Comando copiado' : 'Copiar comando'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
        {label}
      </p>
      <p className='mt-1 text-lg font-semibold text-slate-900'>{value}</p>
    </article>
  );
}
