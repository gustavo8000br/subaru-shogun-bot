# EPIC-2: Confiabilidade de Concorrência e Reconciliação Discord/PostgreSQL

**Status:** 📋 Planning
**Owner:** @pm
**Created:** 2026-09-28
**Fontes de produto:** `docs/PROJECT_DIRECTION.md` §§12.1–13; issues existentes #3 e #4
**Fontes arquiteturais:** ADR-001/002/003/004/007 em `docs/ARCHITECTURE_DECISIONS.md`; Decisão Humana 009 aprovada

---

## Objective

Fechar os invariantes de concorrência, provisionamento e reconciliação para que cada guild respeite sua capacidade e possa recuperar falhas Discord/PostgreSQL sem duplicar operações, perder registros ou tocar recursos sem ownership comprovado. O Epic organiza a conclusão dos contratos já aprovados e transforma a fatia parcial entregue em caminho durável, observável e comprovado por TDD e GitHub Actions.

## Business Value

Mantenedores e membros podem confiar que squads reservadas no PostgreSQL correspondem a operações Discord recuperáveis. Falha parcial ou restart não deve criar canais duplicados, liberar capacidade prematuramente ou apagar canais comunitários. A capacidade fica reservada enquanto o estado `pending_reconciliation` não for persistido como não contado, conforme D009.

## Existing System Context

- O ShogunBot é um bot Discord multi-guild, escrito em TypeScript/Node.js, com Prisma/PostgreSQL, `SquadManager`, testes com PostgreSQL efêmero e GitHub Actions.
- ADR-001 determina locks namespaced e transações SQL curtas para invariantes de squads/membros. A contagem de capacidade aprovada inclui `provisioning`, `active` e `pending_reconciliation`; lock `squad_count` protege apenas T1 e termina no commit.
- ADR-002 determina a máquina de estados, operação/outbox persistida, chave idempotente `requestId`, ownership verificável e ciclo T1 SQL → commit → P2 Discord → T3 SQL. Efeitos externos são serializados por operação e cada ID de recurso é persistido antes do próximo efeito. Reconciliador executa no startup e periodicamente, usa `fetch` em vez de inferir ausência pelo cache, e requer duas ausências consecutivas para encerrar por canal ausente.
- ADR-003/004/007 orientam autorização, lifecycle/expiração e auditoria/privacidade; Stories 0.1 e 0.4 estabelecem contratos de tenant, identidade, retenção e runbook. Story 0.5 fornece harness/utilitários; Story 0.6 fornece CI hospedado por GitHub Actions.
- Stories 1.1–1.7 já ocupam a numeração do Epic 1. Para este Epic 2, 1.1/1.2 são antecedentes e baseline: Story 1.1 (`Draft`) é dona da concorrência/capacidade; Story 1.2 (`Ready`) é dona do contrato de reconciliação, com implementação parcial e ACs não concluídos. Não se altera lifecycle de nenhuma story existente.

### Baseline entregue — progresso reportado, não aceite

O Dev Record da Story 1.2 reporta que `src/squadManager.ts` agora commita T1 antes de efeitos P2, persiste IDs de canais entre efeitos, mantém pending em cache miss e não apaga candidato a canal somente por nome/cache. Reporta três ciclos TDD e até 33/33 integrações locais, além de lint/typecheck/testes/build/Prisma validate locais verdes. Isso é evidência declarada pelo executor, não verificação independente: o Architect fez revisão estática e não executou testes; não há run GitHub Actions desta alteração. QA atribuiu **7,2/10 para a fatia entregue** e não a aprovou como slice; a Story 1.2 completa permanece sem aceite e sem Done. Os ACs originais continuam sendo a fonte do contrato e não são reduzidos por este Epic.

## Scope

### In Scope

- Fechar o contrato de persistência para `ProvisioningOperation`, `requestId` e outbox/progresso durável, com modelagem/migração própria revisada antes da integração ao serviço.
- Completar T1/P2/T3: commit observável antes de Discord, persistência de cada ID/progresso antes do próximo efeito, estados terminais/retry e idempotência após falhas/restart.
- Completar reconciliação startup e periódica, ownership fail-closed, `fetch` remoto, janela de graça, duas observações de ausência, recuperação/reparo idempotente e fechamento `closing → closed` sem deleção por inferência.
- Corrigir encerramento/cleanup para preservar histórico, respeitar D009, não apagar recursos desconhecidos e não silenciar falha de persistência/auditoria.
- Provar a integração com Story 1.1 sob PostgreSQL: `pending_reconciliation` mantém a vaga; somente estado persistido não contado, lido por uma nova contagem sob o lock, permite reutilizá-la.
- Criar e executar testes por incremento conforme Red → Green → Refactor em `AGENTS.md` e QA Plan §1; registrar RED funcional separado de falha de fixture/harness e preservar histórico sem reclassificação retroativa.
- Executar gates aplicáveis localmente e no GitHub Actions associado ao commit; reportar migrations, asserts, resultado e cleanup do PostgreSQL efêmero.

### Out of Scope

- Reabrir escolhas de produto já aprovadas em D009 ou alterar defaults/estados dos ADRs por conveniência de implementação.
- Importar o dataset ativo SubaruShogun, operar cutover/produção, executar deploy ou usar guild/dados reais. Seguir D004/Story 0.4 para qualquer trabalho futuro de operação.
- Entregar lifecycle completo fora das interseções necessárias à reconciliação (Story 1.3), novas permissões (Story 1.4), reputação, economia ou Twitch.
- Marcar Story 1.1/1.2 Ready, Done ou qualquer gate de release automaticamente por concluir este documento.
- Criar aqui os arquivos de story ou registrar issues remotas; a decomposição é handoff para @sm e gravação de issues é responsabilidade de @devops.

## Baseline de qualidade e gaps não aceitos

A revisão estática Architect da fatia documenta progressos delimitados: SQL de T1 antes de P2 no fluxo observado, gravação incremental dos IDs, proteção contra delete baseado só em nome/cache e retenção em `pending_reconciliation` durante cache miss. A QA pontuou essa fatia em 7,2/10, apontando que os resultados de teste eram reportados pelo Dev, não reexecutados por QA/Architect; não havia run hosted para o diff; e o teste T1 observava fim do callback, não a resolução bem-sucedida da Promise externa de `$transaction`.

Permanecem gaps que impedem aceite da Story 1.2 inteira: schema sem `ProvisioningOperation`/outbox/`requestId` durável; ausência de ligação durável entre retry, operação e ownership; fetch API, graça, duas observações, reconciliador periódico e retomada pós-restart não completados; fechamento ainda destrutivo/sem garantias de audit transacional; e política de slot sem prova conjunta da Story 1.1. Falhas de audit podem ser silenciadas e há finding de minimização de PII em eventos de canal. Nenhum desses gaps é declarado resolvido neste Epic.

## Work Outcomes e ordem das stories @sm

As stories 2.1–2.5 abaixo foram criadas como **Drafts**, por autorização explícita do proprietário para decompor este Epic, e foram registradas como subissues GitHub #12–#16 do [Epic #11](https://github.com/gustavo8000br/subaru-shogun-bot/issues/11). Os caminhos e IDs/URLs também constam em [`docs/stories/INDEX.md`](../stories/INDEX.md). Nenhuma story foi promovida a Ready/Done. A sequência AIOX alerta que Story 1.7 ainda está Draft; a autorização de preparar estes arquivos não altera nem contorna esse alerta e não equivale a aceite de risco para implementação.

| Ordem | Story(s) Draft | Issue | Outcome | Resultado especificado | Dependências |
|---|---|---|---|---|---|
| 1 | [2.1 — Persistir operações e outbox](../stories/2.1-persistir-operacoes-e-outbox.story.md) | [#12](https://github.com/gustavo8000br/subaru-shogun-bot/issues/12) | Outcome 1, P0 | `ProvisioningOperation`, requestId por guild, estado/plano/progresso/IDs e migration/rollback testados antes da integração. | Architect; ADR-002/007; Stories 0.1/0.4/0.5/0.6. |
| 2 | [2.2 — Provisionamento idempotente T1/P2/T3](../stories/2.2-provisionamento-idempotente-t1-p2-t3.story.md) | [#13](https://github.com/gustavo8000br/subaru-shogun-bot/issues/13) | Outcome 2, P0 | Commit T1 observado antes de P2; persistência incremental; retry/restart não duplica. | 2.1; Story 1.1/ADR-001; Story 1.2 como contrato baseline parcial. |
| 3 | [2.3 — Fetch e encerramento seguro](../stories/2.3-reconciliador-fetch-e-encerramento-seguro.story.md) | [#14](https://github.com/gustavo8000br/subaru-shogun-bot/issues/14) | Outcome 3, P0 | Startup/periódico, fetch, grace, duas ausências, ownership fail-closed e `closing → closed`. | 2.1 → 2.2; ADR-002/003/004/007. |
| 4 | [2.4 — Auditoria confiável e minimização](../stories/2.4-auditoria-confiavel-e-minimizacao.story.md) | [#15](https://github.com/gustavo8000br/subaru-shogun-bot/issues/15) | Outcome 3, P0 | Evento consistente com transição, falha não silenciada, allowlist/PII e retenção/isolamento testados. | 2.1 → 2.2 → 2.3; ADR-007. |
| 5 | [2.5 — Prova integrada de capacidade e CI](../stories/2.5-integrar-reserva-capacidade-evidencia-ci.story.md) | [#16](https://github.com/gustavo8000br/subaru-shogun-bot/issues/16) | Outcome 4, P1 | Teste concorrente PostgreSQL prova slot pendente e release somente após transição persistida/recontagem; Actions do commit. | 2.1 → 2.2 → 2.3 → 2.4; Story 1.1; D009; Stories 0.5/0.6. |

Cada story permanece Draft e segue Architect → QA ≥8,5/10 → PO `*validate-story-draft` antes de eventual Ready. TDD Red → Green → Refactor é obrigatório por incremento. Issues #12–#16 foram criadas como subissues do Epic #11; ClickUp não se aplica ao pedido explícito de arquivos + GitHub Issues. Não marcar 1.1/1.2 como aceitas por causa destes Drafts.

## Success Criteria

- Cada request de provisionamento/encerramento tem operação identificável e progresso persistido; retry concorrente/restart não duplica recursos ou mudanças de domínio.
- A Promise da transação T1 resolve/commita antes da primeira chamada Discord; toda persistência de ID acontece antes do efeito subsequente, provado por testes que observam o serviço real.
- Falhas em P2, T3, fetch, permissão e banco resultam em estado/erro auditável e recuperável; nenhuma falha relevante vira sucesso silencioso.
- Fetch indisponível, cache frio ou uma única ausência não fecha nem apaga recurso; as duas observações previstas no ADR são exigidas antes de `reconciled_missing_channel`.
- Nenhum recurso sem ownership comprovado é alterado/deletado; logs/auditoria seguem minimização e sobrevivem conforme ADR-007.
- Capacidade D009 permanece reservada enquanto `pending_reconciliation`; vaga só pode ser usada após estado não contado persistido, comprovado no limite concorrente PostgreSQL da Story 1.1.
- Todos os ciclos novos têm evidência Red → Green → Refactor por incremento, e testes pertinentes passam em PostgreSQL efêmero e GitHub Actions para o commit avaliado; resultados e cleanup são rastreáveis.
- QA avalia stories da fatia com ≥8,5/10 antes do GO PO; @architect fecha quality gate e nenhuma story é declarada Done sem ACs/evidências próprios.

## Technical Requirements

- Preservar `guildId` em reads/writes/operations e separar locks de contagem/membership por namespace, conforme ADR-001.
- T1/T3 executam SQL; P2 executa efeitos externos após commit; não manter conexão/lock transacional durante rede.
- Usar `requestId` durável por interação e ownership por operação/marker/API fetch; nomes, cache, tipo e posição não substituem ownership.
- Aplicar transições de lifecycle e motivos aprovados em ADR-002/004; `pending_reconciliation` permanece contado por D009 até transição persistida a status não contado.
- Incluir testes com PostgreSQL efêmero e doubles Discord com falha por chamada; não alegar teste de mock como prova de comportamento real ou de permissão Discord.
- CI oficial é GitHub Actions; runs antigos são baseline e não substituem run por branch/commit desta entrega.
- Migração/schema e rollback têm review arquitetural prévio e seguem o plano aprovado em Story 0.4; este Epic não autoriza operação real.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deletar canal comunitário por inferência ou cache frio | Critical | Ownership durável, fetch real e falhar fechado; cobertura negativa antes de permitir delete. |
| Retry cria operação/canais duplicados ou reserva inconsistente | High | Restrição/idempotência persistente por `(guildId, requestId)` e integração de concorrência em PostgreSQL. |
| Alinhar schema novo de forma incompatível com migrations/retention | High | Story de schema separada, Architect/Data review e compatibilidade/runbook antes de aplicar migration. |
| `pending_reconciliation` libera slot cedo | High | D009 fixa a semântica; Story 1.1 reconta estado persistido sob lock após transição 1.2. |
| Auditoria silenciosamente falha ou captura PII de canal | High | Allowlist/minimização ADR-007, persistência auditável e teste de falha de audit. |
| Declarar qualidade com evidência local antiga ou não reproduzida | High | Red funcional por incremento, QA independente e GitHub Actions run associado ao commit; distinguir reportado de verificado. |

**Mitigação principal:** dividir desenho de schema, integração de efeitos e reconciliação em entregas dependentes; nenhuma operação externa ocorre até que cada story tenha arquitetura, autorização e rollback adequados.
**Rollback:** definir e aprovar procedimento técnico em cada story de schema/runtime contra Story 0.4 antes de migration/operação. Este Epic não autoriza rollback real, cutover ou deploy.

## Quality Assurance Strategy

- Cada mudança de produção começa com RED funcional comprovável, segue GREEN mínimo, refactor e reexecução dos testes relevantes; setup/harness falho não é RED.
- @architect revisa modelo persistido, invariantes, transaction boundaries, ownership e integração com 1.1.
- @qa valida ACs, evidência local/hosted, falhas, restart, privacidade, cleanup e atribui nota; threshold para avançar é 8,5/10.
- GitHub Actions é o gate hospedado do repositório, conforme Story 0.6; @devops é o agente autorizado para ações remotas, issues e PRs.
- Não usar serviços externos de revisão automatizada; usar gates do GitHub Actions e revisões AIOX.

## Dependencies

**Depends on:**
- `docs/ARCHITECTURE_DECISIONS.md` ADR-001/002/003/004/007 e atualização pós-D009.
- Decisão Humana 009 aprovada — Opção A; D009 não autoriza deleção nem muda T1/P2/T3.
- Stories 0.1/0.4 `Ready`, 0.5/0.6 `Done`; servem como contratos/harness/CI, não como prova de novos comportamentos.
- Story 1.1 para locks/capacidade/concorrência; Story 1.2 como contrato de reconciliação e baseline parcial ainda não aceita integralmente.

**Blocks:**
- Aceite completo/Done da Story 1.2 e resolução demonstrada dos invariants de #3/#4.
- Conclusão de gates da Fase 1 relacionados a lifecycle, autorização e evidência; este Epic não libera a Fase 1 por si só.

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Direção de produto | `docs/PROJECT_DIRECTION.md` §§12.1–13 | Aprovada; gate Fase 1 ainda independente |
| Arquitetura | `docs/ARCHITECTURE_DECISIONS.md` ADR-001/002/003/004/007 | Fonte técnica; ADR-001 pós-D009 alinhado |
| Decisão humana | `docs/human_decisions/DONE/decisao-009-contagem-pending-reconciliation-v1.0.0.md` | Aprovada |
| Story/revisões | `docs/stories/1.1-limites-concorrencia-squads.story.md`; `docs/stories/1.2-reconciliacao-discord-postgresql.story.md` | Stories 1.1–1.7 existentes; 1.1 Draft, 1.2 Ready com fatia parcial e QA 7.2; sem aceite completo |
| QA Plan / baseline | `docs/QA_PLAN_UNIVERSAL_BOT.md` §§1, 4–8, 12; Stories 0.5/0.6 | QA Plan; harness/CI baseline não prova estes comportamentos |
| Runbook de migração | `docs/runbooks/subarushogun-migration-reconciliation.md` | Draft não executável; aplicar conforme gates próprios |

## Definition of Done

- [ ] Cada outcome decomposto em stories independentes por @sm, com ACs rastreáveis e dependências, e passa lifecycle AIOX individual.
- [ ] Dado/schemas/operation/outbox aprovados por Architect e migrations cobertas por teste/rollback antes de uso pelo serviço.
- [ ] T1/P2/T3 e recovery/retry provados por TDD real, inclusive os pontos de falha e restart.
- [ ] Reconciliador só executa reparo/deleção sob regras de ownership, fetch, audit, status e tempo aprovados.
- [ ] Story 1.1 e esta integração demonstram reserva/liberação por PostgreSQL sob concorrência, em conformidade com ADR-001/D009.
- [ ] QA score ≥8,5 em cada story aplicável e Architect quality gate final GO.
- [ ] GitHub Actions passa no commit final; logs/run IDs, migrations, assertions, segurança aplicável e cleanup registrados.
- [ ] Nenhum recurso desconhecido ou dados de outra guild é alterado; nenhuma falha de audit/persistência crítica é silenciada.
- [ ] ACs pertinentes das Stories 1.1/1.2 só são marcados pelo executor quando cada comportamento/evidência correspondente estiver realmente concluído; nenhuma marcação retrospectiva.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-28 | 1.0.0 | Epic de planejamento criado a partir de ADRs existentes, Story 1.1/1.2 e achados de Architect/QA. Registra a implementação parcial como baseline reportado e organiza outcomes/dependências; não cria stories/índices remotos, não promove status e não libera Fase 1. | @pm |
| 2026-09-28 | 1.0.1 | Epic renumerado de EPIC-1 para EPIC-2 para evitar colisão com as Stories 1.1–1.7 já existentes; 1.1/1.2 permanecem antecedentes/baseline. Numeração futura 2.1+ condicionada ao fluxo AIOX/core-config e ao alerta da Story 1.7 Draft. Sem criação de stories/issues ou alteração de status. | @pm |
| 2026-09-28 | 1.0.3 | @devops criou o Epic #11 e as subissues #12–#16 sequencialmente, vinculou os filhos pelo endpoint de subissues e sincronizou IDs/URLs aqui, nas stories Draft e no índice. Sem alteração do status de 1.1/1.2 ou gate da Fase 1. | @devops |
| 2026-09-28 | 1.0.2 | @sm decompôs os outcomes em cinco arquivos Draft 2.1–2.5, adicionou checklist AIOX por story, TDD Red→Green→Refactor e quality gates AIOX + GitHub Actions; caminhos também registrados no Story Index. Issues remotas ficam para @devops. Alerta sobre 1.7 preservado; sem alteração de status de 1.1/1.2 ou gate da Fase 1. | @sm |

---

**Generated by:** @pm seguindo `.aiox-core/development/tasks/brownfield-create-epic.md` e adaptando o escopo porque há múltiplas stories e mudanças coordenadas de arquitetura; `PROJECT_DIRECTION.md` e ADRs existentes permanecem as fontes, sem duplicação de PRD.
