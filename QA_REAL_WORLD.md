# QA Real Do Fluxo Ponta a Ponta

Objetivo: quebrar o sistema de propósito antes de colocar utilizadores reais.

## 1) Comandos base

```bash
corepack yarn install
corepack yarn workspace @tchuno/api test:e2e
corepack yarn workspace @tchuno/web build
```

Subir local:

```bash
docker compose up -d
corepack yarn dev
```

API: `http://localhost:3001`  
Web: `http://localhost:3000`

## 2) Cenários já automatizados (E2E API)

- Worker sem perfil a listar jobs de worker: `404`
- Worker indisponível a receber job: `409`
- Criação de job inválido (validação DTO): `400`
- Criação de job com `scheduledFor` no passado: `400`
- Transições fora de ordem (`REQUESTED -> COMPLETED`, `ACCEPTED -> COMPLETED`): `409`
- Review duplicada para o mesmo job: `409`
- Filtro de worker com `categorySlug` inválido: `400`
- Refresh token expirado (JWT com `exp` passado): `401`
- Múltiplas sessões/tabs + `logout-all` + refresh em ambas: `401`
- Sessões paginadas com `meta` (`hasNext/hasPrev/page/pageCount`) após revogação

## 3) QA manual no browser real

### Sessões e múltiplas tabs

1. Abrir Tab A e Tab B com o mesmo utilizador.
2. Fazer login em ambas.
3. Em Tab A, executar `Logout All`.
4. Em Tab B, clicar `Refresh` e confirmar erro humano de sessão inválida.
5. Confirmar que a lista `/auth/sessions` reflete sessões revogadas.

### Refresh token reutilizado

1. Fazer login e copiar `refreshToken` do resultado.
2. Executar `Refresh` uma vez.
3. Tentar usar o token antigo novamente (via UI/API client).
4. Confirmar `401` e cadeia revogada.

### Validação de formulário

Testar inputs absurdos:

- email inválido
- password sem número/letra
- title curto
- budget negativo
- review rating fora de 1..5
- campos muito longos (bio/comentário)

Esperado: bloqueio no frontend + erro claro no backend quando bypassar UI.

### Responsividade mobile

No DevTools:

1. iPhone SE / Pixel 7 / iPad Mini
2. Verificar login e dashboard completos
3. Verificar overflows horizontais e botões inacessíveis
4. Verificar paginação/filtros usáveis sem zoom

### Rede fraca/latência

No DevTools > Network:

1. `Slow 3G` e depois `Offline`
2. Tentar login, refresh, create job, create review
3. Confirmar estados de loading/erro/empty e recuperação após voltar online

## 4) Critério de saída desta fase

- E2E API verde
- Fluxo manual em 3 viewports (mobile + desktop) sem bloqueios críticos
- Erros sempre legíveis para humano
- Sem ação protegida passar sem token/permissão correta

## 5) Execução do Checkpoint 3 (17 de março de 2026)

### Resultado automatizado (executado)

- `corepack yarn workspace @tchuno/web lint` -> **PASS**
- `corepack yarn workspace @tchuno/web build` -> **PASS**
- `corepack yarn workspace @tchuno/api test:e2e` -> **PASS (9/9)**
- `corepack yarn lint && corepack yarn test` -> **PASS**

### Ajustes de UX/responsividade aplicados

- Quebra de texto longa em cards/result/toasts para evitar overflow horizontal.
- Alvos de toque mínimos (`min-height`) para botões em mobile.
- Toolbar mais flexível para filtros/inputs em diferentes larguras.
- Inputs com `font-size: 16px` em mobile para evitar zoom automático no iOS.

### Checklist manual para fechar fase (browser real)

Marca cada item como `OK` ou `NOK` durante validação manual:

- [ ] **Sessões em múltiplas tabs** (logout-all invalida tab secundária)
- [ ] **Refresh token reutilizado** (cadeia revogada e erro humano claro)
- [ ] **Validações absurdas** (frontend bloqueia e backend retorna mensagem clara)
- [ ] **Responsividade iPhone SE** (sem overflow, botões clicáveis)
- [ ] **Responsividade Pixel 7** (filtros/paginação sem atrito)
- [ ] **Responsividade iPad Mini** (layout estável, sem cortes)
- [ ] **Rede Slow 3G** (loading/error coerentes)
- [ ] **Modo Offline e recuperação** (mensagem clara + retoma ao voltar online)
