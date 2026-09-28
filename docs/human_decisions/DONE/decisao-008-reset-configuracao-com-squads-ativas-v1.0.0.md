# Decisão 008 — Efeito de reset de configuração com squads ativas

**Estado:** APROVADA<br>
**Versão:** v1.0.0<br>
**Relacionada:** Story 0.2, ADR-002/004, Stories 1.2/1.3<br>
**Bloqueia:** aceite do contrato `/config reset` na Story 0.2 e implementação desse fluxo

## O que precisa ser decidido

Quando um administrador executa `/config reset` enquanto há squads ativas ou recursos Discord provisionados, qual deve ser o efeito sobre essas squads, seus canais e a configuração da guild?

Decisão Humana 004 aprova reset do dataset ativo no cutover operacional após ensaio; ela não define o comando de reset de configuração em uma guild já ativa. ADR-002 exige recuperação explícita, ownership verificável e proíbe apagar recursos desconhecidos por inferência. Não há regra aprovada para essa interação administrativa.

## Recomendação

**Opção A — recusar reset enquanto houver squads ativas ou reconciliação pendente.** Explicar o bloqueio e exigir encerramento/reconciliação pelas ações normais antes de repetir. Quando seguro, restaurar apenas os valores de configuração definidos como defaults, mostrar o resumo e exigir confirmação. Nunca apagar canais ou registros de domínio como efeito implícito de reset de configuração.

Essa opção preserva dados e evita divergência Discord/PostgreSQL. A mecânica de detectar/validar o bloqueio e aplicar a configuração continua sujeita ao @architect; não altera a máquina de estados do ADR-002.

## Alternativas

- **Opção A — bloquear com atividade/reconciliação pendente (recomendada):** mantém estado ativo intacto; exige ação explícita de encerrar/reconciliar antes do reset.
- **Opção B — aplicar defaults preservando squads/canais ativos:** mantém os registros, mas o proprietário aceita que novos defaults possam divergir das condições sob as quais as squads existentes foram criadas; exige definir quais campos passam a valer imediatamente ou somente em novas squads.
- **Opção C — reset destrutivo de squads e recursos controlados:** encerra/apaga dados e remove canais comprovadamente pertencentes ao bot. Tem maior risco de perda e efeitos externos; exige definir retenção, auditoria, elegibilidade de ownership e confirmação reforçada, e não está autorizado por este arquivo.

## Aprovação do proprietário

Escolha uma opção:

- [X] **Aprovar Opção A** — bloquear reset enquanto houver squads ativas ou reconciliação pendente; reset seguro altera somente configuração após normalização.
- [ ] **Aprovar Opção B** — permitir reset com squads ativas, preservando dados; indique se defaults afetam squads atuais ou somente novas: **________**
- [ ] **Aprovar Opção C** — reset destrutivo; especifique o tratamento de squads/canais/auditoria e confirmação: **________**
- [ ] **Solicitar outra regra:** **________**

**Observações/limites:** **________**

**Aprovação do proprietário:** Gustavo Mathias Rocha, 2026-09-28. Opção A aprovada: `/config reset` é recusado enquanto houver squad ativa ou reconciliação pendente. Depois da normalização, reset confirmado altera apenas a configuração para os defaults suportados; não encerra/apaga squads nem remove canais como efeito implícito.

## Impacto da decisão

Após resposta, atualizar o AC de reset e cenários TDD da Story 0.2. @architect confirma coerência de estados, transação/reconciliação e ownership; @qa verifica que o comportamento pode ser testado. Este registro não autoriza implementação nem exclusão de dados/canais.
