# Tchuno Backlog And Roadmap Notes

This file preserves the historical roadmap while pointing to the current
planning baseline.

For current status and candidate next work, use:

- [docs/current-status.md](docs/current-status.md)
- [docs/roadmap.md](docs/roadmap.md)

The items below are historical sprint notes. They should not be read as a claim
that Tchuno is production-ready.

## Historical Completed Work

### Sprint A: Stabilization And UX

1. [x] Categories
2. [x] WorkerProfile
3. [x] Jobs
4. [x] Reviews
5. [x] E2E: client -> worker -> job status -> review flow
6. [x] CI pipeline completa (Yarn 4/Corepack)
7. [x] Observabilidade
8. [x] Hardening extra
9. [x] UX de sessões
10. [x] Polimento UX dashboard (navegação, estados, toasts)
11. [x] QA checklist + responsividade final

### Sprint B: Trust And Marketplace Readiness

1. [x] Perfil público de worker mais convincente
2. [x] Reputação mínima / stats simples
3. [x] Dados de localização (bairro/cidade) mais claros
4. [x] Disponibilidade básica mais visível
5. [x] Sinais de perfil completo/verificação
6. [x] Refinamento do fluxo job -> aceitação -> conclusão -> review

### Sprint C: Pilot Readiness

1. [x] Ambiente staging limpo
2. [x] Dados demo
3. [x] Métricas mínimas de uso
4. [x] Logs e observabilidade básica de operação
5. [x] Checklist operacional do piloto
6. [x] Roteiro de teste com utilizadores reais

## Current Foundation

The current foundation is an advanced functional MVP with pilot readiness
conditions. The request-first flow is the official product path:

`ServiceRequest -> Proposal -> Selection -> Job`

The implementation also includes payment intents, protected contact unlock,
execution status transitions, and reviews.

## Candidate Next Work

Do not treat this as an approved future version. It is a prioritized candidate
set for planning:

1. Validate and repair demo seed compatibility.
2. Replace or retire the placeholder app Dockerfile.
3. Harden non-development secret handling.
4. Decide live payments versus controlled pilot payment operation.
5. Harden upload validation and storage policy.
6. Add frontend integration tests against the real API.
7. Clarify provider role/onboarding model.
8. Define deploy, release, backup, and external observability plan.
9. Add security scanning to CI.

## Future / Undecided

The following are not approved current scope:

- USSD;
- SMS;
- advanced algorithmic matching;
- precise GPS-based public location;
- full KYC provider verification;
- production live external payment providers;
- native mobile apps.
