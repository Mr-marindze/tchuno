'use client';

import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  AdminTrustSafetyIntervention,
  listAdminTrustSafetyInterventions,
  reviewAdminTrustSafetyIntervention,
} from '@/lib/trust-safety';

function riskClass(riskLevel: string) {
  if (riskLevel === 'HIGH') {
    return 'bg-rose-100 text-rose-700';
  }

  if (riskLevel === 'MEDIUM') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function statusClass(status: string) {
  if (status === 'CLEARED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'ENFORCED') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'APPEALED') {
    return 'bg-blue-100 text-blue-700';
  }

  if (status === 'OPEN') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

export default function AdminModerationPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<AdminTrustSafetyIntervention[]>([]);
  const [summary, setSummary] = useState({
    openCount: 0,
    appealedCount: 0,
    highRiskCount: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [status, setStatus] = useState('A carregar fila de Trust & Safety...');

  async function loadQueue(tokenOverride?: string | null, nextStatus?: string) {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setItems([]);
      return;
    }

    const response = await listAdminTrustSafetyInterventions(token, {
      page: 1,
      limit: 50,
      status: nextStatus !== undefined ? nextStatus || undefined : statusFilter || undefined,
    });

    setItems(response.data);
    setSummary(response.summary);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar fila de Trust & Safety...');

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
        const response = await listAdminTrustSafetyInterventions(
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
        setSummary(response.summary);
        setStatus(
          response.data.length > 0
            ? `${response.summary.openCount} caso(s) em aberto e ${response.summary.appealedCount} em apelação.`
            : 'Sem casos de moderação neste momento.',
        );
      } catch (error) {
        if (active) {
          setStatus(
            humanizeUnknownError(error, 'Falha ao carregar fila de moderação.'),
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

  async function handleReview(
    interventionId: string,
    decision: 'CLEARED' | 'ENFORCED',
  ) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const defaultNote =
      decision === 'CLEARED'
        ? 'Conteúdo revisto e libertado pela equipa.'
        : 'Restrição confirmada após revisão manual.';
    const note =
      typeof window === 'undefined'
        ? defaultNote
        : window.prompt('Nota de revisão (opcional):', defaultNote)?.trim() ||
          defaultNote;

    setRunningId(interventionId);
    setStatus(
      decision === 'CLEARED'
        ? 'A libertar caso de moderação...'
        : 'A confirmar restrição de moderação...',
    );

    try {
      await reviewAdminTrustSafetyIntervention(accessToken, interventionId, {
        decision,
        resolutionNote: note,
      });
      await loadQueue(accessToken);
      setStatus(
        decision === 'CLEARED'
          ? 'Caso libertado com sucesso.'
          : 'Restrição confirmada com sucesso.',
      );
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao rever caso.'));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Trust & Safety</h1>
        <p className='mt-1 text-sm text-slate-600'>
          Fila de revisao para tentativas de fuga, partilha de contacto e apelações.
        </p>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <SummaryCard label='Em aberto' value={summary.openCount} />
          <SummaryCard label='Em apelação' value={summary.appealedCount} />
          <SummaryCard label='Alto risco' value={summary.highRiskCount} />
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
        <div className='flex flex-wrap gap-2'>
          {[
            ['', 'Todos'],
            ['OPEN', 'Abertos'],
            ['APPEALED', 'Apelações'],
            ['ENFORCED', 'Confirmados'],
            ['CLEARED', 'Liberados'],
          ].map(([value, label]) => (
            <button
              key={label}
              type='button'
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                statusFilter === value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => {
                setStatusFilter(value);
                void loadQueue(accessToken, value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {items.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Sem intervenções para mostrar com este filtro.
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
                    <p className='font-semibold text-slate-900'>{item.job.title}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass(
                        item.riskLevel,
                      )}`}
                    >
                      {item.riskLevel}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className='space-y-1 text-sm text-slate-600'>
                    <p>
                      <strong>Ator:</strong>{' '}
                      {item.actorUser.name ?? item.actorUser.email}
                    </p>
                    <p>
                      <strong>Contraparte:</strong>{' '}
                      {item.counterpartUser.name ?? item.counterpartUser.email}
                    </p>
                    <p>
                      <strong>Motivo:</strong> {item.reasonSummary}
                    </p>
                    <p>
                      <strong>Mensagem:</strong> &quot;{item.messagePreview}&quot;
                    </p>
                    <p>
                      <strong>Detetado em:</strong>{' '}
                      {new Date(item.createdAt).toLocaleString('pt-PT')}
                    </p>
                    {item.blockedUntil ? (
                      <p>
                        <strong>Restrição até:</strong>{' '}
                        {new Date(item.blockedUntil).toLocaleString('pt-PT')}
                      </p>
                    ) : null}
                    {item.appealReason ? (
                      <p>
                        <strong>Apelação:</strong> {item.appealReason}
                      </p>
                    ) : null}
                    {item.resolutionNote ? (
                      <p>
                        <strong>Nota:</strong> {item.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                </div>

                {['OPEN', 'APPEALED', 'ENFORCED'].includes(item.status) ? (
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                      onClick={() => {
                        void handleReview(item.id, 'CLEARED');
                      }}
                      disabled={runningId === item.id}
                    >
                      Liberar
                    </button>
                    <button
                      type='button'
                      className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60'
                      onClick={() => {
                        void handleReview(item.id, 'ENFORCED');
                      }}
                      disabled={runningId === item.id}
                    >
                      Confirmar restrição
                    </button>
                  </div>
                ) : null}
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
