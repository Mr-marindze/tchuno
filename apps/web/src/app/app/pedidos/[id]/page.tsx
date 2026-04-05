'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/access/route-guard';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';
import { getJobById, JobDetails } from '@/lib/jobs';
import {
  getJobFinancialState,
  JobFinancialState,
  payPaymentIntent,
} from '@/lib/payments';
import { getServiceRequestById, ServiceRequest } from '@/lib/service-requests';

const payableIntentStatuses = new Set([
  'AWAITING_PAYMENT',
  'PENDING_CONFIRMATION',
  'FAILED',
]);

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const requestId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [financial, setFinancial] = useState<JobFinancialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState('A carregar detalhes do pedido...');

  async function loadDetails(tokenOverride?: string) {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setStatus('Sessão inválida. Faz login novamente.');
      setRequest(null);
      setJobDetails(null);
      setFinancial(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatus('A carregar detalhes do pedido...');

    try {
      const detail = await getServiceRequestById(token, requestId);
      setRequest(detail);

      if (detail.job?.id) {
        const [nextJobDetails, nextFinancial] = await Promise.all([
          getJobById(token, detail.job.id),
          getJobFinancialState(token, detail.job.id),
        ]);

        setJobDetails(nextJobDetails);
        setFinancial(nextFinancial);

        if (nextJobDetails.contactUnlocked) {
          setStatus(
            'Contacto desbloqueado. Já podes coordenar execução com o prestador.',
          );
        } else {
          setStatus(
            'Contacto ainda protegido. Finaliza o pagamento do sinal para desbloquear.',
          );
        }
      } else {
        setJobDetails(null);
        setFinancial(null);
        setStatus(
          'Ainda sem job criado. Seleciona uma proposta no pedido para iniciar execução.',
        );
      }
    } catch (error) {
      setRequest(null);
      setJobDetails(null);
      setFinancial(null);
      setStatus(humanizeUnknownError(error, 'Falha ao carregar o pedido.'));
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
        setAccessToken(null);
        setStatus('Sessão inválida. Faz login novamente.');
        setLoading(false);
        return;
      }

      setAccessToken(session.auth.accessToken);
      await loadDetails(session.auth.accessToken);
    }

    void bootstrap();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const payableIntent = useMemo(() => {
    if (!financial) {
      return null;
    }

    return (
      financial.intents.find((intent) => payableIntentStatuses.has(intent.status)) ??
      null
    );
  }, [financial]);

  function formatCurrencyMzn(value: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'MZN',
      maximumFractionDigits: 0,
    }).format(value);
  }

  async function handlePayDeposit() {
    if (!accessToken || !payableIntent) {
      setStatus('Nenhum pagamento pendente para este pedido.');
      return;
    }

    setPaying(true);
    setStatus('A processar pagamento do sinal...');

    try {
      await payPaymentIntent(accessToken, payableIntent.id, {
        ...(payableIntent.provider === 'INTERNAL' ? { simulate: 'success' } : {}),
      });

      await loadDetails(accessToken);
      setStatus(
        'Pagamento processado. Estado financeiro atualizado para este pedido.',
      );
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao processar pagamento.'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <RouteGuard requiredAccess='customer'>
      <main className='shell'>
        <section className='card card--wide'>
          <header className='header'>
            <p className='kicker'>Pedido</p>
            <h1>Detalhe do Pedido</h1>
            <p className='subtitle'>
              Acompanha propostas, seleção, estado financeiro e desbloqueio de
              contacto.
            </p>
          </header>

          <div className='flow-summary'>
            <article className='flow-summary-item'>
              <p className='metric-label'>Request ID</p>
              <p className='metric-value'>{request?.id.slice(0, 8) ?? '...'}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Propostas</p>
              <p className='metric-value'>{request?.proposals?.length ?? 0}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Job</p>
              <p className='metric-value'>{request?.job?.status ?? 'Pendente'}</p>
            </article>
            <article className='flow-summary-item'>
              <p className='metric-label'>Pagamento</p>
              <p className='metric-value'>
                {payableIntent?.status ?? financial?.paymentState ?? 'n/a'}
              </p>
            </article>
          </div>

          <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

          {!request ? null : (
            <article className='list-item'>
              <p className='item-title'>
                {request.title}
                <span className='status-pill is-muted'>{request.status}</span>
              </p>
              <p>{request.description}</p>
              <p>
                <strong>Local:</strong> {request.location ?? 'n/a'}
              </p>
              <p>
                <strong>Categoria:</strong> {request.category?.name ?? request.categoryId}
              </p>
              <p>
                <strong>Criado:</strong>{' '}
                {new Date(request.createdAt).toLocaleString('pt-PT')}
              </p>
            </article>
          )}

          {request?.proposals?.length ? (
            <section>
              <p className='item-title'>Propostas recebidas</p>
              <div className='list'>
                {request.proposals.map((proposal) => (
                  <article key={proposal.id} className='list-item'>
                    <p className='item-title'>
                      Prestador {proposal.provider?.name ?? proposal.providerId.slice(0, 8)}
                      <span className='status-pill is-muted'>{proposal.status}</span>
                    </p>
                    <p>
                      <strong>Preço:</strong> {formatCurrencyMzn(proposal.price)}
                    </p>
                    <p>
                      <strong>Comentário:</strong> {proposal.comment ?? 'Sem comentário'}
                    </p>
                    <p>
                      <strong>Rating:</strong>{' '}
                      {proposal.provider?.workerProfile
                        ? `${proposal.provider.workerProfile.ratingAvg} (${proposal.provider.workerProfile.ratingCount})`
                        : 'n/a'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {request?.job ? (
            <section>
              <p className='item-title'>Execução e contacto</p>
              <div className='list'>
                <article className='list-item'>
                  <p>
                    <strong>Job ID:</strong> {request.job.id}
                  </p>
                  <p>
                    <strong>Estado do job:</strong> {request.job.status}
                  </p>
                  <p>
                    <strong>Preço acordado:</strong>{' '}
                    {request.job.agreedPrice
                      ? formatCurrencyMzn(request.job.agreedPrice)
                      : 'n/a'}
                  </p>
                  <p>
                    <strong>Contacto:</strong>{' '}
                    {jobDetails?.contactUnlocked ? 'Desbloqueado' : 'Protegido'}
                  </p>
                  {jobDetails?.contactUnlocked ? (
                    <p className='status status--success'>
                      Prestador:{' '}
                      {jobDetails.providerContact?.name ?? 'Sem nome'} |{' '}
                      {jobDetails.providerContact?.email ?? 'Sem email'}
                    </p>
                  ) : (
                    <p className='muted'>
                      Contacto direto permanece bloqueado até confirmação de sinal.
                    </p>
                  )}

                  {payableIntent ? (
                    <div className='actions actions--inline'>
                      <button
                        type='button'
                        className='primary'
                        onClick={() => {
                          void handlePayDeposit();
                        }}
                        disabled={paying}
                      >
                        {paying
                          ? 'A processar...'
                          : `Pagar sinal (${formatCurrencyMzn(payableIntent.amount)})`}
                      </button>
                    </div>
                  ) : null}
                </article>
              </div>
            </section>
          ) : null}

          <div className='actions actions--inline'>
            <Link href='/app/pedidos' className='primary'>
              Voltar aos pedidos
            </Link>
            <Link href='/app/mensagens' className='primary primary--ghost'>
              Mensagens e contacto
            </Link>
            <Link href='/app/pagamentos' className='primary primary--ghost'>
              Ver pagamentos
            </Link>
          </div>
        </section>
      </main>
    </RouteGuard>
  );
}
