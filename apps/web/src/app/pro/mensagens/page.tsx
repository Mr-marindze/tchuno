'use client';

import { JobMessagesWorkspace } from '@/components/messages/job-messages-workspace';

export default function ProviderMessagesPage() {
  return (
    <JobMessagesWorkspace
      basePath='/pro/mensagens'
      title='Mensagens com clientes'
      description='Mantém a conversa por job dentro do Tchuno, com histórico persistido e indicação clara sobre o desbloqueio de contacto.'
      homeHref='/pro/pedidos'
      homeLabel='Ver pedidos'
      viewerRole='provider'
    />
  );
}
