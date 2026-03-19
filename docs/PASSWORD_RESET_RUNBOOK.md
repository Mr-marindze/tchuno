# Password Reset Runbook (MVP Assistido)

## Objetivo

Executar recuperação de senha assistida pela operação, com revogação de sessões
e registo de auditoria persistente.

## Quando usar

- Utilizador perdeu acesso e não consegue recuperar por conta própria.
- Login bloqueado por senha incorreta recorrente.
- Suporte precisa restaurar acesso com senha temporária.

## Pré-requisitos

1. Acesso ao repositório e `.env` correto para o ambiente alvo.
2. Operador autenticado e autorizado (ADMIN).
3. Dependências instaladas (`corepack yarn install`).

## Comando principal

```bash
corepack yarn workspace @tchuno/database reset-password --email <utilizador@email.com> --actor-email <admin@email.com> --reason "<ticket-ou-contexto>"
```

### Exemplo (gera senha temporária automaticamente)

```bash
corepack yarn workspace @tchuno/database reset-password --email client1@tchuno.local --actor-email admin@tchuno.local --reason "ticket-142"
```

### Exemplo com senha manual

```bash
corepack yarn workspace @tchuno/database reset-password --email client1@tchuno.local --password "Temp2026x9" --actor-email admin@tchuno.local --reason "ticket-142"
```

### Simulação sem gravar (recomendado antes)

```bash
corepack yarn workspace @tchuno/database reset-password --email client1@tchuno.local --actor-email admin@tchuno.local --dry-run
```

## O que o script faz

1. Valida o email de destino.
2. Valida operador (`--actor-email`) como ADMIN.
3. Gera ou valida senha (8-72 chars, com letra e número).
4. Atualiza `passwordHash` do utilizador.
5. Revoga todas as sessões ativas do utilizador.
6. Regista evento em `AuditLog` com ação:
   - `auth.password_reset.assisted`

## Procedimento operacional recomendado

1. Confirmar identidade mínima do utilizador (email + contexto de conta).
2. Executar `--dry-run`.
3. Executar reset real.
4. Partilhar senha temporária por canal seguro.
5. Pedir troca imediata após login.
6. Confirmar no `AuditLog` que o evento foi persistido.

## Segurança

- Nunca registar nem partilhar senha em canais públicos.
- Não enviar senha por grupos abertos.
- Incluir sempre `--reason` com ticket/contexto.
- Evitar reset sem `--actor-email`.

