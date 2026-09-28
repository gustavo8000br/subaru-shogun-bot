# Story 0.5 — catálogo finito e evidência

Gerado: 2026-09-28T03:34:46Z. Resultados locais não equivalem a ensaio operacional nem a aprovação de QA/Architect.

| ID | Tipo | Pré-condição, ação e resultado esperado | Resultado e evidência |
|---|---|---|---|
| B0.5-01 | Integração PostgreSQL | Fixtures A/B sintéticas; consultar e alterar user-shared em A; B deve permanecer inalterada | PASS; `tests/postgres-integrity.test.ts`; `pipeline-latest.md` |
| B0.5-02 | Harness/integração + contrato | Schema legado sintético, migrations, URLs negativas; URL não permitida recusada e container removido | URL guard/negative DB gate; migrations e AuditLog/SquadMember/index postconditions: PASS; cleanup: PASS; `tests/postgres-integrity.test.ts`, `scripts/test-integration.sh` |
| B0.5-03 | Unitário de contrato | Clock virtual para 5 min/24 h, downtime, grace, emptySinceAt e eventos; wall-clock determinístico sem sleep | PASS; `tests/baseline-contracts.test.ts`; não afirma implementação funcional de expiração |
| B0.5-04 | Unitário de contrato | Fake com sucesso/falha por chamada; delete exige operação terminal registrada e fetch remoto que confirme guild/ownership; forged, ausente e owner divergente não apagam | PASS; `tests/baseline-contracts.test.ts`, `tests/support/fake-discord.ts`; Architect ainda precisa revisar |
| B0.5-05 | Pipeline/segurança | Executar gates disponíveis e inventariar CI/scanner; findings e ausências explícitos | Consulte `pipeline-latest.md`; SEC-009 HIGH/OPEN/WAIVED, GitHub Actions e scanner têm status próprios |

## Limites da evidência

- `npm test` roda sem DATABASE_URL/AIOX_TEST_DATABASE; testes PostgreSQL aparecem como skipped nesse modo.
- `npm run test:integration` usa PostgreSQL 16 efêmero, schema sintético e migrations; não é ensaio operacional/cutover nem valida Discord real.
- Build, lint, typecheck e Prisma validate são gates estáticos/estruturais, não aceite comportamental.
- Execução local não é evidência de GitHub Actions; ver status de configuração e hosted run em `pipeline-latest.md`. Secret scanning está BLOCKED sem gitleaks.
- O fake é uma fronteira de teste e requer parecer Architect; nenhum parecer QA/Architect foi inventado.
