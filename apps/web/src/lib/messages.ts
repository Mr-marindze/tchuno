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
  items: JobMessage[];
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
): Promise<JobMessage> {
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

  return (await response.json()) as JobMessage;
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
