# Decisão Humana 009: `pending_reconciliation` consome limite de squads?

**Estado:** APROVADA<br>
**Versão:** v1.0.0<br>
**Bloqueia principalmente:** aceite PO e readiness da Story 1.1<br>
**Data:** 2026-09-28

## Contexto

O ADR-001 define a contagem do limite como squads `provisioning` + `active`. O ADR-002 define `pending_reconciliation` como estado de recuperação para divergência entre PostgreSQL e Discord, mas não decide se esse estado ocupa uma vaga do limite. A Story 1.1 propõe contá-lo até a reconciliação; a constante de status e um teste de contagem estática existentes também o incluem, mas isso não constitui aprovação de produto.

Essa escolha muda disponibilidade e risco de sobrelotação. Liberar a vaga enquanto o recurso externo ainda pode existir pode permitir mais recursos do que o limite pretendido; reservar a vaga pode recusar novas squads até a reconciliação terminar.

## Pergunta ao proprietário

Enquanto uma squad estiver em `pending_reconciliation`, ela deve consumir uma vaga no limite configurado por jogo/guild?

### Opção A — Sim, reservar a vaga (recomendação)

Contar `provisioning`, `active` e `pending_reconciliation`. A vaga só é liberada quando a reconciliação mover a squad para um estado não contado. Isso estende explicitamente o texto do ADR-001 e pode reduzir temporariamente a disponibilidade enquanto há divergência.

### Opção B — Não, contar apenas `provisioning` e `active`

Excluir `pending_reconciliation` da contagem. Isso preserva literalmente o conjunto do ADR-001, mas pode permitir novas criações enquanto um efeito externo incerto ainda ocupa recursos. Architect deve definir como o invariante contra sobrelotação é preservado.

### Opção C — Outra regra

Descreva o comportamento pretendido e quando a vaga deve voltar a ficar disponível.

## Recomendação

PO recomenda a Opção A por ser conservadora diante de um efeito Discord ainda não resolvido. A recomendação não é aprovação: manter Story 1.1 em Draft e não declarar este comportamento aceite até escolha explícita do proprietário. @architect deve validar a consequência técnica da opção escolhida.

## Aprovação do proprietário

- [x] **Opção A — Sim, reservar a vaga.** `pending_reconciliation` consome capacidade até a reconciliação movê-la para estado não contado.

**Aprovação do proprietário:** Gustavo Mathias Rocha, 2026-09-28. Opção A aprovada. Esta decisão estende a lista de estados do ADR-001 para o limite de squads, incluindo `pending_reconciliation`; a vaga só é liberada após reconciliação para estado não contado. O custo aceito é reduzir temporariamente a disponibilidade durante divergências.

## Impacto da decisão

@architect deve alinhar ADR-001 e Story 1.1 com a contagem aprovada. A Story 1.2 continua responsável pela semântica e transições de reconciliação do ADR-002; esta decisão não altera ownership, não autoriza apagar recursos, nem muda a sequência T1/P2/T3. QA valida o limite sob concorrência e a liberação da vaga após reconciliação.

O status `APROVADA` fecha a decisão de produto; não aprova implementação, Ready da Story 1.1 ou os gates da Fase 1.
