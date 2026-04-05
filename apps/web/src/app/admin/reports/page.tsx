'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  AdminPaymentsOverview,
  getAdminPaymentsOverview,
  listAdminPaymentIntents,
  listAdminPaymentTransactions,
  listAdminPayouts,
  listAdminRefundRequests,
  PaymentIntent,
  PaymentTransaction,
  Payout,
  reconcileAdminPendingCharges,
  reconcileAdminTransaction,
  RefundRequest,
} from '@/lib/payments';

export default function AdminReportsPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminPaymentsOverview | null>(null);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar operação financeira...');
  const [runningReconcile, setRunningReconcile] = useState(false);

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
          listAdminPaymentIntents(token, { page: 1, limit: 10 }),
          listAdminPaymentTransactions(token, {
            page: 1,
            limit: 20,
            status: 'PROCESSING',
          }),
          listAdminRefundRequests(token, { page: 1, limit: 10 }),
          listAdminPayouts(token, { page: 1, limit: 10 }),
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

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
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

  return (
    <RouteGuard requiredAccess='admin'>
      <main className='shell'>
        <section className='card card--wide'>
          <header className='header'>
            <p className='kicker'>Admin Financeiro</p>
            <h1>Operação de Pagamentos</h1>
            <p className='subtitle'>
              Monitoriza intents, transações pendentes, refunds, payouts e aciona
              reconciliação sem sair da operação.
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
              disabled={runningReconcile}
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
              disabled={loading}
            >
              Recarregar painel
            </button>
          </div>

          <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

          <section>
            <p className='item-title'>Transações em processamento</p>
            {transactions.length === 0 ? (
              <p className='muted'>Sem transações em processamento no momento.</p>
            ) : (
              <div className='list'>
                {transactions.map((transaction) => (
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
                        disabled={runningReconcile}
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
                    <p key={payout.id}>
                      {payout.id.slice(0, 8)} | {payout.status} |{' '}
                      {formatCurrencyMzn(payout.amount)}
                    </p>
                  ))
                )}
              </article>
            </div>
          </section>

          <div className='actions actions--inline'>
            <Link href='/admin/orders' className='primary primary--ghost'>
              Voltar a operações
            </Link>
            <Link href='/admin' className='primary primary--ghost'>
              Painel admin
            </Link>
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
