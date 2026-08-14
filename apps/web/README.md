# Tchuno Web

This workspace contains the Next.js web application for Tchuno.

## Responsibilities

- public product pages;
- authentication entry screens;
- customer area under `/app`;
- provider area under `/pro`;
- admin area under `/admin`;
- route guards and role-aware navigation;
- API client helpers in `src/lib`.

## Main Route Groups

- Public: `/`, `/categorias`, `/prestadores`, `/prestadores/[slug]`,
  `/como-funciona`, `/sobre`, `/faq`, `/contacto`, `/termos`,
  `/privacidade`.
- Auth: `/login`, `/registo`, `/recuperar-senha`, `/verificar-conta`.
- Customer: `/app`, `/app/pedidos`, `/app/pedidos/[id]`, `/app/mensagens`,
  `/app/pagamentos`, `/app/perfil`.
- Provider: `/pro`, `/pro/pedidos`, `/pro/propostas`, `/pro/mensagens`,
  `/pro/ganhos`, `/pro/perfil`.
- Admin: `/admin`, `/admin/payments`, `/admin/moderation`, `/admin/users`,
  `/admin/support`, `/admin/audit`, `/admin/reports`.

## Local Commands

From the repository root:

```bash
corepack yarn dev:web
corepack yarn workspace @tchuno/web build
corepack yarn workspace @tchuno/web lint
corepack yarn workspace @tchuno/web test:smoke
```

The web app uses `NEXT_PUBLIC_API_URL` and defaults to `http://localhost:3001`.

## Important Notes

- Frontend route guards are UX helpers. Backend guards remain the source of
  truth for authorization.
- The web smoke test uses a mock API server and screenshots. It validates UI
  behavior, not a full real API integration.
- Do not present partial capabilities such as advanced geolocation, live payment
  gateways, or full KYC as implemented.

See also:

- [Product vision](../../docs/product-vision.md)
- [Architecture](../../docs/architecture.md)
- [Current status](../../docs/current-status.md)
