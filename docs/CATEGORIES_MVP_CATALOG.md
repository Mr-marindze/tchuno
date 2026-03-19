# MVP Official Categories (Admin-Controlled)

## Objetivo

Manter um catálogo oficial de categorias para o MVP, gerido apenas por ADMIN.

## Regra de negócio

- Utilizadores normais e prestadores **não** criam categorias diretamente.
- Criação/edição de categorias mantém-se no fluxo admin.
- O seed apenas garante um conjunto inicial curado e idempotente.

## Catálogo oficial inicial

1. Canalização (`canalizacao`)
2. Eletricista (`eletricista`)
3. Reparações Domésticas (`reparacoes-domesticas`)
4. Construção (`construcao`)
5. Pintura (`pintura`)
6. Carpintaria (`carpintaria`)
7. Limpeza (`limpeza`)
8. Jardinagem (`jardinagem`)
9. Transporte & Mudanças (`transporte-mudancas`)
10. Montagem & Instalação (`montagem-instalacao`)
11. Refrigeração & AVAC (`refrigeracao-avac`)
12. Mecânica Automóvel (`mecanica-automovel`)
13. Beleza & Estética (`beleza-estetica`)
14. Serviços Domésticos (`servicos-domesticos`)

## Como popular em dev/staging

```bash
corepack yarn workspace @tchuno/database prisma db seed
```

Em staging, o bootstrap já executa seed:

```bash
corepack yarn staging:bootstrap
```

Para sincronizar só catálogo oficial (sem executar seed completo de demo):

```bash
corepack yarn ops:sync-categories
```

## Comportamento de segurança

- O catálogo usa `upsert` por `slug`.
- Categorias oficiais são criadas se não existirem.
- Se já existirem, são atualizadas com `name`, `description`, `sortOrder` e `isActive`.
- Outras categorias existentes **não** são removidas.
- Categorias legadas mapeadas são consolidadas de forma idempotente.

## Consolidação de legados

- Mapeamento atual:
  - `eletricidade` -> `eletricista`
- A sincronização:
  1. move referências de `WorkerProfileCategory` para a categoria canónica;
  2. move `Job.categoryId` para a categoria canónica;
  3. consolida `TrackingCategoryAggregate` por slug;
  4. desativa a categoria legada para não aparecer no catálogo oficial.

## Atualizações futuras (seguras)

1. Alterar a lista oficial em `packages/database/prisma/catalog/official-categories.ts`.
2. Preservar `slug` sempre que possível para evitar quebra de referências.
3. Executar sincronização:
   - `corepack yarn ops:sync-categories`
4. Em dev/staging, opcionalmente reaplicar seed:
   - `corepack yarn workspace @tchuno/database prisma db seed`
