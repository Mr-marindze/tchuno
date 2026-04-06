'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { Category, listCategories } from '@/lib/categories';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  createServiceRequest,
  listMyServiceRequests,
  recreateServiceRequest,
  ServiceRequest,
} from '@/lib/service-requests';

type FlowStateKey =
  | 'awaiting'
  | 'selecting'
  | 'payment_pending'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'canceled';

type FlowState = {
  key: FlowStateKey;
  label: string;
  hint: string;
  badgeClass: string;
};

const pendingIntentStatuses = new Set([
  'CREATED',
  'AWAITING_PAYMENT',
  'PENDING_CONFIRMATION',
  'FAILED',
]);

function getRequestFlowState(request: ServiceRequest): FlowState {
  if (request.status === 'EXPIRED') {
    return {
      key: 'expired',
      label: 'Expirado',
      hint: 'Pedido expirado sem seleção. Cria um novo pedido para voltar a receber propostas.',
      badgeClass: 'bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300',
    };
  }

  if (request.job?.status === 'CANCELED') {
    return {
      key: 'canceled',
      label: 'Cancelado',
      hint: 'Fluxo encerrado sem conclusão.',
      badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    };
  }

  if (request.job?.status === 'COMPLETED') {
    return {
      key: 'completed',
      label: 'Concluído',
      hint: request.job.review
        ? 'Serviço finalizado e já avaliado.'
        : 'Serviço finalizado. Falta a tua avaliação.',
      badgeClass: 'bg-emerald-800 text-white ring-1 ring-inset ring-emerald-700',
    };
  }

  const hasPendingIntent =
    request.job?.paymentIntents?.some((intent) =>
      pendingIntentStatuses.has(intent.status),
    ) ?? false;

  if (
    hasPendingIntent ||
    (request.selectedProposalId && request.job && !request.job.contactUnlockedAt)
  ) {
    return {
      key: 'payment_pending',
      label: 'Pagamento pendente',
      hint: 'Contacto bloqueado até pagamento do sinal.',
      badgeClass:
        'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200',
    };
  }

  if (
    request.job?.contactUnlockedAt ||
    request.job?.status === 'ACCEPTED' ||
    request.job?.status === 'IN_PROGRESS'
  ) {
    return {
      key: 'in_progress',
      label: 'Em execução',
      hint: 'Serviço em curso com contacto desbloqueado.',
      badgeClass:
        'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    };
  }

  if ((request.proposals?.length ?? 0) > 0) {
    return {
      key: 'selecting',
      label: 'Escolher prestador',
      hint: 'Já existem propostas para seleção.',
      badgeClass: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200',
    };
  }

  return {
    key: 'awaiting',
    label: 'Aguardando propostas',
    hint: 'Pedido aberto à espera de propostas.',
    badgeClass: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
  };
}

function formatRequestExpiryText(request: ServiceRequest): string {
  const formattedDate = new Date(request.expiresAt).toLocaleString('pt-PT');

  if (request.status === 'EXPIRED') {
    return `Expirou em ${formattedDate}`;
  }

  if (request.status === 'OPEN') {
    return `Expira em ${formattedDate}`;
  }

  return `Validade inicial: ${formattedDate}`;
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recreatingRequestId, setRecreatingRequestId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [status, setStatus] = useState('A carregar pedidos...');

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

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
            setRequests([]);
            setCategories([]);
            setAccessToken(null);
          }
          return;
        }

        const token = session.auth.accessToken;
        const [requestResponse, allCategories] = await Promise.all([
          listMyServiceRequests(token, { page: 1, limit: 30 }),
          listCategories(),
        ]);

        if (!active) {
          return;
        }

        setAccessToken(token);
        setRequests(requestResponse.data);
        setCategories(allCategories.filter((category) => category.isActive));
        setStatus(
          requestResponse.data.length > 0
            ? `Encontrados ${requestResponse.data.length} pedido(s).`
            : 'Ainda não tens pedidos. Cria o teu primeiro pedido.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar pedidos.'));
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

    const response = await listMyServiceRequests(accessToken, {
      page: 1,
      limit: 30,
    });

    setRequests(response.data);
  }

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setSaving(true);
    setStatus('A criar pedido...');

    try {
      const createdRequest = await createServiceRequest(accessToken, {
        categoryId,
        title,
        description,
        location: location.trim() || undefined,
      });

      setCategoryId('');
      setTitle('');
      setDescription('');
      setLocation('');
      setShowCreateForm(false);
      setStatus('Pedido criado com sucesso.');
      router.push(`/app/pedidos/${createdRequest.id}`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao criar pedido.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecreateRequest(requestId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRecreatingRequestId(requestId);
    setStatus('A criar um novo pedido a partir do pedido expirado...');

    try {
      const recreated = await recreateServiceRequest(accessToken, requestId);
      setStatus('Novo pedido criado a partir do pedido expirado.');
      router.push(`/app/pedidos/${recreated.id}`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao recriar pedido.'));
    } finally {
      setRecreatingRequestId(null);
    }
  }

  const metrics = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        const state = getRequestFlowState(request).key;
        if (state === 'awaiting') {
          acc.awaiting += 1;
        }
        if (state === 'payment_pending') {
          acc.pendingPayment += 1;
        }
        return acc;
      },
      {
        awaiting: 0,
        pendingPayment: 0,
      },
    );
  }, [requests]);

  return (
    <main className='space-y-5'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Pedidos</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Acompanha os pedidos e avança no fluxo de propostas, seleção e
              pagamento.
            </p>
          </div>

          <button
            type='button'
            className='inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700'
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? 'Fechar formulário' : 'Novo pedido'}
          </button>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Pedidos
            </p>
            <p className='mt-1 text-lg font-semibold text-slate-900'>
              {requests.length}
            </p>
          </article>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Aguardando propostas
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {metrics.awaiting}
            </p>
          </article>
          <article className='rounded-xl border border-orange-200 bg-orange-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-orange-700'>
              Pagamento pendente
            </p>
            <p className='mt-1 text-lg font-semibold text-orange-700'>
              {metrics.pendingPayment}
            </p>
          </article>
        </div>

        {showCreateForm ? (
          <form className='mt-4 space-y-3' onSubmit={handleCreateRequest}>
            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='space-y-1 text-sm text-slate-700'>
                <span>Categoria</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
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

              <label className='space-y-1 text-sm text-slate-700'>
                <span>Título</span>
                <input
                  type='text'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={3}
                  maxLength={140}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                  required
                />
              </label>
            </div>

            <label className='space-y-1 text-sm text-slate-700'>
              <span>Descrição</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={10}
                maxLength={2000}
                className='min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                required
              />
            </label>

            <label className='space-y-1 text-sm text-slate-700'>
              <span>Localização (opcional)</span>
              <input
                type='text'
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={240}
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              />
            </label>

            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='submit'
                className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                disabled={saving}
              >
                {saving ? 'A guardar...' : 'Criar pedido'}
              </button>
              <button
                type='button'
                className='inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                onClick={() => {
                  void reloadRequests();
                }}
              >
                Recarregar lista
              </button>
            </div>
          </form>
        ) : null}

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='space-y-3'>
        {requests.length === 0 ? (
          <article className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
            Ainda não tens pedidos. Usa o botão <strong>Novo pedido</strong> para
            começar.
          </article>
        ) : (
          requests.map((request) => {
            const state = getRequestFlowState(request);
            const canReview =
              request.job?.status === 'COMPLETED' && !request.job.review;

            return (
              <article
                key={request.id}
                className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'
              >
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h2 className='text-base font-semibold text-slate-900'>
                        {request.title}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.badgeClass}`}
                      >
                        {state.label}
                      </span>
                    </div>

                    <p className='text-sm text-slate-600'>
                      {request.description.length > 180
                        ? `${request.description.slice(0, 180)}...`
                        : request.description}
                    </p>

                    <p className='text-xs text-slate-500'>
                      {request.location ? `Local: ${request.location}` : 'Local não definido'}
                    </p>
                    <p className='text-xs text-slate-500'>
                      {formatRequestExpiryText(request)}
                    </p>
                    {request.job?.review ? (
                      <p className='text-xs text-slate-500'>
                        Avaliação enviada: {request.job.review.rating}/5
                      </p>
                    ) : null}
                    <p className='text-xs text-slate-500'>{state.hint}</p>
                  </div>

                  <div className='flex shrink-0 flex-wrap items-center gap-2'>
                    {canReview ? (
                      <Link
                        href={`/app/pedidos/${request.id}#avaliacao`}
                        className='inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700'
                      >
                        Avaliar agora
                      </Link>
                    ) : null}

                    {state.key === 'expired' ? (
                      <button
                        type='button'
                        className='inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                        onClick={() => {
                          void handleRecreateRequest(request.id);
                        }}
                        disabled={recreatingRequestId === request.id}
                      >
                        {recreatingRequestId === request.id
                          ? 'A criar...'
                          : 'Criar novo pedido igual'}
                      </button>
                    ) : null}

                    <Link
                      href={`/app/pedidos/${request.id}`}
                      className='inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                    >
                      Ver detalhe
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
