'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { confirmReauth, ensureSession } from '@/lib/auth';
import { humanizeUnknownError, ReauthRequiredError } from '@/lib/http-errors';
import {
  AdminPaymentsOverview,
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
  RefundRequest,
  releaseAdminFunds,
} from '@/lib/payments';

export default function AdminPaymentsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminPaymentsOverview | null>(null);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar operação financeira...');
  const [runningReconcile, setRunningReconcile] = useState(false);
  const [runningCriticalAction, setRunningCriticalAction] = useState(false);

  const [refundIntentId, setRefundIntentId] = useState('');
  const [refundReason, setRefundReason] = useState('Ajuste operacional validado');
  const [refundAmount, setRefundAmount] = useState('');

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
    setStatus('A carregar operação financeira...');

    try {
      const [nextOverview, nextIntents, nextTransactions, nextRefunds, nextPayouts] =
        await Promise.all([
          getAdminPaymentsOverview(token),
          listAdminPaymentIntents(token, { page: 1, limit: 20 }),
          listAdminPaymentTransactions(token, {
            page: 1,
            limit: 40,
          }),
          listAdminRefundRequests(token, { page: 1, limit: 20 }),
          listAdminPayouts(token, { page: 1, limit: 20 }),
        ]);

      setOverview(nextOverview);
      setIntents(nextIntents.data);
      setTransactions(nextTransactions.data);
      setRefunds(nextRefunds.data);
      setPayouts(nextPayouts.data);
      setStatus('Painel financeiro operacional atualizado.');
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao carregar painel financeiro.'),
      );
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

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

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
        throw new Error('Reautenticação cancelada pelo utilizador.');
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
    setStatus('A executar reconciliação automática manual...');

    try {
      const summary = await reconcileAdminPendingCharges(accessToken, {
        limit: 50,
        minAgeMinutes: 1,
      });

      setStatus(
        `Reconciliação concluída: ${summary.reconciled}/${summary.scanned} transações reconciliadas.`,
      );
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha na reconciliação em lote.'));
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
      setStatus('Transação reconciliada com sucesso.');
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
      setStatus('Seleciona um payment intent para o refund.');
      return;
    }

    if (reason.length < 3) {
      setStatus('Motivo do refund deve ter pelo menos 3 caracteres.');
      return;
    }

    let parsedAmount: number | undefined;
    if (refundAmount.trim().length > 0) {
      const numericAmount = Number(refundAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setStatus('Valor do refund deve ser um número positivo.');
        return;
      }

      parsedAmount = Math.trunc(numericAmount);
    }

    setRunningCriticalAction(true);
    setStatus('A criar refund...');

    try {
      const refund = await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          createAdminRefund(
            accessToken,
            {
              paymentIntentId: refundIntentId,
              reason,
              ...(typeof parsedAmount === 'number' ? { amount: parsedAmount } : {}),
            },
            { reauthToken },
          ),
      });

      setStatus(`Refund ${refund.id.slice(0, 8)} criado com estado ${refund.status}.`);
      setRefundAmount('');
      await loadDashboard(accessToken);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao criar refund.'));
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
      setStatus('Indica o jobId para libertação de fundos.');
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
        `Fundos libertados: ${formatCurrencyMzn(result.releasedAmount)} para intent ${result.paymentIntentId.slice(0, 8)}.`,
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

    if (!normalizedIntentId) {
      setStatus('Indica o paymentIntentId para criar payout.');
      return;
    }

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
              paymentIntentId: normalizedIntentId,
              amount: Math.trunc(amount),
            },
            { reauthToken },
          ),
      });

      setStatus(`Payout ${payout.id.slice(0, 8)} criado com estado ${payout.status}.`);
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
    <main className='shell'>
      <section className='card card--wide'>
        <header className='header'>
          <p className='kicker'>Admin Financeiro</p>
          <h1>Operação de Pagamentos</h1>
          <p className='subtitle'>
            Monitoriza intents, transações pendentes, refunds, payouts e executa
            ações críticas com reautenticação no mesmo painel.
          </p>
        </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='metric-label'>Intents</p>
              <p className='metric-value'>{overview?.kpis.totalIntents ?? 0}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Pendentes</p>
              <p className='metric-value'>
                {overview?.kpis.intentsAwaitingPayment ?? 0}
              </p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Platform Reserved</p>
              <p className='metric-value'>
                {formatCurrencyMzn(overview?.kpis.platformReserved ?? 0)}
              </p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Provider Held</p>
              <p className='metric-value'>
                {formatCurrencyMzn(overview?.kpis.providerHeld ?? 0)}
              </p>
            </article>
          </div>

          <div className='actions actions--inline'>
            <button
              type='button'
              className='primary'
              onClick={() => {
                void handleReconcilePendingBatch();
              }}
              disabled={runningReconcile || runningCriticalAction}
            >
              {runningReconcile
                ? 'A reconciliar...'
                : 'Reconciliar pendentes em lote'}
            </button>
            <button
              type='button'
              onClick={() => {
                void loadDashboard();
              }}
              disabled={loading || runningCriticalAction}
            >
              Recarregar painel
            </button>
          </div>

          <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

          <section>
            <p className='item-title'>Ações críticas (reauth)</p>
            <div className='list'>
              <article className='list-item'>
                <p className='item-title'>Criar refund</p>
                <div className='form'>
                  <label>
                    Payment intent
                    <select
                      value={refundIntentId}
                      onChange={(event) => setRefundIntentId(event.target.value)}
                    >
                      <option value=''>Seleciona intent</option>
                      {intents.map((intent) => (
                        <option key={intent.id} value={intent.id}>
                          {intent.id.slice(0, 8)} | {intent.status} |{' '}
                          {formatCurrencyMzn(intent.amount)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Valor (opcional)
                    <input
                      type='number'
                      min={1}
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                    />
                  </label>

                  <label>
                    Motivo
                    <input
                      type='text'
                      minLength={3}
                      maxLength={240}
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                    />
                  </label>

                  <div className='actions actions--inline'>
                    <button
                      type='button'
                      className='primary'
                      onClick={() => {
                        void handleCreateRefund();
                      }}
                      disabled={runningCriticalAction}
                    >
                      Criar refund
                    </button>
                  </div>
                </div>
              </article>

              <article className='list-item'>
                <p className='item-title'>Libertar fundos (job completo)</p>
                <div className='form'>
                  <label>
                    Job ID
                    <input
                      type='text'
                      value={releaseJobId}
                      onChange={(event) => setReleaseJobId(event.target.value)}
                      placeholder='jobId'
                    />
                  </label>

                  <div className='actions actions--inline'>
                    <button
                      type='button'
                      className='primary'
                      onClick={() => {
                        void handleReleaseFunds();
                      }}
                      disabled={runningCriticalAction}
                    >
                      Libertar fundos
                    </button>
                  </div>
                </div>
              </article>

              <article className='list-item'>
                <p className='item-title'>Criar payout</p>
                <div className='form'>
                  <label>
                    Payment intent
                    <select
                      value={payoutIntentId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setPayoutIntentId(nextId);

                        const selectedIntent = intents.find(
                          (intent) => intent.id === nextId,
                        );

                        if (selectedIntent) {
                          setPayoutProviderUserId(selectedIntent.providerUserId ?? '');
                          setPayoutAmount(
                            String(Math.max(1, selectedIntent.providerNetAmount)),
                          );
                        }
                      }}
                    >
                      <option value=''>Seleciona intent</option>
                      {intents.map((intent) => (
                        <option key={intent.id} value={intent.id}>
                          {intent.id.slice(0, 8)} | prov:{' '}
                          {intent.providerUserId?.slice(0, 8) ?? 'n/a'} | net:{' '}
                          {formatCurrencyMzn(intent.providerNetAmount)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Provider user ID
                    <input
                      type='text'
                      value={payoutProviderUserId}
                      onChange={(event) => setPayoutProviderUserId(event.target.value)}
                    />
                  </label>

                  <label>
                    Valor
                    <input
                      type='number'
                      min={1}
                      value={payoutAmount}
                      onChange={(event) => setPayoutAmount(event.target.value)}
                    />
                  </label>

                  <div className='actions actions--inline'>
                    <button
                      type='button'
                      className='primary'
                      onClick={() => {
                        void handleCreatePayout();
                      }}
                      disabled={runningCriticalAction}
                    >
                      Criar payout
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section>
            <p className='item-title'>Transações pendentes/processando</p>
            {pendingTransactions.length === 0 ? (
              <p className='muted'>Sem transações pendentes no momento.</p>
            ) : (
              <div className='list'>
                {pendingTransactions.map((transaction) => (
                  <article key={transaction.id} className='list-item'>
                    <p className='item-title'>
                      {transaction.type} #{transaction.id.slice(0, 8)}
                      <span className='status-pill is-muted'>{transaction.status}</span>
                    </p>
                    <p>
                      <strong>Provider:</strong> {transaction.provider}
                    </p>
                    <p>
                      <strong>Valor:</strong>{' '}
                      {formatCurrencyMzn(transaction.requestedAmount)}
                    </p>
                    <p>
                      <strong>Referência:</strong>{' '}
                      {transaction.providerReference ?? 'n/a'}
                    </p>

                    <div className='actions actions--inline'>
                      <button
                        type='button'
                        onClick={() => {
                          void handleReconcileTransaction(transaction.id);
                        }}
                        disabled={runningReconcile || runningCriticalAction}
                      >
                        Reconciliar transação
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className='item-title'>Intents recentes</p>
            {intents.length === 0 ? (
              <p className='muted'>Sem intents registados ainda.</p>
            ) : (
              <div className='list'>
                {intents.map((intent) => (
                  <article key={intent.id} className='list-item'>
                    <p className='item-title'>
                      Intent #{intent.id.slice(0, 8)}
                      <span className='status-pill is-muted'>{intent.status}</span>
                    </p>
                    <p>
                      <strong>Job:</strong> {intent.jobId.slice(0, 8)}
                    </p>
                    <p>
                      <strong>Provider:</strong> {intent.provider}
                    </p>
                    <p>
                      <strong>Valor:</strong> {formatCurrencyMzn(intent.amount)}
                    </p>

                    <div className='actions actions--inline'>
                      <button
                        type='button'
                        onClick={() => {
                          setRefundIntentId(intent.id);
                          setStatus(
                            `Intent ${intent.id.slice(0, 8)} selecionado para refund.`,
                          );
                        }}
                      >
                        Usar em refund
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          setPayoutIntentId(intent.id);
                          setPayoutProviderUserId(intent.providerUserId ?? '');
                          setPayoutAmount(String(Math.max(1, intent.providerNetAmount)));
                          setReleaseJobId(intent.jobId);
                          setStatus(
                            `Intent ${intent.id.slice(0, 8)} carregado para payout/release.`,
                          );
                        }}
                      >
                        Usar em payout/release
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className='item-title'>Refunds e payouts</p>
            <div className='list'>
              <article className='list-item'>
                <p className='item-title'>Refunds</p>
                {refunds.length === 0 ? (
                  <p className='muted'>Sem refunds em aberto.</p>
                ) : (
                  refunds.map((refund) => (
                    <p key={refund.id}>
                      {refund.id.slice(0, 8)} | {refund.status} |{' '}
                      {formatCurrencyMzn(refund.amount)}
                    </p>
                  ))
                )}
              </article>

              <article className='list-item'>
                <p className='item-title'>Payouts</p>
                {payouts.length === 0 ? (
                  <p className='muted'>Sem payouts em aberto.</p>
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className='result'>
                      <p>
                        {payout.id.slice(0, 8)} | {payout.status} |{' '}
                        {formatCurrencyMzn(payout.amount)}
                      </p>

                      <div className='actions actions--inline'>
                        {payout.status === 'PENDING' ? (
                          <button
                            type='button'
                            onClick={() => {
                              void handleApprovePayout(payout.id);
                            }}
                            disabled={runningCriticalAction}
                          >
                            Aprovar payout
                          </button>
                        ) : null}

                        {payout.status === 'APPROVED' ? (
                          <button
                            type='button'
                            className='primary'
                            onClick={() => {
                              void handleProcessPayout(payout.id);
                            }}
                            disabled={runningCriticalAction}
                          >
                            Processar payout
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </article>
            </div>
          </section>

        <div className='actions actions--inline'>
          <Link href='/admin' className='primary primary--ghost'>
            Voltar ao painel admin
          </Link>
          <Link href='/admin/audit' className='primary primary--ghost'>
            Ver trilha de auditoria
          </Link>
        </div>
      </section>
    </main>
  );
}
