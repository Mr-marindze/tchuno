'use client';

import { JobMessagesWorkspace } from '@/components/messages/job-messages-workspace';

export default function CustomerMessagesPage() {
  return (
    <JobMessagesWorkspace
      basePath='/app/mensagens'
      title='Mensagens do teu job'
      description='Conversa com o prestador dentro do Tchuno e acompanha quando o contacto direto já está desbloqueado pelo estado do job.'
      homeHref='/app/pedidos'
      homeLabel='Ver pedidos'
      viewerRole='customer'
    />
  );
}
