# Access Fase 2: Segurança, Auditoria e Reauth

## 1) Auditoria persistente (fonte principal)

A Fase 2 adiciona auditoria persistente em base de dados no modelo `AuditLog`.

Campos principais:

- `id`
- `actorUserId` (nullable)
- `actorRole`
- `action`
- `targetType`
- `targetId`
- `status` (`SUCCESS`, `DENIED`, `FAILED`)
- `reason`
- `ipAddress`
- `userAgent`
- `route`
- `method`
- `metadata` (JSON sanitizado)
- `createdAt`

Eventos principais persistidos:

- login admin bem-sucedido (`admin.login`)
- acessos proibidos (`auth.access.denied`)
- ações admin auditadas (inclui status de sucesso/falha)
- reautenticação sucesso/falha (`auth.reauth`)
- mudança de role (`admin.user.role.change`)
- suspensão/reativação (`admin.user.suspend` / `admin.user.reactivate`)
- remoção de utilizador (`admin.user.delete`)
- alteração de configuração (`admin.setting.change`)
- exportação sensível (`admin.data.export`)

Notas de segurança:

- passwords/tokens/cookies são removidos da `metadata`.
- falhas de gravação da auditoria não devem quebrar o request principal.

## 2) Reautenticação real para ações críticas

Endpoint de confirmação:

- `POST /auth/reauth/confirm`
- requer `Authorization: Bearer <accessToken>`
- body: `{ "password": "...", "purpose"?: "..." }`
- resposta: `{ reauthToken, expiresAt }`

Uso em ações críticas:

- endpoints marcados com `@RequireReauth(...)` exigem header:
  - `x-reauth-token: <token>`

Comportamento:

- sem token, token inválido, expirado, já usado ou com propósito incompatível:
  - `403` com payload `{ code: "REAUTH_REQUIRED", reauthRequired: true, ... }`
- token válido:
  - ação crítica prossegue
- cada challenge é de uso único e TTL curto (`AUTH_REAUTH_TTL_MINUTES`, default 10)

## 3) Endpoints admin críticos adicionados

Todos em `/admin/ops/*`, protegidos por JWT + policy guard.

- `GET /admin/ops/audit-logs`
- `PATCH /admin/ops/users/:id/role` (reauth)
- `PATCH /admin/ops/users/:id/status` (reauth)
- `DELETE /admin/ops/users/:id` (reauth)
- `POST /admin/ops/exports/users` (reauth)
- `PUT /admin/ops/settings/:key` (reauth)

## 4) Evolução de roles

- `provider` continua derivado por existência de `workerProfile` (baixo risco de migração).
- admin subroles agora explícitas em `User.adminSubrole`:
  - `SUPPORT_ADMIN`
  - `OPS_ADMIN`
  - `SUPER_ADMIN`

A autorização resolve automaticamente para:

- `support_admin`, `ops_admin`, `super_admin` ou `admin`.

## 5) Legado `/dashboard/*`

`/dashboard/*` deixa de ser canónico e passa a atuar como compatibilidade:

- rotas antigas redirecionam para arquitetura nova:
  - cliente: `/app/*`
  - prestador: `/pro/*`
  - admin: `/admin/*`
- intenção/contexto continuam preservados com o fluxo de autenticação existente.

