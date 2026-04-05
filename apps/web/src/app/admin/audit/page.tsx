'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import {
  AdminAuditLog,
  AdminAuditStatus,
  listAdminAuditLogs,
} from '@/lib/admin-ops';
import { humanizeUnknownError } from '@/lib/http-errors';

const statusLabel: Record<AdminAuditStatus, string> = {
  SUCCESS: 'Sucesso',
  DENIED: 'Negado',
  FAILED: 'Falhou',
};

function statusBadgeClass(status: AdminAuditStatus): string {
  if (status === 'SUCCESS') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'DENIED') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-rose-100 text-rose-700';
}

export default function AdminAuditPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar auditoria...');

  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | AdminAuditStatus>('');

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setStatus('A carregar auditoria...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setAccessToken(null);
            setItems([]);
          }
          return;
        }

        if (!active) {
          return;
        }

        setAccessToken(session.auth.accessToken);
        await loadAudit(session.auth.accessToken, actionFilter, statusFilter);
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar auditoria.'));
          setItems([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAudit(
    token: string,
    action: string,
    auditStatus: '' | AdminAuditStatus,
  ) {
    setLoading(true);

    try {
      const response = await listAdminAuditLogs(token, {
        page: 1,
        limit: 40,
        action: action.trim() || undefined,
        status: auditStatus || undefined,
      });

      setItems(response.data);
      setStatus(
        response.data.length > 0
          ? `Encontrados ${response.data.length} evento(s) de auditoria.`
          : 'Sem eventos para os filtros aplicados.',
      );
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao filtrar auditoria.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    await loadAudit(accessToken, actionFilter, statusFilter);
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Auditoria</h1>
        <p className='mt-1 text-sm text-slate-600'>
          Eventos administrativos e de segurança para rastreabilidade.
        </p>

        <form className='mt-4 grid gap-3 sm:grid-cols-3' onSubmit={handleFilterSubmit}>
          <label className='space-y-1 text-sm text-slate-700'>
            <span>Ação</span>
            <input
              type='text'
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder='ex: admin.payments.refund'
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as '' | AdminAuditStatus)
              }
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            >
              <option value=''>Todos</option>
              <option value='SUCCESS'>Sucesso</option>
              <option value='DENIED'>Negado</option>
              <option value='FAILED'>Falhou</option>
            </select>
          </label>

          <div className='flex items-end'>
            <button
              type='submit'
              className='inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black'
            >
              Filtrar
            </button>
          </div>
        </form>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='space-y-3'>
        {items.length === 0 ? (
          <article className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
            Sem registos de auditoria para mostrar.
          </article>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
            >
              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <p className='font-semibold text-slate-900'>{item.action}</p>
                  <p>
                    <strong>Ator:</strong> {item.actorUserId ?? 'n/d'} (
                    {item.actorRole ?? 'n/d'})
                  </p>
                  <p>
                    <strong>Rota:</strong> {item.method} {item.route}
                  </p>
                  <p className='text-xs text-slate-500'>
                    {new Date(item.createdAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}
                >
                  {statusLabel[item.status]}
                </span>
              </div>

              {item.reason ? (
                <p className='mt-2 text-xs text-rose-700'>Motivo: {item.reason}</p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
