'use client';

import { useEffect, useState } from 'react';
import { humanizeUnknownError } from '@/lib/http-errors';
import { updateJobStatus } from '@/lib/jobs';
import {
  cancelMyRefundRequest,
  createJobRefundRequest,
  JobFinancialState,
} from '@/lib/payments';

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function refundStatusLabel(status: string) {
  if (status === 'PENDING') {
    return 'Em análise';
  }

  if (status === 'APPROVED') {
    return 'Aprovado';
  }

  if (status === 'PROCESSING') {
    return 'Em processamento';
  }

  if (status === 'SUCCEEDED') {
    return 'Concluído';
  }

  if (status === 'FAILED') {
    return 'Recusado ou falhado';
  }

  if (status === 'CANCELED') {
    return 'Cancelado';
  }

  return status;
}

function refundStatusClass(status: string) {
  if (status === 'SUCCEEDED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'PENDING' || status === 'APPROVED' || status === 'PROCESSING') {
    return 'bg-amber-100 text-amber-700';
  }

  if (status === 'FAILED' || status === 'CANCELED') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function supportCaseStatusLabel(status: string) {
  if (status === 'OPEN') {
    return 'Aberto';
  }

  if (status === 'INVESTIGATING') {
    return 'Em investigação';
  }

  if (status === 'MITIGATING') {
    return 'Decisão em preparação';
  }

  if (status === 'MONITORING') {
    return 'Em acompanhamento';
  }

  if (status === 'RESOLVED') {
    return 'Encerrado';
  }

  if (status === 'CANCELED') {
    return 'Cancelado';
  }

  return status;
}

function supportCaseStatusClass(status: string) {
  if (status === 'RESOLVED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'CANCELED') {
    return 'bg-slate-100 text-slate-700';
  }

  if (status === 'MITIGATING') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'INVESTIGATING' || status === 'MONITORING') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function parseEvidenceItems(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    .slice(0, 12);
}

function stageNote(financial: JobFinancialState) {
  if (!financial.refundSummary.hasPaidDeposit) {
    return 'Ainda não existe sinal pago. Cancelar encerra o job sem gerar refund.';
  }

  if (financial.refundSummary.stage === 'PRE_START') {
    return 'O serviço ainda não começou. A base atual sugere refund integral do sinal.';
  }

  if (financial.refundSummary.stage === 'IN_PROGRESS') {
    return 'O serviço já começou. O pedido segue para análise com base parcial sugerida.';
  }

  if (financial.refundSummary.stage === 'POST_COMPLETION') {
    return financial.refundSummary.withinDisputeWindow &&
      financial.refundSummary.disputeWindowEndsAt
      ? `O job já foi concluído. A disputa pode ser acompanhada até ${new Date(
          financial.refundSummary.disputeWindowEndsAt,
        ).toLocaleString('pt-PT')}.`
      : 'O job já foi concluído. O pedido entra em análise manual como disputa.';
  }

  return 'O estado financeiro deste job ainda não exige análise de refund.';
}

function SupportCaseTimeline(input: {
  refund: JobFinancialState['refunds'][number];
}) {
  const supportCase = input.refund.supportCase;

  if (!supportCase) {
    return null;
  }

  return (
    <div className='mt-3 rounded-xl border border-blue-100 bg-white p-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <p className='text-sm font-semibold text-slate-900'>
            Caso #{supportCase.id.slice(0, 8)}
          </p>
          <p className='mt-1 text-xs text-slate-600'>
            SLA base de {supportCase.baseSlaHours}h com alvo em{' '}
            {new Date(supportCase.slaTargetAt).toLocaleString('pt-PT')}.
          </p>
        </div>

        <div className='flex flex-wrap gap-2'>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${supportCaseStatusClass(
              supportCase.status,
            )}`}
          >
            {supportCaseStatusLabel(supportCase.status)}
          </span>
          {supportCase.isOverdue ? (
            <span className='rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700'>
              Fora de SLA
            </span>
          ) : null}
        </div>
      </div>

      <div className='mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2'>
        <p>
          <strong>Owner interno:</strong>{' '}
          {supportCase.ownerAssigned ? 'Atribuído' : 'Por atribuir'}
        </p>
        <p>
          <strong>Abertura:</strong>{' '}
          {new Date(supportCase.detectedAt).toLocaleString('pt-PT')}
        </p>
        {supportCase.assumedAt ? (
          <p>
            <strong>Assumido:</strong>{' '}
            {new Date(supportCase.assumedAt).toLocaleString('pt-PT')}
          </p>
        ) : null}
        {supportCase.resolvedAt ? (
          <p>
            <strong>Fecho:</strong>{' '}
            {new Date(supportCase.resolvedAt).toLocaleString('pt-PT')}
          </p>
        ) : null}
      </div>

      {supportCase.customerImpact ? (
        <p className='mt-3 text-sm text-slate-700'>
          <strong>Impacto:</strong> {supportCase.customerImpact}
        </p>
      ) : null}

      {supportCase.timeline.length > 0 ? (
        <div className='mt-3 space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Timeline do caso
          </p>
          {supportCase.timeline.map((event) => (
            <div
              key={event.id}
              className='rounded-lg border border-slate-200 bg-slate-50 p-3'
            >
              <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
                <div className='text-sm text-slate-700'>
                  <p className='font-medium text-slate-900'>{event.title}</p>
                  <p className='mt-1'>{event.description}</p>
                </div>
                <div className='text-xs text-slate-500 sm:text-right'>
                  <p>{new Date(event.createdAt).toLocaleString('pt-PT')}</p>
                  {event.actorName ? <p>{event.actorName}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JobProtectionPanel(input: {
  accessToken: string;
  jobId: string;
  financial: JobFinancialState;
  viewerRole: 'customer' | 'provider';
  onRefresh: () => Promise<void>;
  onStatusChange?: (message: string) => void;
  showOpenRequestLink?: {
    href: string;
    label: string;
  } | null;
}) {
  const [cancelReason, setCancelReason] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundEvidence, setRefundEvidence] = useState('');
  const [requestRefundOnCancel, setRequestRefundOnCancel] = useState(false);
  const [runningCancel, setRunningCancel] = useState(false);
  const [runningRefund, setRunningRefund] = useState(false);
  const [cancelingPendingRefund, setCancelingPendingRefund] = useState(false);
  const [localStatus, setLocalStatus] = useState('');

  useEffect(() => {
    setCancelReason('');
    setRefundReason('');
    setRefundAmount(
      typeof input.financial.refundSummary.suggestedRefundAmount === 'number'
        ? String(input.financial.refundSummary.suggestedRefundAmount)
        : '',
    );
    setRequestRefundOnCancel(
      input.financial.refundSummary.canRequestRefund &&
        input.financial.jobStatus !== 'COMPLETED',
    );
    setRefundEvidence('');
    setLocalStatus('');
  }, [
    input.financial.jobId,
    input.financial.jobStatus,
    input.financial.refundSummary.canRequestRefund,
    input.financial.refundSummary.suggestedRefundAmount,
  ]);

  function pushStatus(message: string) {
    setLocalStatus(message);
    input.onStatusChange?.(message);
  }

  async function handleCreateRefundRequest(reasonOverride?: string) {
    const reason = (reasonOverride ?? refundReason).trim();
    if (reason.length < 3) {
      pushStatus('Explica o motivo do pedido de refund/disputa.');
      return false;
    }

    const evidenceItems = parseEvidenceItems(refundEvidence);

    let parsedAmount: number | undefined;
    if (refundAmount.trim().length > 0) {
      const numeric = Number(refundAmount);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        pushStatus('O valor pedido deve ser positivo.');
        return false;
      }

      parsedAmount = Math.trunc(numeric);
    }

    setRunningRefund(true);
    pushStatus('A abrir pedido de refund/disputa...');

    try {
      await createJobRefundRequest(input.accessToken, input.jobId, {
        reason,
        ...(typeof parsedAmount === 'number' ? { amount: parsedAmount } : {}),
        ...(evidenceItems.length > 0 ? { evidenceItems } : {}),
      });
      await input.onRefresh();
      pushStatus('Pedido de refund/disputa enviado com sucesso.');
      return true;
    } catch (error) {
      pushStatus(
        humanizeUnknownError(error, 'Falha ao abrir pedido de refund/disputa.'),
      );
      return false;
    } finally {
      setRunningRefund(false);
    }
  }

  async function handleCancelJob() {
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      pushStatus('Explica o motivo do cancelamento.');
      return;
    }

    setRunningCancel(true);
    pushStatus('A cancelar job...');

    try {
      await updateJobStatus(input.accessToken, input.jobId, 'CANCELED', {
        cancelReason: reason,
      });

      if (requestRefundOnCancel && input.financial.refundSummary.canRequestRefund) {
        const refundCreated = await handleCreateRefundRequest(
          refundReason.trim() || reason,
        );
        await input.onRefresh();

        if (!refundCreated) {
          pushStatus(
            'Job cancelado, mas o pedido de refund/disputa precisa de nova tentativa.',
          );
          return;
        }

        pushStatus('Job cancelado e pedido de refund/disputa enviado.');
        return;
      }

      await input.onRefresh();
      pushStatus('Job cancelado com sucesso.');
    } catch (error) {
      pushStatus(humanizeUnknownError(error, 'Falha ao cancelar job.'));
    } finally {
      setRunningCancel(false);
    }
  }

  async function handleCancelPendingRefund() {
    if (!input.financial.refundSummary.myPendingRefundRequestId) {
      return;
    }

    setCancelingPendingRefund(true);
    pushStatus('A cancelar pedido de refund/disputa...');

    try {
      await cancelMyRefundRequest(
        input.accessToken,
        input.financial.refundSummary.myPendingRefundRequestId,
      );
      await input.onRefresh();
      pushStatus('Pedido de refund/disputa cancelado.');
    } catch (error) {
      pushStatus(
        humanizeUnknownError(
          error,
          'Falha ao cancelar pedido de refund/disputa.',
        ),
      );
    } finally {
      setCancelingPendingRefund(false);
    }
  }

  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
            Protecao do job
          </p>
          <h2 className='mt-2 text-lg font-semibold text-slate-900'>
            Cancelamento, refund e disputa
          </h2>
          <p className='mt-1 text-sm text-slate-600'>{stageNote(input.financial)}</p>
        </div>

        <div className='flex flex-wrap gap-2'>
          <span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700'>
            {input.financial.refundSummary.stageLabel}
          </span>
          {input.financial.refundSummary.hasActiveRefund ? (
            <span className='rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700'>
              Caso em aberto
            </span>
          ) : null}
        </div>
      </div>

      {localStatus ? <p className='mt-4 text-sm text-slate-600'>{localStatus}</p> : null}

      <div className='mt-4 grid gap-3 sm:grid-cols-3'>
        <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
          <p className='text-xs text-slate-500'>Sinal pago</p>
          <p className='mt-1 text-sm font-semibold text-slate-900'>
            {input.financial.refundSummary.hasPaidDeposit
              ? formatCurrencyMzn(input.financial.refundSummary.paidAmount)
              : 'Sem pagamento'}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
          <p className='text-xs text-slate-500'>Refunds concluidos</p>
          <p className='mt-1 text-sm font-semibold text-slate-900'>
            {formatCurrencyMzn(input.financial.refundSummary.refundedAmount)}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
          <p className='text-xs text-slate-500'>Saldo ainda reembolsavel</p>
          <p className='mt-1 text-sm font-semibold text-slate-900'>
            {formatCurrencyMzn(
              input.financial.refundSummary.remainingRefundableAmount,
            )}
          </p>
        </div>
      </div>

      {input.financial.cancellation.canceledAt ? (
        <div className='mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800'>
          <p className='font-semibold'>Job cancelado</p>
          <p className='mt-1'>
            {new Date(input.financial.cancellation.canceledAt).toLocaleString('pt-PT')}
          </p>
          {input.financial.cancellation.cancelReason ? (
            <p className='mt-2'>{input.financial.cancellation.cancelReason}</p>
          ) : null}
        </div>
      ) : null}

      {input.financial.refunds.length > 0 ? (
        <div className='mt-4 space-y-3'>
          <p className='text-sm font-semibold text-slate-900'>Historico de pedidos</p>
          {input.financial.refunds.map((refund) => (
            <article
              key={refund.id}
              className='rounded-2xl border border-slate-200 bg-slate-50 p-4'
            >
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='space-y-1 text-sm text-slate-700'>
                  <p className='font-semibold text-slate-900'>
                    {formatCurrencyMzn(refund.amount)}
                  </p>
                  <p>
                    <strong>Motivo:</strong> {refund.reason}
                  </p>
                  <p>
                    <strong>Pedido por:</strong>{' '}
                    {refund.requestedByUser?.name ?? refund.requestedByUserId.slice(0, 8)}
                  </p>
                  <p>
                    <strong>Criado:</strong>{' '}
                    {new Date(refund.createdAt).toLocaleString('pt-PT')}
                  </p>
                  {refund.processedAt ? (
                    <p>
                      <strong>Atualizado:</strong>{' '}
                      {new Date(refund.processedAt).toLocaleString('pt-PT')}
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
                      <strong>Evidências:</strong> {refund.evidenceItems.join(' | ')}
                    </p>
                  ) : null}
                  <SupportCaseTimeline refund={refund} />
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${refundStatusClass(refund.status)}`}
                >
                  {refundStatusLabel(refund.status)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {input.financial.refundSummary.canCancelJob ? (
        <div className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4'>
          <p className='text-sm font-semibold text-slate-900'>Cancelar job</p>
          <p className='mt-1 text-sm text-slate-600'>
            {input.viewerRole === 'customer'
              ? 'Cancela o job com motivo obrigatório. Se existir sinal pago, podes abrir o pedido de refund/disputa no mesmo passo.'
              : 'Se precisares de encerrar a execução, regista o motivo do cancelamento. Isso também atualiza o estado visível para o cliente.'}
          </p>

          <label className='mt-3 block space-y-2 text-sm text-slate-700'>
            <span>Motivo do cancelamento</span>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              maxLength={240}
              className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Explica o motivo do cancelamento para deixar registo claro no produto.'
              disabled={runningCancel}
            />
          </label>

          {input.financial.refundSummary.canRequestRefund ? (
            <div className='mt-3 space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800'>
              <label className='flex items-start gap-3'>
                <input
                  type='checkbox'
                  checked={requestRefundOnCancel}
                  onChange={(event) => setRequestRefundOnCancel(event.target.checked)}
                  className='mt-1 h-4 w-4 rounded border-slate-300'
                  disabled={runningCancel}
                />
                <span>
                  Abrir pedido de refund/disputa ao cancelar.
                  {input.financial.refundSummary.suggestedRefundAmount ? (
                    <> Sugestao atual: {formatCurrencyMzn(input.financial.refundSummary.suggestedRefundAmount)}.</>
                  ) : null}
                </span>
              </label>

              {requestRefundOnCancel ? (
                <>
                  <label className='block space-y-2 text-sm text-slate-700'>
                    <span>Motivo do pedido financeiro</span>
                    <textarea
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      maxLength={240}
                      className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      placeholder='Explica o contexto do pedido de refund/disputa.'
                      disabled={runningCancel}
                    />
                  </label>
                  <label className='block max-w-xs space-y-2 text-sm text-slate-700'>
                    <span>Valor pedido (opcional)</span>
                    <input
                      type='number'
                      min={1}
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      className='w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      disabled={runningCancel}
                    />
                  </label>
                  <label className='block space-y-2 text-sm text-slate-700'>
                    <span>Evidências (uma por linha)</span>
                    <textarea
                      value={refundEvidence}
                      onChange={(event) => setRefundEvidence(event.target.value)}
                      maxLength={1000}
                      className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
                      placeholder='Ex.: conversa combinada, fotos, referência de comprovativo ou observações da equipa.'
                      disabled={runningCancel}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button
              type='button'
              className='inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60'
              onClick={() => {
                void handleCancelJob();
              }}
              disabled={runningCancel}
            >
              {runningCancel ? 'A cancelar...' : 'Cancelar job'}
            </button>
            {input.showOpenRequestLink ? (
              <a
                href={input.showOpenRequestLink.href}
                className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
              >
                {input.showOpenRequestLink.label}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {input.financial.refundSummary.canRequestRefund ? (
        <div className='mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4'>
          <p className='text-sm font-semibold text-slate-900'>
            Pedir refund ou abrir disputa
          </p>
          <p className='mt-1 text-sm text-slate-600'>
            Usa este pedido quando queres registar formalmente uma revisão financeira no produto.
          </p>

          <label className='mt-3 block space-y-2 text-sm text-slate-700'>
            <span>Motivo</span>
            <textarea
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              maxLength={240}
              className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Descreve o problema, o contexto e o que esperas como resolução.'
              disabled={runningRefund}
            />
          </label>

          <label className='mt-3 block max-w-xs space-y-2 text-sm text-slate-700'>
            <span>Valor pedido (opcional)</span>
            <input
              type='number'
              min={1}
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              className='w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              disabled={runningRefund}
            />
          </label>

          <label className='mt-3 block space-y-2 text-sm text-slate-700'>
            <span>Evidências (uma por linha)</span>
            <textarea
              value={refundEvidence}
              onChange={(event) => setRefundEvidence(event.target.value)}
              maxLength={1000}
              className='min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Links, notas, fotos entregues por outro canal ou resumo factual do caso.'
              disabled={runningRefund}
            />
          </label>

          <p className='mt-3 text-xs text-slate-500'>
            {input.financial.refundSummary.suggestedRefundLabel}
          </p>

          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button
              type='button'
              className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
              onClick={() => {
                void handleCreateRefundRequest();
              }}
              disabled={runningRefund}
            >
              {runningRefund ? 'A enviar...' : 'Enviar pedido'}
            </button>

            {input.financial.refundSummary.myPendingRefundRequestId ? (
              <button
                type='button'
                className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                onClick={() => {
                  void handleCancelPendingRefund();
                }}
                disabled={cancelingPendingRefund}
              >
                {cancelingPendingRefund ? 'A cancelar pedido...' : 'Cancelar pedido pendente'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
