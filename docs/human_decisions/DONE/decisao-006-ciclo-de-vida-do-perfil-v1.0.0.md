# Decisão 006 — Ciclo de vida do perfil e preferências

**Estado:** APROVADA<br>
**Versão:** v1.0.0<br>
**Relacionada:** Story 0.1, Story 0.4, Story 1.4, Decisão 001 v1.1.0, ADR-007

## O que precisa ser decidido

O que fazer com `UserProfile`, identificador Discord e preferências locais quando um membro sai de uma guild, solicita apagamento de dados, ou o bot é removido/desinstalado da guild.

## Recomendação

Definir explicitamente, por evento, se o perfil e as preferências são apagados ou desvinculados. A regra deve minimizar dados pessoais, manter dados comunitários isolados por guild e preservar `AuditLog` conforme a Decisão 001: até 365 dias, com `actorRef` pseudonimizado e sem FK obrigatória ao perfil. Esta recomendação não presume que saída da guild equivale a pedido de apagamento.

## Alternativas

- **Apagar perfil e preferências ao sair:** reduz dados retidos, mas pode remover dados necessários a históricos e exige regras de destacamento/retenção de relações.
- **Desvincular a identidade Discord e preservar preferências/dados comunitários:** mantém continuidade local, mas requer definir prazo e tratamento dos dados que ainda podem identificar a pessoa.
- **Regras diferentes por evento:** saída, pedido de apagamento e remoção do bot têm tratamentos separados; maior precisão, com maior custo de implementação e operação.

## Impacto da aprovação

Define o comportamento de saída/remoção e pedidos de apagamento, além de restrições para perfil, preferências e relações em Stories 0.4 e 1.4. Não altera os prazos aprovados para squad (90 dias) e auditoria (365 dias), nem autoriza expurgo ou cutover.

## Aprovação do proprietário

**Saída de membro da guild:** [ ] Apagar perfil e preferências [ ] Desvincular Discord ID e preservar dados permitidos [X] Outra regra: enviar DM amigável perguntando o que o membro deseja fazer, com campo de seleção.

**Pedido de apagamento:** [X] Apagar perfil e preferências [ ] Desvincular/minimizar conforme regra: **\_\_** [ ] Outra regra: **\_\_**

**Remoção/desinstalação do bot na guild:** [X] Apagar dados de perfil/preferências [ ] Preservar dados para reinstalação por prazo: **\_\_** [ ] Outra regra: **\_\_**

**Observações/limites:** **\_\_**

**Aprovação do proprietário:** Gustavo Mathias Rocha, 2026-09-28. As opções marcadas acima foram salvas pelo proprietário; a preferência na saída da guild é coletada por DM amigável com campo de seleção. O pedido de apagamento e a remoção/desinstalação do bot apagam perfil e preferências. A interação de DM ainda requer definição de UX/timeout e tratamento de ausência de resposta em story própria antes da implementação.

## Follow-up obrigatório antes da implementação

A story que especificar o fluxo de saída deve definir, sem presumir resposta do membro: opções e confirmação exibidas na DM; validade/timeout da interação; tratamento de DM indisponível, expirada ou sem resposta; e como o membro pode retomar ou solicitar apagamento depois. @po registra o contrato em story própria, @architect valida a compatibilidade com o lifecycle de dados, e @qa transforma os resultados e fronteiras de tempo em casos verificáveis. Nenhum comportamento de timeout, ausência de resposta ou fallback é aprovado por esta decisão. Este follow-up não reabre a política já aprovada nem bloqueia a classificação de dados da Story 0.1; bloqueia a implementação do fluxo de saída até que a story própria esteja aprovada.
