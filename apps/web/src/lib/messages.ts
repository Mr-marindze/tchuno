import { API_URL } from '@/lib/auth';
import { readApiError } from '@/lib/http-errors';

export type MessageConversationSummary = {
  jobId: string;
  requestId: string | null;
  title: string;
  status: string;
  contactUnlocked: boolean;
  counterpart: {
    id: string;
    name: string | null;
    email: string | null;
  };
  unreadCount: number;
  latestMessage: {
    id: string;
    jobId: string;
    senderUserId: string;
    recipientUserId: string;
    content: string;
    createdAt: string;
    readAt: string | null;
  } | null;
  lastActivityAt: string;
  createdAt: string;
};

export type JobMessage = {
  id: string;
  jobId: string;
  senderUserId: string;
  recipientUserId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type JobConversation = {
  conversation: {
    jobId: string;
    requestId: string | null;
    title: string;
    status: string;
    contactUnlocked: boolean;
    counterpart: {
      id: string;
      name: string | null;
      email: string | null;
    };
    createdAt: string;
  };
  trustSafety: {
    activeIntervention: TrustSafetyIntervention | null;
    recentInterventions: TrustSafetyIntervention[];
  };
  items: JobMessage[];
};

export type TrustSafetyIntervention = {
  id: string;
  jobId: string;
  actorUserId: string;
  counterpartUserId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'WARNING' | 'TEMP_BLOCK';
  status: 'LOGGED' | 'OPEN' | 'APPEALED' | 'CLEARED' | 'ENFORCED';
  reasonSummary: string;
  messagePreview: string;
  blockedUntil: string | null;
  appealRequestedAt: string | null;
  appealReason: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  isBlocking: boolean;
};

export type SendJobMessageResult =
  | {
      status: 'sent';
      message: JobMessage;
    }
  | {
      status: 'warning' | 'blocked';
      intervention: TrustSafetyIntervention;
      guidance: {
        title: string;
        description: string;
        ctaHref: string;
        ctaLabel: string;
        appealAllowed: boolean;
      };
    };

export async function listMyMessageConversations(
  accessToken: string,
): Promise<MessageConversationSummary[]> {
  const response = await fetch(`${API_URL}/messages/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as MessageConversationSummary[];
}

export async function getJobConversation(
  accessToken: string,
  jobId: string,
): Promise<JobConversation> {
  const response = await fetch(`${API_URL}/messages/jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as JobConversation;
}

export async function sendJobMessage(
  accessToken: string,
  jobId: string,
  input: { content: string },
): Promise<SendJobMessageResult> {
  const response = await fetch(`${API_URL}/messages/jobs/${jobId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as SendJobMessageResult;
}

export async function markJobConversationRead(
  accessToken: string,
  jobId: string,
): Promise<{
  updatedCount: number;
  readAt: string;
}> {
  const response = await fetch(`${API_URL}/messages/jobs/${jobId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as {
    updatedCount: number;
    readAt: string;
  };
}

export async function appealTrustSafetyIntervention(
  accessToken: string,
  interventionId: string,
  input: { reason: string },
): Promise<TrustSafetyIntervention> {
  const response = await fetch(
    `${API_URL}/trust-safety/interventions/${interventionId}/appeal`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as TrustSafetyIntervention;
}
