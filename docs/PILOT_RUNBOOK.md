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

### Fluxo FIXED_PRICE

1. Cliente cria job `FIXED_PRICE`.
2. Worker aceita job.
3. Worker inicia (`IN_PROGRESS`).
4. Worker conclui (`COMPLETED`).
5. Cliente publica review.

### Fluxo QUOTE_REQUEST

1. Cliente cria job `QUOTE_REQUEST`.
2. Worker envia proposta com valor.
3. Cliente aceita proposta.
4. Worker inicia.
5. Worker conclui.
6. Cliente publica review.

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
2. Fluxos FIXED_PRICE e QUOTE_REQUEST validados ponta a ponta.
3. Cancelamento com motivo validado.
4. Review pós-COMPLETED validada.
5. Painel `Admin Ops` a responder no dashboard admin.
