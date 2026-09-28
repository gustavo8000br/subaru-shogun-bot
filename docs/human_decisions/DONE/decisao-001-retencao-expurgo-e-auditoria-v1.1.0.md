# Decisão 001 — Retenção, expurgo e sobrevivência da auditoria

**Estado:** APROVADA<br>
**Versão:** v1.1.0<br>
**Aditamento:** 2026-09-27<br>
**Supersede:** os campos de prazo numérico ainda pendentes na v1.0.0; o restante da decisão permanece válido.<br>
**Relacionada:** Story 0.1, Story 0.4, ADR-002, Gap 3 da issue #9

## Decisão do proprietário

- **Squads encerradas:** reter por 90 dias.
- **Eventos de auditoria:** reter por 365 dias.
- **Tratamento do identificador do ator após expurgo:** identificador técnico pseudonimizado/desnormalizado, sem FK obrigatória ao perfil.

**Aprovação do proprietário:** Gustavo Mathias Rocha aprovou os prazos acima em 2026-09-27, respondendo à solicitação explícita sobre a Decisão Humana 001.

## Limites para implementação

- Os prazos substituem a pendência numérica registrada na v1.0.0 e autorizam o planejamento das regras correspondentes em Story 0.1/0.4.
- @architect deve definir e aprovar a mecânica técnica de cálculo, incluindo o timestamp de referência por entidade; o schema atual de `Squad` não possui `closedAt`.
- Expurgo automático só pode ser implementado após a regra técnica estar registrada e aprovada, com testes e evidência de preservação/pseudonimização da trilha de auditoria.
- Este aditamento não autoriza executar expurgo, migração, reset, deploy ou cutover em dados reais.

## Registro histórico

A v1.0.0 preservada neste diretório registrou a aprovação da recomendação e deixou os prazos numéricos pendentes. Este aditamento resolve somente esses prazos; não altera o princípio de minimização, a sobrevivência da auditoria nem as condições operacionais da Decisão 004.
