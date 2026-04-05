'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  listOpenServiceRequests,
  ServiceRequest,
} from '@/lib/service-requests';

type ProposalItem = {
  requestId: string;
  requestTitle: string;
  requestLocation: string | null;
  proposalId: string;
  price: number;
  status: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ProviderProposalsPage() {
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar propostas enviadas...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar propostas enviadas...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
            setItems([]);
          }
          return;
        }

        const response = await listOpenServiceRequests(session.auth.accessToken, {
          status: 'OPEN',
          page: 1,
          limit: 50,
        });

        if (!active) {
          return;
        }

        const proposals: ProposalItem[] = [];

        response.data.forEach((request: ServiceRequest) => {
          (request.proposals ?? []).forEach((proposal) => {
            proposals.push({
              requestId: request.id,
              requestTitle: request.title,
              requestLocation: request.location,
              proposalId: proposal.id,
              price: proposal.price,
              status: proposal.status,
              comment: proposal.comment ?? null,
              createdAt: proposal.createdAt,
              updatedAt: proposal.updatedAt ?? proposal.createdAt,
            });
          });
        });

        proposals.sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        );

        setItems(proposals);
        setStatus(
          proposals.length > 0
            ? `Encontradas ${proposals.length} proposta(s) enviadas.`
            : 'Ainda não enviaste propostas para pedidos abertos.',
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar propostas.'));
        setItems([]);
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

  const selectedCount = useMemo(
    () => items.filter((item) => item.status === 'SELECTED').length,
    [items],
  );

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Prestador</p>
          <h1>Propostas</h1>
          <p className='subtitle'>
            Histórico das tuas propostas em pedidos abertos no fluxo oficial.
          </p>
        </header>

        <div className='flow-summary'>
          <article className='flow-summary-item'>
            <p className='item-label'>Propostas listadas</p>
            <p className='item-title'>{items.length}</p>
          </article>
          <article className='flow-summary-item'>
            <p className='item-label'>Selecionadas</p>
            <p className='item-title'>{selectedCount}</p>
          </article>
        </div>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        {items.length === 0 ? (
          <p className='muted'>Sem propostas enviadas para pedidos em aberto.</p>
        ) : (
          <div className='list'>
            {items.map((item) => (
              <article key={item.proposalId} className='list-item'>
                <p className='item-title'>
                  {item.requestTitle}
                  <span className='badge badge--neutral'>{item.status}</span>
                </p>
                <p>
                  <strong>Pedido:</strong> {item.requestId.slice(0, 8)}
                </p>
                <p>
                  <strong>Local:</strong> {item.requestLocation ?? 'n/a'}
                </p>
                <p>
                  <strong>Valor proposto:</strong> {formatCurrencyMzn(item.price)}
                </p>
                <p>
                  <strong>Comentário:</strong> {item.comment ?? 'Sem comentário'}
                </p>
                <p>
                  <strong>Atualizada:</strong>{' '}
                  {new Date(item.updatedAt).toLocaleString('pt-PT')}
                </p>
                <div className='actions actions--inline'>
                  <Link href='/pro/pedidos' className='primary primary--ghost'>
                    Ver pedido aberto
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
