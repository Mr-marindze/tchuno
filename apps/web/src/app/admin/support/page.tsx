'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  confirmReauth,
  ensureSession,
  listPasswordRecoveryRequests,
  PasswordRecoveryRequest,
  PasswordRecoveryRequestStatus,
  updatePasswordRecoveryRequest,
} from '@/lib/auth';
import { humanizeUnknownError, ReauthRequiredError } from '@/lib/http-errors';
import {
  approveAdminRefund,
  listAdminRefundRequests,
  rejectAdminRefund,
  RefundRequest,
} from '@/lib/payments';
import {
  createOperationalIncident,
  listOperationalIncidents,
  OperationalIncident,
  OperationalIncidentSeverity,
  OperationalIncidentSource,
  OperationalIncidentStatus,
  updateOperationalIncident,
} from '@/lib/support-ops';
import {
  AdminTrustSafetyIntervention,
  listAdminTrustSafetyInterventions,
} from '@/lib/trust-safety';

type QueueFilter =
  | 'ALL'
  | 'PASSWORD_RECOVERY'
  | 'REFUND'
  | 'TRUST_SAFETY'
  | 'INCIDENT';

type QueueItem =
  | {
      id: string;
      kind: 'PASSWORD_RECOVERY';
      createdAt: string;
      priority: 1 | 2 | 3 | 4;
      payload: PasswordRecoveryRequest;
    }
  | {
      id: string;
      kind: 'REFUND';
      createdAt: string;
      priority: 1 | 2 | 3 | 4;
      payload: RefundRequest;
    }
  | {
      id: string;
      kind: 'TRUST_SAFETY';
      createdAt: string;
      priority: 1 | 2 | 3 | 4;
      payload: AdminTrustSafetyIntervention;
    }
  | {
      id: string;
      kind: 'INCIDENT';
      createdAt: string;
      priority: 1 | 2 | 3 | 4;
      payload: OperationalIncident;
    };

function statusLabel(status: PasswordRecoveryRequestStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Novo';
    case 'IN_PROGRESS':
      return 'Em tratamento';
    case 'RESOLVED':
      return 'Resolvido';
    case 'CANCELED':
      return 'Cancelado';
    default:
      return status;
  }
}

function passwordStatusClass(status: PasswordRecoveryRequestStatus): string {
  switch (status) {
    case 'OPEN':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'IN_PROGRESS':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'RESOLVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'CANCELED':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function buildResetCommand(request: PasswordRecoveryRequest): string {
  return [
    'yarn workspace @tchuno/database reset-password',
    `--email ${request.email}`,
    `--reason "password-recovery-request:${request.id}"`,
  ].join(' ');
}

function queuePriorityClass(priority: QueueItem['priority']): string {
  if (priority === 4) {
    return 'bg-rose-100 text-rose-700';
  }

  if (priority === 3) {
    return 'bg-amber-100 text-amber-700';
  }

  if (priority === 2) {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function queuePriorityLabel(priority: QueueItem['priority']): string {
  if (priority === 4) {
    return 'Crítico';
  }

  if (priority === 3) {
    return 'Alto';
  }

  if (priority === 2) {
    return 'Médio';
  }

  return 'Base';
}

function incidentStatusLabel(status: OperationalIncidentStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'INVESTIGATING':
      return 'Em investigação';
    case 'MITIGATING':
      return 'Em mitigação';
    case 'MONITORING':
      return 'Em monitorização';
    case 'RESOLVED':
      return 'Resolvido';
    case 'CANCELED':
      return 'Cancelado';
    default:
      return status;
  }
}

function incidentStatusClass(status: OperationalIncidentStatus): string {
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

function severityLabel(severity: OperationalIncidentSeverity): string {
  if (severity === 'CRITICAL') {
    return 'Crítico';
  }

  if (severity === 'HIGH') {
    return 'Alto';
  }

  if (severity === 'MEDIUM') {
    return 'Médio';
  }

  return 'Baixo';
}

function severityClass(severity: OperationalIncidentSeverity): string {
  if (severity === 'CRITICAL') {
    return 'bg-rose-100 text-rose-700';
  }

  if (severity === 'HIGH') {
    return 'bg-amber-100 text-amber-700';
  }

  if (severity === 'MEDIUM') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function trustStatusClass(status: string): string {
  if (status === 'CLEARED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'ENFORCED') {
    return 'bg-rose-100 text-rose-700';
  }

  if (status === 'APPEALED') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function refundStatusLabel(status: string): string {
  if (status === 'PENDING') {
    return 'Pendente';
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
    return 'Recusado/falhado';
  }

  if (status === 'CANCELED') {
    return 'Cancelado';
  }

  return status;
}

function parseEvidenceItems(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    .slice(0, 12);
}

function formatCurrencyMzn(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'MZN',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'n/d';
  }

  return new Date(value).toLocaleString('pt-PT');
}

function TimelineList(input: {
  events: Array<{
    id: string;
    title: string;
    description: string;
    actorName: string | null;
    createdAt: string;
  }>;
  emptyLabel: string;
}) {
  if (input.events.length === 0) {
    return <p className='text-xs text-slate-500'>{input.emptyLabel}</p>;
  }

  return (
    <div className='mt-3 space-y-2'>
      {input.events.map((event) => (
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
              <p>{formatDateTime(event.createdAt)}</p>
              {event.actorName ? <p>{event.actorName}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function sortQueueItems(left: QueueItem, right: QueueItem): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function asQueuePriority(value: QueueItem['priority']): QueueItem['priority'] {
  return value;
}

export default function AdminSupportPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [passwordRequests, setPasswordRequests] = useState<PasswordRecoveryRequest[]>(
    [],
  );
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [trustCases, setTrustCases] = useState<AdminTrustSafetyIntervention[]>([]);
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [incidentSummaryStats, setIncidentSummaryStats] = useState({
    unresolvedCount: 0,
    criticalCount: 0,
    resolvedCount: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar fila operacional...');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('ALL');

  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentSummary, setIncidentSummary] = useState('');
  const [incidentSource, setIncidentSource] =
    useState<OperationalIncidentSource>('SUPPORT');
  const [incidentSeverity, setIncidentSeverity] =
    useState<OperationalIncidentSeverity>('MEDIUM');
  const [incidentBaseSlaHours, setIncidentBaseSlaHours] = useState('24');
  const [incidentImpactedArea, setIncidentImpactedArea] = useState('');
  const [incidentCustomerImpact, setIncidentCustomerImpact] = useState('');
  const [incidentEvidenceDraft, setIncidentEvidenceDraft] = useState('');
  const [relatedJobId, setRelatedJobId] = useState('');
  const [relatedRefundId, setRelatedRefundId] = useState('');
  const [relatedTrustId, setRelatedTrustId] = useState('');

  const loadDashboard = useCallback(
    async (tokenOverride?: string | null) => {
      const token = tokenOverride ?? accessToken;
      if (!token) {
        setPasswordRequests([]);
        setRefunds([]);
        setTrustCases([]);
        setIncidents([]);
        setIncidentSummaryStats({
          unresolvedCount: 0,
          criticalCount: 0,
          resolvedCount: 0,
          overdueCount: 0,
        });
        return;
      }

      const [
        passwordResponse,
        refundsResponse,
        trustResponse,
        incidentsResponse,
      ] = await Promise.all([
        listPasswordRecoveryRequests(token, {
          page: 1,
          limit: 50,
        }),
        listAdminRefundRequests(token, {
          page: 1,
          limit: 50,
        }),
        listAdminTrustSafetyInterventions(token, {
          page: 1,
          limit: 50,
        }),
        listOperationalIncidents(token, {
          page: 1,
          limit: 50,
        }),
      ]);

      setPasswordRequests(passwordResponse.data);
      setRefunds(refundsResponse.data);
      setTrustCases(trustResponse.data);
      setIncidents(incidentsResponse.data);
      setIncidentSummaryStats(incidentsResponse.summary);
    },
    [accessToken],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setStatus('A carregar fila operacional...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
          }
          return;
        }

        if (!active) {
          return;
        }

        setAccessToken(session.auth.accessToken);
        await loadDashboard(session.auth.accessToken);

        if (active) {
          setStatus('Fila operacional atualizada.');
        }
      } catch (error) {
        if (active) {
          setStatus(
            humanizeUnknownError(error, 'Falha ao carregar fila operacional.'),
          );
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
  }, [loadDashboard]);

  const activePasswordRequests = useMemo(
    () =>
      passwordRequests.filter((item) =>
        ['OPEN', 'IN_PROGRESS'].includes(item.status),
      ),
    [passwordRequests],
  );

  const activeRefunds = useMemo(
    () =>
      refunds.filter((item) =>
        ['PENDING', 'APPROVED', 'PROCESSING'].includes(item.status),
      ),
    [refunds],
  );

  const activeTrustCases = useMemo(
    () =>
      trustCases.filter((item) =>
        ['OPEN', 'APPEALED', 'ENFORCED'].includes(item.status),
      ),
    [trustCases],
  );

  const activeIncidents = useMemo(
    () =>
      incidents.filter((item) =>
        !['RESOLVED', 'CANCELED'].includes(item.status),
      ),
    [incidents],
  );

  const totalActiveQueueCount =
    activePasswordRequests.length +
    activeRefunds.length +
    activeTrustCases.length +
    activeIncidents.length;

  const queueItems = useMemo(() => {
    const items: QueueItem[] = [
      ...activePasswordRequests.map((item) => ({
        id: item.id,
        kind: 'PASSWORD_RECOVERY' as const,
        createdAt: item.requestedAt,
        priority: asQueuePriority(item.status === 'OPEN' ? 2 : 1),
        payload: item,
      })),
      ...activeRefunds.map((item) => ({
        id: item.id,
        kind: 'REFUND' as const,
        createdAt: item.createdAt,
        priority: asQueuePriority(
          item.supportCase?.isOverdue
            ? 4
            : item.evidenceItems.length > 0 || item.status === 'PENDING'
              ? 3
              : 2,
        ),
        payload: item,
      })),
      ...activeTrustCases.map((item) => ({
        id: item.id,
        kind: 'TRUST_SAFETY' as const,
        createdAt: item.createdAt,
        priority: asQueuePriority(
          item.riskLevel === 'HIGH' || item.status === 'APPEALED' ? 4 : 3,
        ),
        payload: item,
      })),
      ...activeIncidents.map((item) => ({
        id: item.id,
        kind: 'INCIDENT' as const,
        createdAt: item.detectedAt,
        priority: asQueuePriority(
          item.severity === 'CRITICAL'
            ? 4
            : item.severity === 'HIGH'
              ? 3
              : item.severity === 'MEDIUM'
                ? 2
                : 1
        ),
        payload: item,
      })),
    ];

    return items
      .filter((item) => filter === 'ALL' || item.kind === filter)
      .sort(sortQueueItems);
  }, [
    activeIncidents,
    activePasswordRequests,
    activeRefunds,
    activeTrustCases,
    filter,
  ]);

  async function handlePasswordStatusUpdate(
    requestId: string,
    nextStatus: Exclude<PasswordRecoveryRequestStatus, 'OPEN'>,
  ) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningId(`password-${requestId}`);
    setStatus('A atualizar pedido de recuperação...');

    try {
      await updatePasswordRecoveryRequest(accessToken, requestId, {
        status: nextStatus,
      });
      await loadDashboard(accessToken);
      setStatus(
        `Pedido de recuperação atualizado para ${statusLabel(nextStatus).toLowerCase()}.`,
      );
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao atualizar pedido de recuperação.'),
      );
    } finally {
      setRunningId(null);
    }
  }

  async function handleCopyCommand(request: PasswordRecoveryRequest) {
    try {
      if (!navigator.clipboard) {
        setStatus('Clipboard não disponível neste browser.');
        return;
      }

      await navigator.clipboard.writeText(buildResetCommand(request));
      setCopiedId(request.id);
      setStatus(`Comando copiado para ${request.email}.`);

      window.setTimeout(() => {
        setCopiedId((current) => (current === request.id ? null : current));
      }, 1500);
    } catch {
      setStatus('Falha ao copiar comando.');
    }
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
        'Confirma a tua password para concluir a decisão financeira:',
      );
      if (!password || password.trim().length === 0) {
        throw new Error('Reautenticação cancelada.');
      }

      const confirmation = await confirmReauth({
        accessToken,
        password: password.trim(),
        purpose: input.purpose,
      });

      return input.execute(confirmation.reauthToken);
    }
  }

  function prefillIncident(input: {
    title: string;
    summary: string;
    source: OperationalIncidentSource;
    severity: OperationalIncidentSeverity;
    baseSlaHours?: number;
    relatedJobId?: string | null;
    relatedRefundRequestId?: string | null;
    relatedTrustSafetyInterventionId?: string | null;
    evidenceItems?: string[];
  }) {
    setIncidentTitle(input.title);
    setIncidentSummary(input.summary);
    setIncidentSource(input.source);
    setIncidentSeverity(input.severity);
    setIncidentBaseSlaHours(String(input.baseSlaHours ?? 24));
    setRelatedJobId(input.relatedJobId ?? '');
    setRelatedRefundId(input.relatedRefundRequestId ?? '');
    setRelatedTrustId(input.relatedTrustSafetyInterventionId ?? '');
    setIncidentEvidenceDraft((input.evidenceItems ?? []).join('\n'));
    setStatus('Formulário de incidente pré-preenchido.');
  }

  async function handleCreateIncident() {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    if (incidentTitle.trim().length < 3 || incidentSummary.trim().length < 10) {
      setStatus('Preenche título e resumo do incidente com contexto suficiente.');
      return;
    }

    setRunningId('incident-create');
    setStatus('A criar incidente operacional...');

    try {
      const parsedSla = Number(incidentBaseSlaHours);
      await createOperationalIncident(accessToken, {
        title: incidentTitle.trim(),
        summary: incidentSummary.trim(),
        source: incidentSource,
        severity: incidentSeverity,
        ...(Number.isFinite(parsedSla) && parsedSla > 0
          ? { baseSlaHours: Math.trunc(parsedSla) }
          : {}),
        impactedArea: incidentImpactedArea.trim() || undefined,
        customerImpact: incidentCustomerImpact.trim() || undefined,
        evidenceItems: parseEvidenceItems(incidentEvidenceDraft),
        relatedJobId: relatedJobId.trim() || undefined,
        relatedRefundRequestId: relatedRefundId.trim() || undefined,
        relatedTrustSafetyInterventionId: relatedTrustId.trim() || undefined,
      });
      await loadDashboard(accessToken);
      setIncidentTitle('');
      setIncidentSummary('');
      setIncidentSource('SUPPORT');
      setIncidentSeverity('MEDIUM');
      setIncidentBaseSlaHours('24');
      setIncidentImpactedArea('');
      setIncidentCustomerImpact('');
      setIncidentEvidenceDraft('');
      setRelatedJobId('');
      setRelatedRefundId('');
      setRelatedTrustId('');
      setStatus('Incidente operacional criado com sucesso.');
      setFilter('INCIDENT');
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, 'Falha ao criar incidente operacional.'),
      );
    } finally {
      setRunningId(null);
    }
  }

  async function handleAssumeIncident(incident: {
    id: string;
    status: OperationalIncidentStatus;
  }) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningId(`incident-assume-${incident.id}`);
    setStatus(`A assumir o caso ${incident.id.slice(0, 8)}...`);

    try {
      await updateOperationalIncident(accessToken, incident.id, {
        assignToMe: true,
        ...(incident.status === 'OPEN' ? { status: 'INVESTIGATING' } : {}),
      });
      await loadDashboard(accessToken);
      setStatus(`Caso ${incident.id.slice(0, 8)} assumido pela equipa.`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao assumir o caso.'));
    } finally {
      setRunningId(null);
    }
  }

  async function handleIncidentStatusChange(
    incident: {
      id: string;
      status: OperationalIncidentStatus;
    },
    nextStatus: OperationalIncidentStatus,
  ) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const resolutionNote =
      nextStatus === 'RESOLVED' || nextStatus === 'CANCELED'
        ? typeof window === 'undefined'
          ? 'Caso encerrado pela equipa.'
          : window.prompt(
              'Nota de fecho/decisão (opcional):',
              nextStatus === 'RESOLVED'
                ? 'Incidente mitigado e encerrado.'
                : 'Incidente encerrado sem ação adicional.',
            )?.trim() || ''
        : '';

    setRunningId(`incident-${incident.id}`);
    setStatus(`A atualizar incidente ${incident.id.slice(0, 8)}...`);

    try {
      await updateOperationalIncident(accessToken, incident.id, {
        status: nextStatus,
        ...(resolutionNote ? { resolutionNote } : {}),
      });
      await loadDashboard(accessToken);
      setStatus(
        `Incidente ${incident.id.slice(0, 8)} atualizado para ${incidentStatusLabel(nextStatus).toLowerCase()}.`,
      );
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao atualizar incidente.'));
    } finally {
      setRunningId(null);
    }
  }

  async function handleApproveRefund(refund: RefundRequest) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const decisionNote =
      typeof window === 'undefined'
        ? 'Pedido aprovado após análise.'
        : window.prompt(
            'Decisão visível para cliente e prestador:',
            'Pedido aprovado após análise do histórico e das evidências.',
          )?.trim() || '';

    setRunningId(`refund-approve-${refund.id}`);
    setStatus(`A aprovar disputa ${refund.id.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          approveAdminRefund(
            accessToken,
            refund.id,
            decisionNote ? { decisionNote } : undefined,
            { reauthToken },
          ),
      });
      await loadDashboard(accessToken);
      setStatus(`Disputa ${refund.id.slice(0, 8)} aprovada e fechada.`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao aprovar disputa.'));
    } finally {
      setRunningId(null);
    }
  }

  async function handleRejectRefund(refund: RefundRequest) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const reason =
      typeof window === 'undefined'
        ? 'Pedido recusado após análise.'
        : window.prompt(
            'Motivo da recusa:',
            'Pedido recusado após análise do histórico e das evidências.',
          )?.trim() || '';

    if (!reason) {
      setStatus('A recusa precisa de um motivo claro.');
      return;
    }

    const decisionNote =
      typeof window === 'undefined'
        ? reason
        : window.prompt('Decisão visível para cliente e prestador:', reason)?.trim() ||
          reason;

    setRunningId(`refund-reject-${refund.id}`);
    setStatus(`A recusar disputa ${refund.id.slice(0, 8)}...`);

    try {
      await runCriticalAdminAction({
        purpose: 'admin.payments.refund',
        execute: (reauthToken) =>
          rejectAdminRefund(
            accessToken,
            refund.id,
            {
              reason,
              ...(decisionNote ? { decisionNote } : {}),
            },
            { reauthToken },
          ),
      });
      await loadDashboard(accessToken);
      setStatus(`Disputa ${refund.id.slice(0, 8)} recusada e fechada.`);
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao recusar disputa.'));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>
              Suporte e operações
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Fila interna com suporte, disputas, trust e incidentes ligados ao
              produto.
            </p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Link
              href='/admin/payments'
              className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
            >
              Abrir pagamentos
            </Link>
            <Link
              href='/admin/moderation'
              className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
            >
              Abrir Trust & Safety
            </Link>
            <button
              type='button'
              className='inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
              onClick={() => {
                void loadDashboard();
              }}
              disabled={loading}
            >
              Recarregar
            </button>
          </div>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <SummaryCard label='Fila ativa' value={totalActiveQueueCount} />
          <SummaryCard label='Disputas abertas' value={activeRefunds.length} />
          <SummaryCard label='Casos fora de SLA' value={incidentSummaryStats.overdueCount} />
          <SummaryCard label='Incidentes ativos' value={activeIncidents.length} />
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-slate-900'>
              Abrir incidente operacional
            </h2>
            <p className='mt-1 text-sm text-slate-600'>
              Usa incidentes para coordenar casos internos com contexto, evidências
              e fecho operacional.
            </p>
          </div>

          <div className='flex flex-wrap gap-2 text-xs text-slate-500'>
            <span className='rounded-full bg-slate-100 px-2.5 py-1'>
              {incidentSummaryStats.criticalCount} críticos
            </span>
            <span className='rounded-full bg-slate-100 px-2.5 py-1'>
              {incidentSummaryStats.resolvedCount} resolvidos
            </span>
            <span className='rounded-full bg-slate-100 px-2.5 py-1'>
              {incidentSummaryStats.overdueCount} fora de SLA
            </span>
          </div>
        </div>

        <div className='mt-4 grid gap-3 md:grid-cols-2'>
          <label className='space-y-1 text-sm text-slate-700'>
            <span>Título</span>
            <input
              type='text'
              value={incidentTitle}
              onChange={(event) => setIncidentTitle(event.target.value)}
              maxLength={120}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Ex.: disputa bloqueada a aguardar decisão'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Área impactada</span>
            <input
              type='text'
              value={incidentImpactedArea}
              onChange={(event) => setIncidentImpactedArea(event.target.value)}
              maxLength={120}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Suporte, pagamentos, trust, operação...'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>SLA base (horas)</span>
            <input
              type='number'
              min={1}
              max={168}
              value={incidentBaseSlaHours}
              onChange={(event) => setIncidentBaseSlaHours(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='24'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700 md:col-span-2'>
            <span>Resumo</span>
            <textarea
              value={incidentSummary}
              onChange={(event) => setIncidentSummary(event.target.value)}
              maxLength={600}
              className='min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Descreve o caso, impacto, bloqueios e próximo passo operacional.'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Fonte</span>
            <select
              value={incidentSource}
              onChange={(event) =>
                setIncidentSource(event.target.value as OperationalIncidentSource)
              }
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            >
              <option value='SUPPORT'>Suporte</option>
              <option value='REFUND_DISPUTE'>Disputa / refund</option>
              <option value='TRUST_SAFETY'>Trust & Safety</option>
              <option value='PLATFORM'>Plataforma</option>
            </select>
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Severidade</span>
            <select
              value={incidentSeverity}
              onChange={(event) =>
                setIncidentSeverity(
                  event.target.value as OperationalIncidentSeverity,
                )
              }
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            >
              <option value='LOW'>Baixa</option>
              <option value='MEDIUM'>Média</option>
              <option value='HIGH'>Alta</option>
              <option value='CRITICAL'>Crítica</option>
            </select>
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Impacto no cliente</span>
            <input
              type='text'
              value={incidentCustomerImpact}
              onChange={(event) => setIncidentCustomerImpact(event.target.value)}
              maxLength={240}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Ex.: pagamento retido, decisão atrasada, sem resposta...'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Job relacionado (opcional)</span>
            <input
              type='text'
              value={relatedJobId}
              onChange={(event) => setRelatedJobId(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='jobId'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Refund relacionado (opcional)</span>
            <input
              type='text'
              value={relatedRefundId}
              onChange={(event) => setRelatedRefundId(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='refundRequestId'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700'>
            <span>Caso trust relacionado (opcional)</span>
            <input
              type='text'
              value={relatedTrustId}
              onChange={(event) => setRelatedTrustId(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='trustSafetyInterventionId'
            />
          </label>

          <label className='space-y-1 text-sm text-slate-700 md:col-span-2'>
            <span>Evidências (uma por linha)</span>
            <textarea
              value={incidentEvidenceDraft}
              onChange={(event) => setIncidentEvidenceDraft(event.target.value)}
              maxLength={1000}
              className='min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              placeholder='Links internos, resumo de provas, referências de anexos ou observações factuais.'
            />
          </label>
        </div>

        <div className='mt-4 flex flex-wrap gap-3'>
          <button
            type='button'
            className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
            onClick={() => {
              void handleCreateIncident();
            }}
            disabled={runningId === 'incident-create'}
          >
            {runningId === 'incident-create' ? 'A criar...' : 'Criar incidente'}
          </button>
          <button
            type='button'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
            onClick={() => {
              setIncidentTitle('');
              setIncidentSummary('');
              setIncidentSource('SUPPORT');
              setIncidentSeverity('MEDIUM');
              setIncidentBaseSlaHours('24');
              setIncidentImpactedArea('');
              setIncidentCustomerImpact('');
              setIncidentEvidenceDraft('');
              setRelatedJobId('');
              setRelatedRefundId('');
              setRelatedTrustId('');
            }}
          >
            Limpar
          </button>
        </div>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
        <div className='flex flex-wrap gap-2'>
          {(
            [
              ['ALL', 'Tudo'],
              ['PASSWORD_RECOVERY', 'Suporte'],
              ['REFUND', 'Disputas'],
              ['TRUST_SAFETY', 'Trust'],
              ['INCIDENT', 'Incidentes'],
            ] as Array<[QueueFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type='button'
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filter === value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {queueItems.length === 0 ? (
        <section className='rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600'>
          Não há itens ativos nesta vista.
        </section>
      ) : (
        <section className='space-y-3'>
          {queueItems.map((item) => {
            if (item.kind === 'PASSWORD_RECOVERY') {
              const request = item.payload;

              return (
                <article
                  key={item.id}
                  className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2 text-sm text-slate-700'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='font-semibold text-slate-900'>{request.email}</p>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${passwordStatusClass(
                            request.status,
                          )}`}
                        >
                          {statusLabel(request.status)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${queuePriorityClass(
                            item.priority,
                          )}`}
                        >
                          {queuePriorityLabel(item.priority)}
                        </span>
                      </div>

                      <p>
                        <strong>Conta:</strong>{' '}
                        {request.userId ? 'Encontrada na base' : 'Ainda não associada'}
                      </p>
                      <p>
                        <strong>Pedido:</strong>{' '}
                        {new Date(request.requestedAt).toLocaleString('pt-PT')}
                      </p>
                      {request.note ? (
                        <p>
                          <strong>Nota:</strong> {request.note}
                        </p>
                      ) : null}
                    </div>

                    <div className='flex flex-wrap gap-2'>
                      {request.status === 'OPEN' ? (
                        <button
                          type='button'
                          className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                          onClick={() => {
                            void handlePasswordStatusUpdate(request.id, 'IN_PROGRESS');
                          }}
                          disabled={runningId === `password-${request.id}`}
                        >
                          Em tratamento
                        </button>
                      ) : null}
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleCopyCommand(request);
                        }}
                      >
                        {copiedId === request.id ? 'Copiado' : 'Copiar comando'}
                      </button>
                      <button
                        type='button'
                        className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
                        onClick={() => {
                          void handlePasswordStatusUpdate(request.id, 'RESOLVED');
                        }}
                        disabled={runningId === `password-${request.id}`}
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            if (item.kind === 'REFUND') {
              const refund = item.payload;
              const refundCase = refund.supportCase;

              return (
                <article
                  key={item.id}
                  className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2 text-sm text-slate-700'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='font-semibold text-slate-900'>
                          Disputa/refund #{refund.id.slice(0, 8)}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${queuePriorityClass(
                            item.priority,
                          )}`}
                        >
                          {queuePriorityLabel(item.priority)}
                        </span>
                        <span className='rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700'>
                          {refundStatusLabel(refund.status)}
                        </span>
                      </div>

                      <p>
                        <strong>Valor:</strong> {formatCurrencyMzn(refund.amount)}
                      </p>
                      <p>
                        <strong>Motivo:</strong> {refund.reason}
                      </p>
                      <p>
                        <strong>Evidências:</strong>{' '}
                        {refund.evidenceItems.length > 0
                          ? refund.evidenceItems.join(' | ')
                          : 'Sem evidências registadas'}
                      </p>
                      <p>
                        <strong>Criado:</strong>{' '}
                        {new Date(refund.createdAt).toLocaleString('pt-PT')}
                      </p>
                      {refund.decisionNote ? (
                        <p>
                          <strong>Decisão:</strong> {refund.decisionNote}
                        </p>
                      ) : null}
                      {refundCase ? (
                        <div className='rounded-xl border border-blue-100 bg-blue-50 p-3'>
                          <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                            <div>
                              <p className='font-semibold text-slate-900'>
                                Caso #{refundCase.id.slice(0, 8)}
                              </p>
                              <p className='mt-1 text-xs text-slate-600'>
                                SLA base {refundCase.baseSlaHours}h com alvo em{' '}
                                {formatDateTime(refundCase.slaTargetAt)}
                              </p>
                            </div>

                            <div className='flex flex-wrap gap-2'>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${incidentStatusClass(
                                  refundCase.status as OperationalIncidentStatus,
                                )}`}
                              >
                                {incidentStatusLabel(
                                  refundCase.status as OperationalIncidentStatus,
                                )}
                              </span>
                              {refundCase.isOverdue ? (
                                <span className='rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700'>
                                  Fora de SLA
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className='mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2'>
                            <p>
                              <strong>Owner:</strong>{' '}
                              {refundCase.ownerAdminUser?.name ??
                                refundCase.ownerAdminUser?.email ??
                                'Por atribuir'}
                            </p>
                            <p>
                              <strong>Abertura:</strong>{' '}
                              {formatDateTime(refundCase.detectedAt)}
                            </p>
                            {refundCase.assumedAt ? (
                              <p>
                                <strong>Assumido:</strong>{' '}
                                {formatDateTime(refundCase.assumedAt)}
                              </p>
                            ) : null}
                            {refundCase.resolvedAt ? (
                              <p>
                                <strong>Fecho:</strong>{' '}
                                {formatDateTime(refundCase.resolvedAt)}
                              </p>
                            ) : null}
                          </div>

                          {refundCase.customerImpact ? (
                            <p className='mt-3 text-sm text-slate-700'>
                              <strong>Impacto:</strong> {refundCase.customerImpact}
                            </p>
                          ) : null}

                          <TimelineList
                            events={refundCase.timeline}
                            emptyLabel='Sem movimentos registados neste caso.'
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className='flex flex-wrap gap-2'>
                      {refundCase ? (
                        <>
                          {!refundCase.ownerAssigned ? (
                            <button
                              type='button'
                              className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                              onClick={() => {
                                void handleAssumeIncident({
                                  id: refundCase.id,
                                  status:
                                    refundCase.status as OperationalIncidentStatus,
                                });
                              }}
                              disabled={runningId === `incident-assume-${refundCase.id}`}
                            >
                              Assumir caso
                            </button>
                          ) : null}
                          {refundCase.ownerAssigned &&
                          refundCase.status !== 'INVESTIGATING' &&
                          !['RESOLVED', 'CANCELED'].includes(refundCase.status) ? (
                            <button
                              type='button'
                              className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                              onClick={() => {
                                void handleIncidentStatusChange(
                                  {
                                    id: refundCase.id,
                                    status:
                                      refundCase.status as OperationalIncidentStatus,
                                  },
                                  'INVESTIGATING',
                                );
                              }}
                              disabled={runningId === `incident-${refundCase.id}`}
                            >
                              Investigar
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <button
                          type='button'
                          className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                          onClick={() =>
                            prefillIncident({
                              title: `Escalar disputa ${refund.id.slice(0, 8)}`,
                              summary: `${refund.reason}\n\nValor: ${refund.amount} ${refund.currency}.`,
                              source: 'REFUND_DISPUTE',
                              severity:
                                refund.evidenceItems.length > 0 ? 'HIGH' : 'MEDIUM',
                              baseSlaHours: 24,
                              relatedRefundRequestId: refund.id,
                              relatedJobId: refund.jobId,
                              evidenceItems: refund.evidenceItems,
                            })
                          }
                        >
                          Criar incidente
                        </button>
                      )}
                      {refund.status === 'PENDING' ? (
                        <>
                          <button
                            type='button'
                            className='rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60'
                            onClick={() => {
                              void handleApproveRefund(refund);
                            }}
                            disabled={runningId === `refund-approve-${refund.id}`}
                          >
                            Aprovar
                          </button>
                          <button
                            type='button'
                            className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
                            onClick={() => {
                              void handleRejectRefund(refund);
                            }}
                            disabled={runningId === `refund-reject-${refund.id}`}
                          >
                            Recusar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }

            if (item.kind === 'TRUST_SAFETY') {
              const trustCase = item.payload;

              return (
                <article
                  key={item.id}
                  className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                >
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div className='space-y-2 text-sm text-slate-700'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='font-semibold text-slate-900'>
                          {trustCase.job.title}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${queuePriorityClass(
                            item.priority,
                          )}`}
                        >
                          {queuePriorityLabel(item.priority)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${trustStatusClass(
                            trustCase.status,
                          )}`}
                        >
                          {trustCase.status}
                        </span>
                      </div>

                      <p>
                        <strong>Risco:</strong> {trustCase.riskLevel}
                      </p>
                      <p>
                        <strong>Motivo:</strong> {trustCase.reasonSummary}
                      </p>
                      <p>
                        <strong>Mensagem:</strong> &quot;{trustCase.messagePreview}&quot;
                      </p>
                      {trustCase.appealReason ? (
                        <p>
                          <strong>Apelação:</strong> {trustCase.appealReason}
                        </p>
                      ) : null}
                    </div>

                    <div className='flex flex-wrap gap-2'>
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
                        onClick={() =>
                          prefillIncident({
                            title: `Escalar caso trust ${trustCase.id.slice(0, 8)}`,
                            summary: `${trustCase.reasonSummary}\n\n${trustCase.messagePreview}`,
                            source: 'TRUST_SAFETY',
                            severity:
                              trustCase.riskLevel === 'HIGH' ? 'CRITICAL' : 'HIGH',
                            baseSlaHours:
                              trustCase.riskLevel === 'HIGH' ? 12 : 24,
                            relatedTrustSafetyInterventionId: trustCase.id,
                            relatedJobId: trustCase.job.id,
                            evidenceItems: [trustCase.messagePreview],
                          })
                        }
                      >
                        Criar incidente
                      </button>
                      <Link
                        href='/admin/moderation'
                        className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black'
                      >
                        Abrir trust
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }

            const incident = item.payload;

            return (
              <article
                key={item.id}
                className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
              >
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-2 text-sm text-slate-700'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='font-semibold text-slate-900'>{incident.title}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClass(
                          incident.severity,
                        )}`}
                      >
                        {severityLabel(incident.severity)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${incidentStatusClass(
                          incident.status,
                        )}`}
                      >
                        {incidentStatusLabel(incident.status)}
                      </span>
                    </div>

                    <p>{incident.summary}</p>
                    <p>
                      <strong>Fonte:</strong> {incident.source}
                    </p>
                    <p>
                      <strong>Owner:</strong>{' '}
                      {incident.ownerAdminUser?.name ??
                        incident.ownerAdminUser?.email ??
                        'Por atribuir'}
                    </p>
                    <p>
                      <strong>SLA:</strong> {incident.baseSlaHours}h até{' '}
                      {formatDateTime(incident.slaTargetAt)}
                    </p>
                    {new Date(incident.slaTargetAt).getTime() < Date.now() &&
                    !['RESOLVED', 'CANCELED'].includes(incident.status) ? (
                      <p className='text-rose-700'>
                        <strong>Estado SLA:</strong> fora do prazo base
                      </p>
                    ) : null}
                    {incident.assumedAt ? (
                      <p>
                        <strong>Assumido:</strong>{' '}
                        {formatDateTime(incident.assumedAt)}
                      </p>
                    ) : null}
                    {incident.customerImpact ? (
                      <p>
                        <strong>Impacto:</strong> {incident.customerImpact}
                      </p>
                    ) : null}
                    {incident.evidenceItems.length > 0 ? (
                      <p>
                        <strong>Evidências:</strong>{' '}
                        {incident.evidenceItems.join(' | ')}
                      </p>
                    ) : null}
                    {incident.relatedJob ? (
                      <p>
                        <strong>Job:</strong> {incident.relatedJob.title} (
                        {incident.relatedJob.id.slice(0, 8)})
                      </p>
                    ) : null}
                    {incident.relatedRefundRequest ? (
                      <p>
                        <strong>Refund:</strong> #
                        {incident.relatedRefundRequest.id.slice(0, 8)}
                      </p>
                    ) : null}
                    {incident.relatedTrustSafetyIntervention ? (
                      <p>
                        <strong>Trust:</strong> #
                        {incident.relatedTrustSafetyIntervention.id.slice(0, 8)}
                      </p>
                    ) : null}
                    {incident.resolutionNote ? (
                      <p>
                        <strong>Nota:</strong> {incident.resolutionNote}
                      </p>
                    ) : null}

                    <div>
                      <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                        Timeline
                      </p>
                      <TimelineList
                        events={incident.events}
                        emptyLabel='Sem movimentos registados neste incidente.'
                      />
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-2'>
                    {!incident.ownerAdminUserId ? (
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleAssumeIncident(incident);
                        }}
                        disabled={runningId === `incident-assume-${incident.id}`}
                      >
                        Assumir
                      </button>
                    ) : null}
                    {incident.status !== 'INVESTIGATING' ? (
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleIncidentStatusChange(incident, 'INVESTIGATING');
                        }}
                        disabled={runningId === `incident-${incident.id}`}
                      >
                        Investigar
                      </button>
                    ) : null}
                    {incident.status !== 'MITIGATING' ? (
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleIncidentStatusChange(incident, 'MITIGATING');
                        }}
                        disabled={runningId === `incident-${incident.id}`}
                      >
                        Mitigar
                      </button>
                    ) : null}
                    {incident.status !== 'MONITORING' ? (
                      <button
                        type='button'
                        className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                        onClick={() => {
                          void handleIncidentStatusChange(incident, 'MONITORING');
                        }}
                        disabled={runningId === `incident-${incident.id}`}
                      >
                        Monitorizar
                      </button>
                    ) : null}
                    <button
                      type='button'
                      className='rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
                      onClick={() => {
                        void handleIncidentStatusChange(incident, 'RESOLVED');
                      }}
                      disabled={runningId === `incident-${incident.id}`}
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function SummaryCard(input: { label: string; value: number }) {
  return (
    <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
      <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
        {input.label}
      </p>
      <p className='mt-2 text-2xl font-semibold text-slate-900'>{input.value}</p>
    </div>
  );
}
