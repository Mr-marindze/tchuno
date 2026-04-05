'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { listMyWorkerJobs } from '@/lib/jobs';
import {
  listOpenServiceRequests,
  listRequestProposals,
  ServiceRequest,
} from '@/lib/service-requests';

type ProposalCard = {
  proposalId: string;
  requestId: string;
  requestTitle: string;
  requestLocation: string | null;
  requestCategory: string | null;
  price: number;
  comment: string | null;
  status: string;
  updatedAt: string;
};

type ProposalGroups = {
  awaiting: ProposalCard[];
  selected: ProposalCard[];
  rejected: ProposalCard[];
};

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function sortByDateDesc(items: ProposalCard[]): ProposalCard[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export default function ProviderProposalsPage() {
  const [groups, setGroups] = useState<ProposalGroups>({
    awaiting: [],
    selected: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar propostas...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar propostas...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setGroups({ awaiting: [], selected: [], rejected: [] });
          }
          return;
        }

        const token = session.auth.accessToken;
        const providerUserId = session.auth.user.id;

        const [open, closed, expired, jobsResponse] = await Promise.all([
          listOpenServiceRequests(token, {
            status: 'OPEN',
            page: 1,
            limit: 50,
          }),
          listOpenServiceRequests(token, {
            status: 'CLOSED',
            page: 1,
            limit: 50,
          }),
          listOpenServiceRequests(token, {
            status: 'EXPIRED',
            page: 1,
            limit: 50,
          }),
          listMyWorkerJobs(token, {
            page: 1,
            limit: 50,
          }),
        ]);

        if (!active) {
          return;
        }

        const requestsById = new Map<string, ServiceRequest>();
        [...open.data, ...closed.data, ...expired.data].forEach((request) => {
          requestsById.set(request.id, request);
        });

        const requestEntries = Array.from(requestsById.values());
        const requestProposals = await Promise.all(
          requestEntries.map(async (request) => {
            try {
              const proposals = await listRequestProposals(token, request.id);
              return {
                request,
                proposals: proposals.filter(
                  (proposal) => proposal.providerId === providerUserId,
                ),
              };
            } catch {
              return {
                request,
                proposals: [],
              };
            }
          }),
        );

        if (!active) {
          return;
        }

        const cardsByProposalId = new Map<string, ProposalCard>();
        requestProposals.forEach(({ request, proposals }) => {
          proposals.forEach((proposal) => {
            cardsByProposalId.set(proposal.id, {
              proposalId: proposal.id,
              requestId: request.id,
              requestTitle: request.title,
              requestLocation: request.location,
              requestCategory: request.category?.name ?? null,
              price: proposal.price,
              comment: proposal.comment ?? null,
              status: proposal.status,
              updatedAt: proposal.updatedAt ?? proposal.createdAt,
            });
          });
        });

        jobsResponse.data.forEach((job) => {
          if (!job.proposalId || cardsByProposalId.has(job.proposalId)) {
            return;
          }

          cardsByProposalId.set(job.proposalId, {
            proposalId: job.proposalId,
            requestId: job.requestId ?? 'n/d',
            requestTitle: job.title,
            requestLocation: null,
            requestCategory: null,
            price: job.agreedPrice ?? job.budget ?? 0,
            comment: 'Proposta já convertida em job.',
            status: 'SELECTED',
            updatedAt: job.updatedAt,
          });
        });

        const allCards = Array.from(cardsByProposalId.values());
        const nextGroups: ProposalGroups = {
          awaiting: sortByDateDesc(
            allCards.filter((card) => card.status === 'SUBMITTED'),
          ),
          selected: sortByDateDesc(
            allCards.filter((card) => card.status === 'SELECTED'),
          ),
          rejected: sortByDateDesc(
            allCards.filter((card) => card.status === 'REJECTED'),
          ),
        };

        setGroups(nextGroups);
        const total =
          nextGroups.awaiting.length +
          nextGroups.selected.length +
          nextGroups.rejected.length;

        setStatus(
          total > 0
            ? `Encontradas ${total} proposta(s) enviadas.`
            : 'Ainda não tens propostas registadas.',
        );
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar propostas.'));
          setGroups({ awaiting: [], selected: [], rejected: [] });
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

  const total = useMemo(
    () => groups.awaiting.length + groups.selected.length + groups.rejected.length,
    [groups],
  );

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Propostas</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Acompanha as propostas em espera, selecionadas e rejeitadas.
            </p>
          </div>
          <Link
            href='/pro/pedidos'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Voltar aos pedidos
          </Link>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <article className='rounded-xl border border-blue-200 bg-blue-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-blue-700'>
              Aguardando
            </p>
            <p className='mt-1 text-lg font-semibold text-blue-700'>
              {groups.awaiting.length}
            </p>
          </article>
          <article className='rounded-xl border border-emerald-200 bg-emerald-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-emerald-700'>
              Selecionadas
            </p>
            <p className='mt-1 text-lg font-semibold text-emerald-700'>
              {groups.selected.length}
            </p>
          </article>
          <article className='rounded-xl border border-rose-200 bg-rose-50 p-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-rose-700'>
              Rejeitadas
            </p>
            <p className='mt-1 text-lg font-semibold text-rose-700'>
              {groups.rejected.length}
            </p>
          </article>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
          {total > 0 ? ` (${total} total)` : ''}
        </p>
      </section>

      <ProposalSection
        title='Aguardando'
        subtitle='Propostas em análise pelo cliente.'
        emptyLabel='Sem propostas aguardando.'
        items={groups.awaiting}
        badgeClass='bg-blue-100 text-blue-700'
      />

      <ProposalSection
        title='Selecionadas'
        subtitle='Propostas escolhidas e potencialmente já convertidas em job.'
        emptyLabel='Sem propostas selecionadas.'
        items={groups.selected}
        badgeClass='bg-emerald-100 text-emerald-700'
      />

      <ProposalSection
        title='Rejeitadas'
        subtitle='Propostas não selecionadas.'
        emptyLabel='Sem propostas rejeitadas.'
        items={groups.rejected}
        badgeClass='bg-rose-100 text-rose-700'
      />
    </main>
  );
}

function ProposalSection(input: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  items: ProposalCard[];
  badgeClass: string;
}) {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
      <h2 className='text-lg font-semibold text-slate-900'>{input.title}</h2>
      <p className='mt-1 text-sm text-slate-600'>{input.subtitle}</p>

      {input.items.length === 0 ? (
        <p className='mt-3 text-sm text-slate-500'>{input.emptyLabel}</p>
      ) : (
        <div className='mt-3 space-y-3'>
          {input.items.map((item) => (
            <article
              key={item.proposalId}
              className='rounded-xl border border-slate-200 bg-slate-50 p-3'
            >
              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <p className='font-semibold text-slate-900'>{item.requestTitle}</p>
                  <p>
                    <strong>Preço:</strong> {formatCurrencyMzn(item.price)}
                  </p>
                  <p>
                    <strong>Comentário:</strong> {item.comment ?? 'Sem comentário'}
                  </p>
                  <p className='text-xs text-slate-500'>
                    {item.requestCategory ? `${item.requestCategory} · ` : ''}
                    {item.requestLocation ?? 'Local n/d'}
                  </p>
                  <p className='text-xs text-slate-500'>
                    Atualizada em {new Date(item.updatedAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${input.badgeClass}`}
                >
                  {item.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
