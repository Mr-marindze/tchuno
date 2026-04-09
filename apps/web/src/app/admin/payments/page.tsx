'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { confirmReauth, ensureSession } from '@/lib/auth';
import { humanizeUnknownError, ReauthRequiredError } from '@/lib/http-errors';
import {
  AdminPaymentsOverview,
  approveAdminRefund,
  approveAdminPayout,
  createAdminPayout,
  createAdminRefund,
  getAdminPaymentsOverview,
  listAdminPaymentIntents,
  listAdminPaymentTransactions,
  listAdminPayouts,
  listAdminRefundRequests,
  PaymentIntent,
  PaymentTransaction,
  Payout,
  processAdminPayout,
  reconcileAdminPendingCharges,
  reconcileAdminTransaction,
  rejectAdminRefund,
  RefundRequest,
  releaseAdminFunds,
} from '@/lib/payments';

type AdminTab = 'intents' | 'payouts' | 'refunds' | 'reconciliation';

const intentStatusLabel: Record<string, string> = {
  CREATED: 'Criado',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_PARTIAL: 'Sinal pago',
  PENDING_CONFIRMATION: 'Em confirmação',
  SUCCEEDED: 'Pago',
  FAILED: 'Falhado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
};

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusBadgeClass(status: string): string {
  if (['SUCCEEDED', 'PAID_PARTIAL', 'PAID'].includes(status)) {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (['AWAITING_PAYMENT', 'PENDING', 'PROCESSING', 'PENDING_CONFIRMATION'].includes(status)) {
    return 'bg-orange-100 text-orange-700';
  }

  if (['FAILED', 'REVERSED', 'CANCELED', 'EXPIRED'].includes(status)) {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function parseEvidenceItems(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    .slice(0, 12);
}

export default function AdminPaymentsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminPaymentsOverview | null>(null);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const [activeTab, setActiveTab] = useState<AdminTab>('intents');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar pagamentos...');
  const [runningReconcile, setRunningReconcile] = useState(false);
  const [runningCriticalAction, setRunningCriticalAction] = useState(false);

  const [refundIntentId, setRefundIntentId] = useState('');
  const [refundReason, setRefundReason] = useState('Ajuste operacional validado');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundEvidenceDraft, setRefundEvidenceDraft] = useState('');

  const [releaseJobId, setReleaseJobId] = useState('');

  const [payoutIntentId, setPayoutIntentId] = useState('');
  const [payoutProviderUserId, setPayoutProviderUserId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  async function loadDashboard(tokenOverride?: string) {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setStatus('Sessão inválida. Faz login novamente.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [nextOverview, nextIntents, nextTransactions, nextRefunds, nextPayouts] =
        await Promise.all([
          getAdminPaymentsOverview(token),
          listAdminPaymentIntents(token, { page: 1, limit: 50 }),
          listAdminPaymentTransactions(token, { page: 1, limit: 80 }),
          listAdminRefundRequests(token, { page: 1, limit: 50 }),
          listAdminPayouts(token, { page: 1, limit: 50 }),
        ]);

      setOverview(nextOverview);
      setIntents(nextIntents.data);
      setTransactions(nextTransactions.data);
      setRefunds(nextRefunds.data);
      setPayouts(nextPayouts.data);
      setStatus('Operação financeira atualizada.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao carregar pagamentos.'));
      setOverview(null);
      setIntents([]);
      setTransactions([]);
      setRefunds([]);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const session = await ensureSession();
      if (!active) {
        return;
      }

      if (!session?.auth.accessToken) {
        setStatus('Sessão inválida. Faz login novamente.');
        setAccessToken(null);
        setLoading(false);
        return;
      }

      setAccessToken(session.auth.accessToken);
      await loadDashboard(session.auth.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (intents.length === 0) {
      return;
    }

    if (!refundIntentId) {
      setRefundIntentId(intents[0].id);
    }

    if (!payoutIntentId) {
      const candidate = intents.find((intent) => intent.providerUserId) ?? intents[0];
      setPayoutIntentId(candidate.id);
      setPayoutProviderUserId(candidate.providerUserId ?? '');
      setPayoutAmount(String(Math.max(1, candidate.providerNetAmount)));
    }
  }, [intents, payoutIntentId, refundIntentId]);

  const pendingTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        ['PENDING', 'PROCESSING'].includes(transaction.status),
      ),
    [transactions],
  );

  async function runCriticalAdminAction<T>(input: {
    purpose: string;
    execute: (reauthToken?: string) => Promise<T>;
  }): Promise<T> {
    try {
      return await input.execute();
    } catch (error) {
      if (!(error instanceof ReauthRequiredError)) {
        throw error;
      }

      if (!accessToken) {
        throw new Error('Sessão inválida para reautenticação.');
      }

      if (typeof window === 'undefined') {
        throw new Error('Reautenticação necessária para concluir a ação.');
      }

      const password = window.prompt(
        'Confirma a tua password para concluir a ação financeira:',
      );
      if (!password || password.trim().length === 0) {
        throw new Error('Reautenticação cancelada.');
      }

      const confirmation = await confirmReauth({
        accessToken,
        password: password.trim(),
        purpose: input.purpose,
      });

      return input.execute(confirmation.reauthToken);
    }
  }

  async function handleReconcilePendingBatch() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningReconcile(true);
    setStatus('A reconciliar transações pendentes...');

    try {
      const summary = await reconcileAdminPendingCharges(accessToken, {
        limit: 50,
        minAgeMinutes: 1,
      });

      setStatus(
        `Reconciliação concluída: ${summary.reconciled}/${summary.scanned} reconciliadas.`,
      );
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha na reconciliação.'));
    } finally {
      setRunningReconcile(false);
    }
  }

  async function handleReconcileTransaction(transactionId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningReconcile(true);
    setStatus(`A reconciliar transação ${transactionId.slice(0, 8)}...`);

    try {
      await reconcileAdminTransaction(accessToken, transactionId);
      setStatus('Transação reconciliada.');
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao reconciliar transação.'));
    } finally {
      setRunningReconcile(false);
    }
  }

  async function handleCreateRefund() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const reason = refundReason.trim();
    if (!refundIntentId.trim()) {
      setStatus('Seleciona um payment intent para refund.');
      return;
    }
    if (reason.length < 3) {
      setStatus('Motivo do refund deve ter pelo menos 3 caracteres.');
      return;
    }

    let parsedAmount: number | undefined;
    if (refundAmount.trim().length > 0) {
      const numeric = Number(refundAmount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setStatus('Valor do refund deve ser positivo.');
        return;
      }
      parsedAmount = Math.trunc(numeric);
    }

    setRunningCriticalAction(true);
    setStatus('A criar refund...');

    try {
      const evidenceItems = parseEvidenceItems(refundEvidenceDraft);
      const refund = await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          createAdminRefund(
            accessToken,
            {
              paymentIntentId: refundIntentId,
              reason,
              ...(typeof parsedAmount === 'number' ? { amount: parsedAmount } : {}),
              ...(evidenceItems.length > 0 ? { evidenceItems } : {}),
            },
            { reauthToken },
          ),
      });

      setStatus(`Refund ${refund.id.slice(0, 8)} criado com sucesso.`);
      setRefundAmount('');
      setRefundEvidenceDraft('');
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao criar refund.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleApproveRefund(refundId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const decisionNote =
      typeof window === 'undefined'
        ? 'Aprovado após revisão operacional.'
        : window.prompt(
            'Nota de decisão para este refund (opcional):',
            'Aprovado após revisão operacional.',
          )?.trim() || '';

    setRunningCriticalAction(true);
    setStatus(`A aprovar refund ${refundId.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          approveAdminRefund(
            accessToken,
            refundId,
            decisionNote ? { decisionNote } : undefined,
            { reauthToken },
          ),
      });
      setStatus(`Refund ${refundId.slice(0, 8)} aprovado.`);
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao aprovar refund.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleRejectRefund(refundId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    if (typeof window === 'undefined') {
      setStatus('Não foi possível recolher o motivo da recusa.');
      return;
    }

    const reason = window.prompt(
      'Indica o motivo da recusa deste pedido de refund:',
      'Pedido recusado após análise operacional.',
    );

    if (!reason || reason.trim().length < 3) {
      setStatus('A recusa precisa de um motivo com pelo menos 3 caracteres.');
      return;
    }

    const decisionNote =
      window.prompt(
        'Nota interna/decisão (opcional):',
        'Pedido recusado porque as evidências não sustentam refund adicional.',
      )?.trim() || '';

    setRunningCriticalAction(true);
    setStatus(`A recusar refund ${refundId.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          rejectAdminRefund(
            accessToken,
            refundId,
            {
              reason: reason.trim(),
              ...(decisionNote ? { decisionNote } : {}),
            },
            { reauthToken },
          ),
      });
      setStatus(`Refund ${refundId.slice(0, 8)} recusado.`);
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao recusar refund.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleReleaseFunds() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const normalizedJobId = releaseJobId.trim();
    if (!normalizedJobId) {
      setStatus('Indica o jobId para libertar fundos.');
      return;
    }

    setRunningCriticalAction(true);
    setStatus(`A libertar fundos do job ${normalizedJobId.slice(0, 8)}...`);

    try {
      const result = await runCriticalAdminAction({
        purpose: 'admin.payments.release',
        execute: (reauthToken) =>
          releaseAdminFunds(accessToken, normalizedJobId, { reauthToken }),
      });

      setStatus(
        `Fundos libertados: ${formatCurrencyMzn(result.releasedAmount)} (intent ${result.paymentIntentId.slice(0, 8)}).`,
      );
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao libertar fundos.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleCreatePayout() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const normalizedIntentId = payoutIntentId.trim();
    const normalizedProviderUserId = payoutProviderUserId.trim();

    if (!normalizedProviderUserId) {
      setStatus('Indica o providerUserId para payout.');
      return;
    }

    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus('Valor do payout deve ser positivo.');
      return;
    }

    setRunningCriticalAction(true);
    setStatus('A criar payout...');

    try {
      const payout = await runCriticalAdminAction({
        purpose: 'admin.payments.payout.create',
        execute: (reauthToken) =>
          createAdminPayout(
            accessToken,
            {
              providerUserId: normalizedProviderUserId,
              amount: Math.trunc(amount),
              paymentIntentId: normalizedIntentId || undefined,
            },
            { reauthToken },
          ),
      });

      setStatus(`Payout ${payout.id.slice(0, 8)} criado com sucesso.`);
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao criar payout.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleApprovePayout(payoutId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningCriticalAction(true);
    setStatus(`A aprovar payout ${payoutId.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.payout.approve',
        execute: (reauthToken) =>
          approveAdminPayout(accessToken, payoutId, { reauthToken }),
      });
      setStatus(`Payout ${payoutId.slice(0, 8)} aprovado.`);
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao aprovar payout.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  async function handleProcessPayout(payoutId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningCriticalAction(true);
    setStatus(`A processar payout ${payoutId.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.payout.process',
        execute: (reauthToken) =>
          processAdminPayout(accessToken, payoutId, undefined, { reauthToken }),
      });
      setStatus(`Payout ${payoutId.slice(0, 8)} processado.`);
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao processar payout.'));
    } finally {
      setRunningCriticalAction(false);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Pagamentos</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Gestão de intents, refunds, payouts e reconciliação.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
              onClick={() => {
                void loadDashboard();
              }}
              disabled={loading || runningCriticalAction}
            >
              Recarregar
            </button>
            <button
              type='button'
              className='inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
              onClick={() => {
                void handleReconcilePendingBatch();
              }}
              disabled={runningReconcile || runningCriticalAction}
            >
              {runningReconcile ? 'A reconciliar...' : 'Reconciliar pendentes'}
            </button>
          </div>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          <KpiCard
            label='Intents'
            value={overview?.kpis.totalIntents ?? 0}
            tone='slate'
          />
          <KpiCard
            label='Pendentes'
            value={overview?.kpis.intentsAwaitingPayment ?? 0}
            tone='orange'
          />
          <KpiCard
            label='Payouts pendentes'
            value={overview?.kpis.pendingPayouts ?? 0}
            tone='amber'
          />
          <KpiCard
            label='Refunds pendentes'
            value={overview?.kpis.pendingRefunds ?? 0}
            tone='rose'
          />
          <KpiCard
            label='Falhas'
            value={overview?.kpis.failedTransactions ?? 0}
            tone='rose'
          />
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
        <div className='flex flex-wrap gap-2'>
          {(
            [
              ['intents', 'Intents'],
              ['payouts', 'Payouts'],
              ['refunds', 'Refunds'],
              ['reconciliation', 'Reconciliação'],
            ] as Array<[AdminTab, string]>
          ).map(([tab, label]) => (
            <button
              key={tab}
              type='button'
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activeTab === tab
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'intents' ? (
        <section className='space-y-3'>
          {intents.length === 0 ? (
            <article className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
              Sem payment intents para mostrar.
            </article>
          ) : (
            intents.map((intent) => (
              <article
                key={intent.id}
                className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
              >
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-1 text-sm text-slate-700'>
                    <p className='font-semibold text-slate-900'>
                      Intent #{intent.id.slice(0, 8)}
                    </p>
                    <p>
                      <strong>Job:</strong> {intent.jobId.slice(0, 10)}
                    </p>
                    <p>
                      <strong>Cliente:</strong> {intent.customerId.slice(0, 10)}
                    </p>
                    <p>
                      <strong>Prestador:</strong>{' '}
                      {intent.providerUserId?.slice(0, 10) ?? 'n/d'}
                    </p>
                    <p>
                      <strong>Valor:</strong> {formatCurrencyMzn(intent.amount)} (
                      fee {formatCurrencyMzn(intent.platformFeeAmount)})
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(intent.status)}`}
                  >
                    {intentStatusLabel[intent.status] ?? intent.status}
                  </span>
                </div>

                <div className='mt-3 flex flex-wrap gap-2'>
                  <button
                    type='button'
                    className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                    onClick={() => {
                      setRefundIntentId(intent.id);
                      setActiveTab('refunds');
                    }}
                  >
                    Usar em refund
                  </button>
                  <button
                    type='button'
                    className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                    onClick={() => {
                      setPayoutIntentId(intent.id);
                      setPayoutProviderUserId(intent.providerUserId ?? '');
                      setPayoutAmount(String(Math.max(1, intent.providerNetAmount)));
                      setReleaseJobId(intent.jobId);
                      setActiveTab('payouts');
                    }}
                  >
                    Usar em payout
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {activeTab === 'payouts' ? (
        <section className='space-y-4'>
          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>Criar payout</h2>
            <div className='mt-3 grid gap-3 sm:grid-cols-3'>
              <label className='space-y-1 text-sm text-slate-700'>
                <span>Payment intent</span>
                <select
                  value={payoutIntentId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setPayoutIntentId(nextId);
                    const selectedIntent = intents.find((item) => item.id === nextId);
                    if (selectedIntent) {
                      setPayoutProviderUserId(selectedIntent.providerUserId ?? '');
                      setPayoutAmount(String(Math.max(1, selectedIntent.providerNetAmount)));
                    }
                  }}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                >
                  <option value=''>Seleciona intent</option>
                  {intents.map((intent) => (
                    <option key={intent.id} value={intent.id}>
                      {intent.id.slice(0, 8)} | {formatCurrencyMzn(intent.providerNetAmount)}
                    </option>
                  ))}
                </select>
              </label>

              <label className='space-y-1 text-sm text-slate-700'>
                <span>Provider user ID</span>
                <input
                  type='text'
                  value={payoutProviderUserId}
                  onChange={(event) => setPayoutProviderUserId(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                />
              </label>

              <label className='space-y-1 text-sm text-slate-700'>
                <span>Valor</span>
                <input
                  type='number'
                  min={1}
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                />
              </label>
            </div>
            <button
              type='button'
              className='mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
              onClick={() => {
                void handleCreatePayout();
              }}
              disabled={runningCriticalAction}
            >
              Criar payout
            </button>
          </article>

          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>Payouts</h2>
            {payouts.length === 0 ? (
              <p className='mt-3 text-sm text-slate-600'>Sem payouts registados.</p>
            ) : (
              <div className='mt-3 space-y-3'>
                {payouts.map((payout) => (
                  <article
                    key={payout.id}
                    className='rounded-xl border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='space-y-1 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-900'>
                          #{payout.id.slice(0, 8)}
                        </p>
                        <p>
                          <strong>Prestador:</strong> {payout.providerUserId.slice(0, 10)}
                        </p>
                        <p>
                          <strong>Valor:</strong> {formatCurrencyMzn(payout.amount)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(payout.status)}`}
                      >
                        {payout.status}
                      </span>
                    </div>

                    <div className='mt-3 flex flex-wrap gap-2'>
                      {payout.status === 'PENDING' ? (
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                          onClick={() => {
                            void handleApprovePayout(payout.id);
                          }}
                          disabled={runningCriticalAction}
                        >
                          Aprovar
                        </button>
                      ) : null}
                      {payout.status === 'APPROVED' ? (
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60'
                          onClick={() => {
                            void handleProcessPayout(payout.id);
                          }}
                          disabled={runningCriticalAction}
                        >
                          Processar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'refunds' ? (
        <section className='space-y-4'>
          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>
              Criar refund manual
            </h2>
            <p className='mt-1 text-sm text-slate-600'>
              Usa este bloco para exceções operacionais. Os pedidos vindos do
              produto aparecem abaixo para aprovação ou recusa.
            </p>
            <div className='mt-3 grid gap-3 sm:grid-cols-3'>
              <label className='space-y-1 text-sm text-slate-700'>
                <span>Payment intent</span>
                <select
                  value={refundIntentId}
                  onChange={(event) => setRefundIntentId(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                >
                  <option value=''>Seleciona intent</option>
                  {intents.map((intent) => (
                    <option key={intent.id} value={intent.id}>
                      {intent.id.slice(0, 8)} | {intent.status} | {formatCurrencyMzn(intent.amount)}
                    </option>
                  ))}
                </select>
              </label>

              <label className='space-y-1 text-sm text-slate-700'>
                <span>Valor (opcional)</span>
                <input
                  type='number'
                  min={1}
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                />
              </label>

              <label className='space-y-1 text-sm text-slate-700'>
                <span>Motivo</span>
                <input
                  type='text'
                  minLength={3}
                  maxLength={240}
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                />
              </label>

              <label className='space-y-1 text-sm text-slate-700 sm:col-span-2'>
                <span>Evidências (uma por linha)</span>
                <textarea
                  value={refundEvidenceDraft}
                  onChange={(event) => setRefundEvidenceDraft(event.target.value)}
                  maxLength={1000}
                  className='min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                  placeholder='Resumo factual, links internos, comprovativos ou notas recolhidas pela equipa.'
                />
              </label>
            </div>
            <button
              type='button'
              className='mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
              onClick={() => {
                void handleCreateRefund();
              }}
              disabled={runningCriticalAction}
            >
              Criar refund
            </button>
          </article>

          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>Refunds</h2>
            {refunds.length === 0 ? (
              <p className='mt-3 text-sm text-slate-600'>Sem refunds registados.</p>
            ) : (
              <div className='mt-3 space-y-3'>
                {refunds.map((refund) => (
                  <article
                    key={refund.id}
                    className='rounded-xl border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='space-y-1 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-900'>
                          #{refund.id.slice(0, 8)}
                        </p>
                        <p>
                          <strong>Intent:</strong> {refund.paymentIntentId.slice(0, 10)}
                        </p>
                        <p>
                          <strong>Valor:</strong> {formatCurrencyMzn(refund.amount)}
                        </p>
                        <p>
                          <strong>Motivo:</strong> {refund.reason}
                        </p>
                        <p>
                          <strong>Pedido por:</strong>{' '}
                          {refund.requestedByUser?.name ?? refund.requestedByUserId.slice(0, 10)}
                        </p>
                        {refund.approvedByUserId ? (
                          <p>
                            <strong>Decidido por:</strong>{' '}
                            {refund.approvedByUser?.name ??
                              refund.approvedByUserId.slice(0, 10)}
                          </p>
                        ) : null}
                        {refund.failureReason ? (
                          <p className='text-rose-700'>
                            <strong>Nota:</strong> {refund.failureReason}
                          </p>
                        ) : null}
                        {refund.decisionNote ? (
                          <p>
                            <strong>Decisão:</strong> {refund.decisionNote}
                          </p>
                        ) : null}
                        {refund.evidenceItems.length > 0 ? (
                          <p>
                            <strong>Evidências:</strong>{' '}
                            {refund.evidenceItems.join(' | ')}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(refund.status)}`}
                      >
                        {refund.status}
                      </span>
                    </div>

                    {refund.status === 'PENDING' ? (
                      <div className='mt-3 flex flex-wrap gap-2'>
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60'
                          onClick={() => {
                            void handleApproveRefund(refund.id);
                          }}
                          disabled={runningCriticalAction}
                        >
                          Aprovar e processar
                        </button>
                        <button
                          type='button'
                          className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                          onClick={() => {
                            void handleRejectRefund(refund.id);
                          }}
                          disabled={runningCriticalAction}
                        >
                          Recusar
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'reconciliation' ? (
        <section className='space-y-4'>
          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>Libertar fundos</h2>
            <p className='mt-1 text-sm text-slate-600'>
              Usa o jobId para libertar saldo do prestador após conclusão.
            </p>
            <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
              <input
                type='text'
                value={releaseJobId}
                onChange={(event) => setReleaseJobId(event.target.value)}
                placeholder='jobId'
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              />
              <button
                type='button'
                className='inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
                onClick={() => {
                  void handleReleaseFunds();
                }}
                disabled={runningCriticalAction}
              >
                Libertar
              </button>
            </div>
          </article>

          <article className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
            <h2 className='text-lg font-semibold text-slate-900'>
              Transações pendentes/processando
            </h2>
            {pendingTransactions.length === 0 ? (
              <p className='mt-3 text-sm text-slate-600'>
                Sem transações pendentes neste momento.
              </p>
            ) : (
              <div className='mt-3 space-y-3'>
                {pendingTransactions.map((transaction) => (
                  <article
                    key={transaction.id}
                    className='rounded-xl border border-slate-200 bg-slate-50 p-3'
                  >
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='space-y-1 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-900'>
                          {transaction.type} #{transaction.id.slice(0, 8)}
                        </p>
                        <p>
                          <strong>Provider:</strong> {transaction.provider}
                        </p>
                        <p>
                          <strong>Valor:</strong>{' '}
                          {formatCurrencyMzn(transaction.requestedAmount)}
                        </p>
                      </div>
                      <button
                        type='button'
                        className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleReconcileTransaction(transaction.id);
                        }}
                        disabled={runningReconcile || runningCriticalAction}
                      >
                        Reconciliar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <section className='flex flex-wrap gap-2'>
        <Link
          href='/admin'
          className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
        >
          Voltar ao overview
        </Link>
        <Link
          href='/admin/audit'
          className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
        >
          Abrir auditoria
        </Link>
      </section>
    </main>
  );
}

function KpiCard(input: {
  label: string;
  value: number;
  tone: 'slate' | 'orange' | 'amber' | 'rose';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  }[input.tone];

  return (
    <article className={`rounded-xl border p-3 ${toneClass}`}>
      <p className='text-xs font-medium uppercase tracking-wide'>{input.label}</p>
      <p className='mt-1 text-lg font-semibold'>{input.value}</p>
    </article>
  );
}
