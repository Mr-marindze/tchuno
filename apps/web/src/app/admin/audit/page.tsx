'use client';

import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  listAdminPaymentTransactions,
  listAdminPayouts,
  listAdminRefundRequests,
  PaymentTransaction,
  Payout,
  RefundRequest,
} from '@/lib/payments';

export default function AdminAuditPage() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar trilha de auditoria...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar trilha de auditoria...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setTransactions([]);
            setRefunds([]);
            setPayouts([]);
          }
          return;
        }

        const [txResponse, refundResponse, payoutResponse] = await Promise.all([
          listAdminPaymentTransactions(session.auth.accessToken, {
            page: 1,
            limit: 20,
          }),
          listAdminRefundRequests(session.auth.accessToken, {
            page: 1,
            limit: 20,
          }),
          listAdminPayouts(session.auth.accessToken, {
            page: 1,
            limit: 20,
          }),
        ]);

        if (!active) {
          return;
        }

        setTransactions(txResponse.data);
        setRefunds(refundResponse.data);
        setPayouts(payoutResponse.data);
        setStatus('Trilha de auditoria carregada.');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar auditoria.'));
        setTransactions([]);
        setRefunds([]);
        setPayouts([]);
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

  return (
    <main className='shell'>
      <section className='card card--wide'>
        <header className='header'>
          <p className='kicker'>Admin</p>
          <h1>Audit</h1>
          <p className='subtitle'>
            Eventos recentes de transações, refunds e payouts para rastreabilidade operacional.
          </p>
        </header>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        <div className='panel-grid'>
          <article className='list-item'>
            <p className='item-title'>Transações</p>
            {transactions.length === 0 ? (
              <p className='muted'>Sem transações recentes.</p>
            ) : (
              transactions.slice(0, 10).map((item) => (
                <p key={item.id}>
                  {item.id.slice(0, 8)} | {item.type} | {item.status}
                </p>
              ))
            )}
          </article>

          <article className='list-item'>
            <p className='item-title'>Refunds</p>
            {refunds.length === 0 ? (
              <p className='muted'>Sem refunds recentes.</p>
            ) : (
              refunds.slice(0, 10).map((item) => (
                <p key={item.id}>
                  {item.id.slice(0, 8)} | {item.status} | {item.amount} {item.currency}
                </p>
              ))
            )}
          </article>

          <article className='list-item'>
            <p className='item-title'>Payouts</p>
            {payouts.length === 0 ? (
              <p className='muted'>Sem payouts recentes.</p>
            ) : (
              payouts.slice(0, 10).map((item) => (
                <p key={item.id}>
                  {item.id.slice(0, 8)} | {item.status} | {item.amount} {item.currency}
                </p>
              ))
            )}
          </article>
        </div>

        <div className='actions actions--inline'>
          <a href='/admin/payments' className='primary'>
            Abrir payments
          </a>
          <a href='/admin/users' className='primary primary--ghost'>
            Abrir users
          </a>
        </div>
      </section>
    </main>
  );
}
