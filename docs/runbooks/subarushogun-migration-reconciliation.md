# Runbook draft — migração, reconciliação e cutover SubaruShogun

**Estado:** DRAFT — não aprovado para execução<br>
**Versão:** 0.1.0<br>
**Relacionado:** Story 0.4; migrations `20260903_000001`, `20260903_000001a`, `20260903_000002`, `20260903_000003`; ADR-002/004/007; Decisões Humanas 001/004/006/007/008.

> Este documento define etapas e campos de evidência, não contém comandos operacionais executáveis. Nenhum backup, restore, migration, `VALIDATE CONSTRAINT`, reconciliação ou cutover é alegado como realizado. Não iniciar operação até aprovação do runbook, stories técnicas Ready, revisão do @devops/@security e aceite operacional nominal de Gustavo Mathias Rocha.

## 1. Objetivo e fronteira

Separar (a) snapshots/linhas usados para inventário, mapping técnico, anti-joins e reconciliação de (b) dataset ativo da SubaruShogun. D004 determina que o destino multi-guild comece vazio após o reset/cutover aprovado; este runbook não autoriza importar o dataset ativo.

O mapping descrito abaixo serve somente para transformar/verificar linhas especificamente incluídas em uma migration/reconciliação autorizada. Não autoriza copiar perfis, saldos, inventário, reputação ou histórico para o dataset ativo de destino. `guildId='legacy'` só pode existir durante o processo temporário registrado; não pode permanecer no destino após cutover.

## 2. Condições bloqueantes antes de qualquer execução

- Story 0.4 passou QA e `*validate-story-draft`; stories técnicas de schema, identity mapping, reconciliação e cutover estão Ready e referenciadas.
- D004: ensaio integral em cópia, comparação/reconciliação, fallback compactado de API e banco, restore testado, proteção/acesso controlado, checklist concluído e aceite operacional registrados. Fallback tem retenção de sete dias; registrar descarte após o prazo.
- ADR-002 (máquina de estados persistida, outbox e reconciliador) está implementado e validado antes de validar FKs dependentes. Nenhuma validação ocorre contra o runtime antigo/estados intermediários.
- Backup pré-operação é restaurável e seu restore foi testado. Evidência e dono: `[preencher artefato, data, responsável, resultado e localização protegida]`.
- Janela, responsáveis, contato de parada, limite de lock, horário de baixa carga e rollback foram revisados e aprovados: `[preencher]`.
- Plano de dados define exatamente quais snapshots/linhas entram em cada consulta de validação. Dataset ativo destinado ao cutover fica excluído do import: `[preencher identificadores/escopo sem dados pessoais]`.
- Nenhum secret, conteúdo de mensagem ou dado pessoal desnecessário deve aparecer neste runbook, logs ou relatórios. Usar IDs sintéticos ou referências a artefatos protegidos.

**Se qualquer condição faltar, parar antes de alteração de dados ou estado de constraints.** Registrar motivo e owner: `[preencher]`.

## 3. Inventário de migrations e mapping de identidade

Inventariar o SQL versionado de cada migration relevante, seu checksum/versão e objetos afetados. Anexar o resultado revisado aqui ou referenciar relatório protegido: `[preencher]`. A existência dos arquivos no repositório não comprova que foram aplicados em qualquer ambiente.

Para cada coluna de identidade incluída no snapshot autorizado, registrar: tabela/coluna; semântica de origem (`Discord ID` externo ou `UserProfile.id` interno); guild de resolução; transformação proposta; origem preservada; contagem esperada/obtida; aprovador: `[preencher tabela de relatório]`.

### Caso especial: `Squad.ownerId`

A migration `20260903_000003` define transitoriamente `Squad_guildId_ownerId_fkey` para `UserProfile.discordId`. O destino de ADR-007 é `UserProfile.id` interno com FK composta `(guildId, profileId) → (UserProfile.guildId, UserProfile.id)`. Antes da validação final, a story técnica deve converter o owner Discord ID pelo `(guildId, discordId)`, trocar a referência para o ID interno e substituir a FK transitória. Nunca validar a FK transitória como se ela fosse o contrato final.

Para cada linha convertida:

- Correspondência única na mesma guild: registrar paridade e converter para profile ID interno.
- Perfil ausente, duplicado, ambíguo ou de guild divergente: interromper o lote/etapa; preservar dado-fonte; classificar e encaminhar à remediação aprovada. Não escolher primeiro resultado nem inferir por nome/valor coincidente.
- Após conversão: provar que referências cruzadas de guild falham e que a FK final composta referencia profile ID, não Discord ID.

## 4. Matriz das constraints `NOT VALID`

O inventário do SQL versionado indica 15 constraints distintas no estado final das migrations 000002/000003. A FK de `VoiceSession.guildId/squadId` é removida e recriada em 000003; conte uma única constraint final. Confirmar nomes, definição e estado em cada ambiente antes da operação. Para cada linha, preencher a consulta anti-join revisada, origem do snapshot, contagem observada e resultado esperado: `[preencher]`.

| # | Constraint final esperada | Tratamento e prova a anexar |
|---:|---|---|
| 1 | `Squad_guildId_gameId_fkey` | anti-join por `(guildId, gameId)`; `[resultado]` |
| 2 | `SquadMember_guildId_squadId_fkey` | anti-join por `(guildId, squadId)`; `[resultado]` |
| 3 | `VoiceSession_guildId_squadId_fkey` | definição recriada por 000003; verificar nullable/histórico conforme D007; `[resultado]` |
| 4 | `VoiceSession_guildId_userId_fkey` | confirmar semântica interna do `userId`; `[resultado]` |
| 5 | `UserInventory_guildId_userId_fkey` | `[resultado]` |
| 6 | `ScheduledSquad_guildId_creatorId_fkey` | `[resultado]` |
| 7 | `SquadBlacklist_guildId_squadId_fkey` | `[resultado]` |
| 8 | `SquadBlacklist_guildId_userId_fkey` | confirmar semântica externa/interna por coluna; `[resultado]` |
| 9 | `SquadBlacklist_guildId_creatorId_fkey` | `[resultado]` |
| 10 | `AuditLog_guildId_actorId_fkey` | não validar/manter como FK obrigatória; substituir por `actorRef` de ADR-007; provar sobrevivência auditável por 365 dias; `[evidência]` |
| 11 | `Squad_guildId_ownerId_fkey` | transitional: substituir Discord-ID FK por FK composta para profile ID interno antes da validação final; `[evidência]` |
| 12 | `ScheduledSquadAttendee_guildId_scheduledSquadId_fkey` | `[resultado]` |
| 13 | `ScheduledSquadAttendee_guildId_userId_fkey` | confirmar semântica interna do `userId`; `[resultado]` |
| 14 | `ReputationParticipant_guildId_squadId_fkey` | verificar que a tabela não exige FK a perfil sem decisão/story; `[resultado]` |
| 15 | `ReputationVote_guildId_squadId_fkey` | verificar que voter/target Discord IDs não são confundidos com profile IDs; `[resultado]` |

Para cada anti-join, classificar órfãos em: (a) referência legada com `guildId='legacy'`; (b) referência a entidade removida; (c) mismatch real de tenant; (d) identidade ambígua. Remediar apenas por backfill determinável, `NULL` quando schema/decisão permitem, ou arquivamento aprovado em tabela `*_orphans`; sem `DELETE` silencioso. Relatar cada contagem e preservar origem.

## 5. Ordem de execução planejada

1. Em cópia, conferir snapshot, versão de schema e integridade do backup restaurado; preencher inventário.
2. Aplicar apenas migrations versionadas revisadas pela story técnica apropriada. `prisma db push` não é caminho de produção.
3. Implementar/validar primeiro estado/outbox/reconciliador ADR-002 e resolver transições transitórias. Atualizar/validar o destino de `Squad.ownerId` e a relação de audit actor conforme ADR-007.
4. Executar anti-joins por constraint em cópia; remediar/classificar órfãos e produzir relatório. Testar a migração/reconciliação de ponta a ponta na cópia; comparar os resultados esperados.
5. Antes de cada validação futura, verificar pré-condições, backup restaurável, versão/estado exatos da constraint e relatório limpo. Aplicar uma constraint por vez, em janela aprovada e fora do pico, com `lock_timeout` definido no plano de operação.
6. Reexecutar imediatamente o anti-join relevante na mesma janela. Se houver órfão, lock timeout ou resultado divergente, parar; manter constraint não validada e não avançar às seguintes.
7. Somente depois de todos os gates D004 aprovados, executar cutover conforme checklist, com dataset ativo de destino vazio. Registrar aceite, artefatos e ponto de retorno.

**Evidência por etapa:** `[data/hora UTC]`, `[responsável]`, `[versão migration/checksum]`, `[snapshot ID protegido]`, `[consulta revisada/identificador]`, `[contagem]`, `[saída redigida]`, `[decisão continuar/parar e aprovador]`.

## 6. Reconciliação de recursos Discord

Seguir ADR-002/004 e a story técnica Ready correspondente. Nome de canal ou presença/ausência no cache não prova ownership/existência. O runbook requer `fetch` contra API Discord, duas observações consecutivas de ausência e uma janela de graça registrada segundo a referência ADR-004 — maior entre cinco minutos e um ciclo do timeout de squad vazia — antes de qualquer ação destrutiva. Canal sem ownership verificável nunca é alterado/apagado. `orphan_pending` exige diagnóstico e ação humana; retry explícito deve ser idempotente.

Preencher para ensaio: `[guild sintética]`, `[channel/resource IDs sintéticos]`, `[horários das duas observações]`, `[janela de graça aplicada]`, `[ownership verificado]`, `[resultado/retry]`. Nenhum resultado está preenchido nesta versão draft.

## 7. Privacidade e retenção

- D006: remoção/desinstalação apaga perfil/preferências; fluxo DM de saída fica em story própria.
- D001/007 e ADR-007: audit rows permanecem independentes de perfil/squad/guild até `AuditLog.createdAt + 365d`; referência de ator é `actorRef` opaco por guild, sem FK obrigatória nem Discord ID/nome em actor/target/details.
- Dados relacionados à squad cobertos por D007 seguem 90 dias de `Squad.closedAt`; isso não muda prazo do pacote de fallback D004.
- D008 `/config reset` é ação de configuração por guild, não cutover/reset do dataset D004.

Prova planejada: `[caso de remoção sintética]`, `[resultado de audit lookup após remoção]`, `[paridade guild A/B]`, `[revisores]`. Não usar dados pessoais reais no artefato.

## 8. Rollback e parada

- Falha em pré-condição: não iniciar; registrar bloqueio e owner.
- Anti-join não limpo, mapping ambíguo, mismatch, alteração inesperada, lock timeout ou validação falha: interromper a sequência; não reportar sucesso parcial nem avançar constraints.
- Rollback de uma FK validada, se aprovado para o caso: procedimento revisado/rehearsed remove a constraint validada e a recompõe como `NOT VALID`; os detalhes DDL específicos por constraint devem constar em apêndice aprovado da janela antes da execução. Nunca improvisar comando na janela.
- Rollback de migration/cutover: somente restore testado ou script reverso aprovado e ensaiado, conforme D004; parar e chamar o responsável operacional em vez de tentar correção ad hoc.
- D004 exige pacote compactado restaurável de API e banco, acesso protegido, retenção de sete dias e registro de descarte. Não confundir com retenção comunitária de 90/365 dias.

Campos de evidência/aceite: `[etapa]`, `[falha]`, `[ponto restaurado]`, `[restore testado e referência]`, `[responsável]`, `[aceite operacional]`, `[decisão de retomar/parar]`.

## 9. Checklist de evidência e aprovação

| Gate | Artefato/referência | Owner | Resultado/data | Aprovador |
|---|---|---|---|---|
| Backup/restore da cópia ensaiado | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| Inventário/anti-joins das 15 constraints | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| ADR-002 e stories técnicas implantadas/testadas | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| Mapping ownerId→profileId e FK final | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| Ensaio comparativo/cutover em cópia | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| Fallback API+DB, proteção e restore validado | `[preencher]` | `[preencher]` | `[pendente]` | `[pendente]` |
| Checklist D004 e aceite operacional | `[preencher]` | Gustavo Mathias Rocha | `[pendente]` | `[pendente]` |

**Aprovação para operação real:** `[NÃO CONCEDIDA NESTA VERSÃO]`. Registrar revisões @architect/@qa/@devops/@security e aceite proprietário em versão posterior aprovada. Até então, este documento é apenas draft e não autoriza execução.
