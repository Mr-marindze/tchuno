# Pilot Runbook (MVP)

## Objetivo

Garantir operação mínima consistente em staging para piloto controlado, com
passos claros para subir ambiente, validar fluxos e recolher evidências.

## Pré-requisitos

1. `.env.staging` preenchido e válido.
2. Docker ativo.
3. Dependências instaladas (`corepack yarn install`).

## 1) Subir staging

1. Subir base de dados:
   - `corepack yarn staging:db:up`
2. Aplicar migrations + seed:
   - `corepack yarn staging:bootstrap`
3. Subir API (terminal 1):
   - `corepack yarn staging:api`
4. Subir Web (terminal 2):
   - `corepack yarn staging:web`
5. Validar saúde:
   - `corepack yarn staging:check`

## 2) Contas demo (seed)

- Email: `admin@tchuno.local` | Password: `demo1234`
- Email: `client1@tchuno.local` | Password: `demo1234`
- Email: `client2@tchuno.local` | Password: `demo1234`
- Email: `worker1@tchuno.local` | Password: `demo1234`
- Email: `worker2@tchuno.local` | Password: `demo1234`

## 3) Validação funcional rápida

### Fluxo oficial Service Request

1. Cliente cria `ServiceRequest`.
2. Pelo menos 2 prestadores submetem `Proposal`.
3. Cliente seleciona 1 proposta.
4. Sistema cria `Job` + `PaymentIntent` de sinal.
5. Cliente paga sinal.
6. Confirmar desbloqueio de contacto apenas após pagamento.
7. Prestador executa: `REQUESTED -> ACCEPTED -> IN_PROGRESS -> COMPLETED`.
8. Cliente publica review.

### Fluxos financeiros críticos

1. Cancelamento antes do pagamento.
2. Cancelamento depois do pagamento e antes de `IN_PROGRESS` (refund total).
3. Cancelamento após `IN_PROGRESS` (refund parcial/manual).
4. `COMPLETED` -> janela de disputa -> release -> payout.
5. Callback duplicado não pode duplicar ledger.

### Regras operacionais críticas

1. Cancelamento exige motivo.
2. Review só pode ser criada após `COMPLETED`.
3. CTA principal no dashboard deve estar único e coerente por estado/contexto.

## 4) Limpeza de dados de teste

### Opção A (rápida, não destrutiva)

1. Reaplicar seed para restaurar baseline demo:
   - `set -a && source .env.staging && set +a && corepack yarn workspace @tchuno/database prisma db seed`

### Opção B (reset total staging, destrutiva)

1. Derrubar BD com volume:
   - `docker compose --env-file .env.staging -f docker-compose.staging.yml down -v`
2. Subir novamente:
   - `corepack yarn staging:db:up`
3. Recriar baseline:
   - `corepack yarn staging:bootstrap`

## 5) Evidências mínimas

1. Screenshots do dashboard (desktop e mobile) com timeline e CTA por estado.
2. Registo de `x-request-id` para falhas observadas.
3. Resultado da saúde:
   - `GET /observability/health`
   - `GET /observability/metrics`
4. Nota curta dos cenários validados (pass/fail + timestamp).

## 6) Observações conhecidas de staging

1. Se aparecer `Status: Failed to fetch`, validar API em execução na porta de
   staging e `NEXT_PUBLIC_API_URL`.
2. Confirmar `WEB_ORIGIN` com hosts usados (ex.: `localhost` e `127.0.0.1`).
3. Após mudanças de schema, sempre correr bootstrap antes do smoke.

## 7) Gate antes de demo/piloto

1. `corepack yarn ci` verde.
2. Fluxo `ServiceRequest -> Proposal -> Selection -> Job` validado ponta a ponta.
3. Sinal obrigatório e desbloqueio de contacto pós-pagamento validados.
4. Cancelamento com motivo + refund por fase validados.
5. Review pós-`COMPLETED` validada.
6. Painel `Admin Ops` a responder no dashboard admin.
