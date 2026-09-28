# Decisão 004 — Cutover e retenção do legado SubaruShogun

**Estado:** APROVADA

**Versão:** v1.0.0

**Relacionada:** Story 0.4, ADR-002, Gap 3 da issue #9, issue #4

## O que precisa ser decidido

Quais condições autorizam o cutover da instalação SubaruShogun para o modelo multi-guild e por quanto tempo o backup/dataset legado deve ser retido após a migração?

## Recomendação

Não executar cutover até haver ensaio completo em cópia e aceite dos resultados, backup restaurável testado, inventário e reconciliação dos dados, relatório de comparação e plano de rollback. A decisão aprova o princípio e as condições de cutover; qualquer operação destrutiva requer evidências e checklist operacional.

## Alternativas

- Cutover imediato após aplicar migrations: mais rápido, mas sem evidência de restauração e reconciliação.
- Cutover somente após ensaio completo em cópia e aceite dos resultados: recomendado; reduz risco de perda e permite rollback verificável.
- Manter legado indefinidamente: facilita comparação futura, mas conserva dados pessoais e aumenta exposição.

## Alternativa B — Mais segura (aprovada)

Cutover somente após ensaio completo em cópia e aceite dos resultados: recomendado; reduz risco de perda e permite rollback verificável.

## Impacto da aprovação

Define o bloqueio de produção para Story 0.4, o runbook de cutover/rollback, a permanência temporária de `guildId = 'legacy'`, o responsável pela decisão operacional e a política de descarte do backup. Não autoriza executar migration ou deploy por si só.

## Aprovação do proprietário

**Escolha:** [X] Aprovar alternativa B Mais segura [ ] Aprovar recomendação [ ] Rejeitar [ ] Solicitar alteração

**Condições de cutover:** Reset completo do banco atual para suportar a versão multi-guild, somente após gerar e validar pacote compactado de fallback contendo cópia do banco e da API.

**Prazo de retenção do backup legado:** 7 dias.

**Responsável pelo aceite operacional:** Gustavo Mathias Rocha.

**Observações:** Alternativa B aprovada. A estratégia escolhida inclui reset completo do banco multi-guild após ensaio em cópia, mais pacote compactado de fallback da API e do banco, retido por sete dias. Gustavo Mathias Rocha é responsável pelo aceite operacional. A aprovação desta decisão não executa nem autoriza por si só reset/deploy: o ensaio, restauração, proteção do pacote e checklist de cutover ainda devem produzir evidências revisáveis antes da operação.
