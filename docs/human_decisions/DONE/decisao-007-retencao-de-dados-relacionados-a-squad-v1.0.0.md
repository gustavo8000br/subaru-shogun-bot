# Decisão 007 — Retenção de dados relacionados a squads

**Estado:** APROVADA<br>
**Versão:** v1.0.0<br>
**Relacionada:** Story 0.1, Story 0.4, Story 1.3, Decisão 001 v1.1.0, ADR-007

## O que precisa ser decidido

Quais entidades são consideradas diretamente dependentes de uma squad encerrada e podem ser expurgadas junto com ela após 90 dias, e como tratar `VoiceSession` histórica, `ScheduledSquad` e participantes/attendees.

## Recomendação

Aplicar os 90 dias aprovados à row da squad e a relações estritamente dependentes que não tenham valor histórico independente. Destacar e preservar `VoiceSession` histórica com `guildId` e vínculo histórico necessário; definir retenção própria para `ScheduledSquad` e attendees antes de automatizar qualquer expurgo. Não inferir que essas entidades herdam 90 dias.

## Alternativas

- **Escopo estrito recomendado:** squad e filhos sem valor independente expiram em 90 dias; `VoiceSession` histórica é preservada/destacada; `ScheduledSquad` e attendees recebem política própria.
- **Prazo uniforme de 90 dias:** também expurgar `VoiceSession` e `ScheduledSquad`/attendees após 90 dias; simplifica jobs, mas reduz histórico e amplia o alcance da decisão original.
- **Política individual por entidade:** definir prazo e condição de expurgo para cada classe relacionada; mais preciso, porém requer decisões e critérios adicionais.

## Impacto da aprovação

Determina FKs/cascades e a decomposição das futuras stories de schema e expurgo (Stories 0.4 e 1.3). Expurgo automático permanece fora do escopo até a política estar aprovada, implementada em story Ready própria e coberta por testes TDD. Auditoria continua sob os 365 dias da Decisão 001.

## Aprovação do proprietário

**Retenção da Squad encerrada:** já aprovada em 90 dias pela Decisão 001 v1.1.0; não reabrir.

**Dados estritamente dependentes da Squad:** [X] Expurgar junto após 90 dias [ ] Definir por entidade [ ] Outra regra: **\_\_**

**`VoiceSession` histórica:** [ ] Preservar/desvincular da Squad [X] Expurgar em 90 dias [ ] Outra regra: **\_\_**

**`ScheduledSquad`/attendees:** [ ] Política própria, a definir antes do job [X] Expurgar em 90 dias [ ] Outra regra: **\_\_**

**Observações/limites:** **\_\_**

**Aprovação do proprietário:** Gustavo Mathias Rocha, 2026-09-28. As opções marcadas acima foram salvas pelo proprietário: dados estritamente dependentes, `VoiceSession` histórica e `ScheduledSquad`/attendees são expurgados junto após 90 dias do encerramento da squad. A implementação deve respeitar o timestamp definido no ADR-007, preservar audit independente por 365 dias e não introduzir cascade antes de stories e testes próprios.
