# Decisão 001 — Retenção, expurgo e sobrevivência da auditoria

**Estado:** APROVADA

**Versão:** v1.0.0

**Relacionada:** Story 0.1, Story 0.4, ADR-002, Gap 3 da issue #9

## O que precisa ser decidido

Por quanto tempo squads encerradas e registros de auditoria devem ser mantidos, e como atender pedidos de remoção de dados sem destruir a trilha necessária para explicar ações administrativas?

## Recomendação

Manter squads encerradas por um período definido pelo proprietário e preservar eventos de auditoria pelo período mínimo necessário à operação e investigação. No expurgo de perfil, remover dados pessoais identificáveis do perfil e preservar o evento com um identificador técnico pseudonimizado/desnormalizado, sem FK obrigatória para o perfil. Definir prazos concretos antes de aprovar esta decisão; não presumir retenção indefinida.

## Alternativas

- Expurgo físico imediato de squad e auditoria: reduz retenção, mas enfraquece diagnóstico, histórico e integridade referencial.
- Retenção indefinida: preserva histórico operacional, mas acumula dados além do necessário.
- Retenção limitada com expurgo/pseudonimização explícitos: equilibra operação e minimização; recomendada, com prazos escolhidos pelo proprietário.

## Impacto da aprovação

Define o ciclo `closed` e o expurgo em Story 0.1/0.4, resolve a política de sobrevivência de `AuditLog.actorId`, e condiciona a decisão de validar ou substituir a FK correspondente antes do cutover.

## Aprovação do proprietário

**Escolha:** [X] Aprovar recomendação [ ] Rejeitar [ ] Solicitar alteração

**Retenção de squads encerradas:** prazo mínimo necessário, a formalizar pelo PO antes de implementar expurgo automático.

**Retenção de auditoria:** limitada ao período necessário para operação e investigação; prazo concreto a formalizar antes da rotina de expurgo.

**Tratamento do identificador do ator após expurgo:** identificador técnico pseudonimizado/desnormalizado, sem FK obrigatória ao perfil.

**Observações:** A recomendação foi aprovada. Prazos numéricos de retenção ainda precisam ser definidos antes de implementar expurgo automático.
