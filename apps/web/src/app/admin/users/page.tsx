'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { listAdminPaymentIntents, listAdminPayouts } from '@/lib/payments';

type UserRow = {
  userId: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'MULTI_ROLE';
  status: 'ACTIVE' | 'LOW_ACTIVITY';
  lastActivity: string;
  intentsCount: number;
  payoutsCount: number;
};

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar utilizadores...');
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar utilizadores...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setRows([]);
          }
          return;
        }

        const [intentsResponse, payoutsResponse] = await Promise.all([
          listAdminPaymentIntents(session.auth.accessToken, {
            page: 1,
            limit: 200,
          }),
          listAdminPayouts(session.auth.accessToken, {
            page: 1,
            limit: 200,
          }),
        ]);

        if (!active) {
          return;
        }

        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const userMap = new Map<
          string,
          {
            roles: Set<'CUSTOMER' | 'PROVIDER'>;
            intentsCount: number;
            payoutsCount: number;
            lastActivityTs: number;
          }
        >();

        intentsResponse.data.forEach((intent) => {
          const customerRecord = userMap.get(intent.customerId) ?? {
            roles: new Set(),
            intentsCount: 0,
            payoutsCount: 0,
            lastActivityTs: 0,
          };
          customerRecord.roles.add('CUSTOMER');
          customerRecord.intentsCount += 1;
          customerRecord.lastActivityTs = Math.max(
            customerRecord.lastActivityTs,
            new Date(intent.updatedAt).getTime(),
          );
          userMap.set(intent.customerId, customerRecord);

          if (intent.providerUserId) {
            const providerRecord = userMap.get(intent.providerUserId) ?? {
              roles: new Set(),
              intentsCount: 0,
              payoutsCount: 0,
              lastActivityTs: 0,
            };
            providerRecord.roles.add('PROVIDER');
            providerRecord.intentsCount += 1;
            providerRecord.lastActivityTs = Math.max(
              providerRecord.lastActivityTs,
              new Date(intent.updatedAt).getTime(),
            );
            userMap.set(intent.providerUserId, providerRecord);
          }
        });

        payoutsResponse.data.forEach((payout) => {
          const providerRecord = userMap.get(payout.providerUserId) ?? {
            roles: new Set(),
            intentsCount: 0,
            payoutsCount: 0,
            lastActivityTs: 0,
          };
          providerRecord.roles.add('PROVIDER');
          providerRecord.payoutsCount += 1;
          providerRecord.lastActivityTs = Math.max(
            providerRecord.lastActivityTs,
            new Date(payout.updatedAt).getTime(),
          );
          userMap.set(payout.providerUserId, providerRecord);
        });

        const nextRows: UserRow[] = Array.from(userMap.entries()).map(
          ([userId, record]) => {
            const role =
              record.roles.size > 1
                ? 'MULTI_ROLE'
                : (Array.from(record.roles)[0] ?? 'CUSTOMER');
            const statusTone =
              now - record.lastActivityTs <= ninetyDaysMs ? 'ACTIVE' : 'LOW_ACTIVITY';

            return {
              userId,
              role,
              status: statusTone,
              lastActivity: new Date(record.lastActivityTs).toISOString(),
              intentsCount: record.intentsCount,
              payoutsCount: record.payoutsCount,
            };
          },
        );

        nextRows.sort(
          (left, right) =>
            new Date(right.lastActivity).getTime() -
            new Date(left.lastActivity).getTime(),
        );

        setRows(nextRows);
        setStatus(
          nextRows.length > 0
            ? `Listados ${nextRows.length} utilizador(es) com atividade financeira.`
            : 'Sem atividade financeira de utilizadores.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar utilizadores.'));
          setRows([]);
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
    return rows.reduce(
      (acc, row) => {
        if (row.role === 'CUSTOMER') {
          acc.customers += 1;
        }
        if (row.role === 'PROVIDER') {
          acc.providers += 1;
        }
        if (row.role === 'MULTI_ROLE') {
          acc.multiRole += 1;
        }
        return acc;
      },
      { customers: 0, providers: 0, multiRole: 0 },
    );
  }, [rows]);

  async function handleCopyUserId(userId: string) {
    try {
      if (!navigator.clipboard) {
        setStatus('Clipboard não disponível neste browser.');
        return;
      }

      await navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      setStatus(`ID ${shortId(userId)} copiado para clipboard.`);

      window.setTimeout(() => {
        setCopiedUserId((current) => (current === userId ? null : current));
      }, 1500);
    } catch {
      setStatus('Falha ao copiar ID do utilizador.');
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Utilizadores</h1>
        <p className='mt-1 text-sm text-slate-600'>
          Lista operacional de utilizadores com atividade financeira recente.
        </p>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <SummaryCard label='Clientes' value={summary.customers} />
          <SummaryCard label='Prestadores' value={summary.providers} />
          <SummaryCard label='Multi-role' value={summary.multiRole} />
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      {rows.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Sem utilizadores para mostrar.
        </section>
      ) : (
        <section className='space-y-3'>
          {rows.map((row) => (
            <article
              key={row.userId}
              className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <p className='font-semibold text-slate-900'>{shortId(row.userId)}</p>
                  <p>
                    <strong>Role:</strong> {row.role}
                  </p>
                  <p>
                    <strong>Estado:</strong>{' '}
                    {row.status === 'ACTIVE' ? 'Ativo' : 'Baixa atividade'}
                  </p>
                  <p>
                    <strong>Última atividade:</strong>{' '}
                    {new Date(row.lastActivity).toLocaleString('pt-PT')}
                  </p>
                  <p className='text-xs text-slate-500'>
                    Intents: {row.intentsCount} · Payouts: {row.payoutsCount}
                  </p>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    type='button'
                    className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                    onClick={() => {
                      void handleCopyUserId(row.userId);
                    }}
                  >
                    {copiedUserId === row.userId ? 'Copiado' : 'Copiar ID'}
                  </button>
                  <Link
                    href='/admin/payments'
                    className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                  >
                    Ver pagamentos
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function SummaryCard(input: { label: string; value: number }) {
  return (
    <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
      <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>
        {input.label}
      </p>
      <p className='mt-1 text-lg font-semibold text-slate-900'>{input.value}</p>
    </article>
  );
}
