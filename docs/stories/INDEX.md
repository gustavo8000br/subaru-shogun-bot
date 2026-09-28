# Story Index

Índice dos arquivos em `docs/stories/`. Os estados refletem o texto registrado nas stories; criar um Draft não equivale a aprovação ou Ready.

## Epic 0 — Contratos e fundação

| Story | Status | Arquivo |
|---|---|---|
| 0.1 Escopo de dados por guild | Ready | [0.1](0.1-escopo-de-dados-por-guild.story.md) |
| 0.2 Contrato configuração/onboarding | Ready | [0.2](0.2-contrato-configuracao-onboarding.story.md) |
| 0.3 Matriz de permissões | Ready | [0.3](0.3-matriz-permissoes.story.md) |
| 0.4 Plano de migração/reconciliação | Ready | [0.4](0.4-plano-migracao-reconciliacao.story.md) |
| 0.5 Baseline de testes universais | Done | [0.5](0.5-baseline-de-testes-universais.story.md) |
| 0.6 GitHub Actions CI | Done | [0.6](0.6-github-actions-ci.story.md) |

## Epic 1 — Núcleo universal confiável

| Story | Status | Arquivo | Nota |
|---|---|---|---|
| 1.1 Limites de concorrência de squads | Draft | [1.1](1.1-limites-concorrencia-squads.story.md) | D009 aprovada; ainda aguarda Architect, QA e PO. |
| 1.2 Reconciliação Discord/PostgreSQL | Ready | [1.2](1.2-reconciliacao-discord-postgresql.story.md) | Implementação parcial; QA 7,2/10 para a fatia, sem aceite integral. |
| 1.3 Lifecycle e recuperação de squads | Draft | [1.3](1.3-lifecycle-e-recuperacao-squads.story.md) | |
| 1.4 Permissões de canais e painel | Draft | [1.4](1.4-permissoes-canais-e-painel.story.md) | |
| 1.5 Reputação com display names | Draft | [1.5](1.5-reputacao-com-display-names.story.md) | |
| 1.6 Expiração configurável por guild | Draft | [1.6](1.6-expiracao-configuravel-por-guild.story.md) | |
| 1.7 Recompensas Twitch modular | Draft | [1.7](1.7-recompensas-twitch-modular.story.md) | Alerta AIOX continua vigente; nenhum Draft 2.x o altera ou promove. |

## Epic 2 — Confiabilidade de concorrência e reconciliação

As stories abaixo são Drafts, derivados dos outcomes no [Epic 2](../prd/epic-2-confiabilidade-concorrencia-reconciliacao-discord-postgresql.md). A cadeia é sequencial. [Epic #11](https://github.com/gustavo8000br/subaru-shogun-bot/issues/11) tem as subissues #12–#16 associadas. ClickUp não se aplica ao fluxo pedido (arquivos + GitHub Issues).

| Ordem | Story | Status | Issue | Outcome | Dependências | Arquivo |
|---:|---|---|---|---|---|---|
| 2.1 | Persistir operações e outbox | Draft | [#12](https://github.com/gustavo8000br/subaru-shogun-bot/issues/12) | 1: schema/outbox | 0.1, 0.4, 0.5, 0.6; ADR-002/007; Architect review | [2.1](2.1-persistir-operacoes-e-outbox.story.md) |
| 2.2 | Provisionamento idempotente T1/P2/T3 | Draft | [#13](https://github.com/gustavo8000br/subaru-shogun-bot/issues/13) | 2: execução/retry | 2.1; 1.1/ADR-001; 1.2 baseline parcial | [2.2](2.2-provisionamento-idempotente-t1-p2-t3.story.md) |
| 2.3 | Reconciliador por fetch e encerramento seguro | Draft | [#14](https://github.com/gustavo8000br/subaru-shogun-bot/issues/14) | 3: reconciliação | 2.1 → 2.2; ADR-002/003/004/007 | [2.3](2.3-reconciliador-fetch-e-encerramento-seguro.story.md) |
| 2.4 | Auditoria confiável e minimização | Draft | [#15](https://github.com/gustavo8000br/subaru-shogun-bot/issues/15) | 3: audit/PII | 2.1 → 2.2 → 2.3; ADR-007 | [2.4](2.4-auditoria-confiavel-e-minimizacao.story.md) |
| 2.5 | Provar reserva/release de capacidade e CI | Draft | [#16](https://github.com/gustavo8000br/subaru-shogun-bot/issues/16) | 4: integração | 2.1–2.4; Story 1.1; D009 | [2.5](2.5-integrar-reserva-capacidade-evidencia-ci.story.md) |

### Regras comuns aos Drafts 2.x

- A Lei TDD Red → Green → Refactor está em `AGENTS.md` e `docs/QA_PLAN_UNIVERSAL_BOT.md` §1 e vale em cada incremento.
- Gates: revisões AIOX e GitHub Actions.
- Fluxo: Architect → QA (nota mínima 8,5/10) → PO `*validate-story-draft`; os arquivos ficam Draft até validação.
- Nenhuma story 1.1/1.2 é aceita pela criação dos Drafts; o alerta AIOX para 1.7, o NO-GO global da Fase 1 e decisões humanas aprovadas permanecem inalterados.
