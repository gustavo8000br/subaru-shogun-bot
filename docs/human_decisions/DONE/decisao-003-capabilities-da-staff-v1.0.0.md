# Decisão 003 — Capabilities administrativas da staff

**Estado:** APROVADA

**Versão:** v1.0.0

**Relacionada:** Story 0.3, Story 1.4, ADR-003, issues #6 e #9

## O que precisa ser decidido

Quais ações a staff configurada por cargo pode executar em uma guild, além do acesso aos canais tratado na Decisão 002?

## Recomendação

Adotar capabilities nomeadas, atribuídas explicitamente aos cargos de staff por guild, começando pelo menor conjunto necessário. O ADR-003 sugere nomes como `manage_setup`, `manage_any_squad` e `view_audit`; o proprietário deve aprovar a lista e o escopo de cada uma antes da Story 1.4. Ações de consulta e mutação devem ser separadas.

## Alternativas

- Staff recebe todas as ações de moderação: simples, mas amplia poder além da necessidade.
- Cada ação é liberada por permissões Discord nativas: familiar, mas mistura permissões amplas da guild com capacidades específicas do bot.
- Lista explícita de capabilities por cargo e ação: recomendada; é auditável e permite menor privilégio.

## Impacto da aprovação

Fecha a matriz de autorização de setup, squads, expulsão/bloqueio, auditoria e configuração. Nenhuma capability pode conceder `Administrator` ou permissões Discord equivalentes.

## Aprovação do proprietário

**Escolha:** [X] Aprovar recomendação [ ] Rejeitar [ ] Solicitar alteração

**Capabilities aprovadas e ações incluídas:**

| Capability         | Ações permitidas | Cargos autorizados |
| ------------------ | ---------------- | ------------------ |
| `manage_setup`     | Administrar setup e configuração da guild | Cargos explicitamente autorizados pelo administrador da guild |
| `manage_any_squad` | Moderar squads da guild conforme ADR-003 | Cargos explicitamente autorizados pelo administrador da guild |
| `view_audit`       | Consultar auditoria da guild | Cargos explicitamente autorizados pelo administrador da guild |

**Observações:** Aprovado o modelo de capabilities nomeadas por cargo e guild, com concessão explícita e menor privilégio. O conjunto inicial é o da tabela; ampliações requerem nova decisão. Nenhuma capability concede permissões administrativas Discord.
