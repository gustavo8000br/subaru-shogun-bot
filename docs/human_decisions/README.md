# Decisões Humanas

Esta pasta registra decisões que dependem de aprovação explícita do proprietário do ShogunBot.

Os arquivos são organizados por estado: `PENDING/`, `REVIEW/`, `AWAITING/` e `DONE/`.
Ao mudar o estado de uma decisão, mova o arquivo para a pasta correspondente e atualize
este índice e as referências relativas.

## Regra para agentes

Antes de planejar ou implementar trabalho relacionado a uma decisão listada aqui, o agente deve:

1. Ler este índice e a decisão relacionada.
2. Não assumir respostas em `PENDING/`, `REVIEW/` ou `AWAITING/`.
3. Registrar dúvidas e impactos no arquivo da decisão correspondente.
4. Tratar uma decisão como aprovada somente quando o proprietário a marcar como `APROVADA` em `DONE/`.
5. Preservar decisões históricas; uma decisão aprovada posteriormente alterada deve ser supersedida por novo registro.

## Formato

`decisao-NNN-nome-vMAJOR.MINOR.PATCH.md`

A versão identifica a revisão do documento, não a versão do produto.

Fluxo: `PENDENTE → APROVADA | REJEITADA | SUBSTITUÍDA`.
Decisões rejeitadas ou substituídas permanecem registradas para auditoria.

## PENDING — Pendentes

| Decisão | Tema | Bloqueia principalmente | Estado |
| --- | --- | --- | --- |
| Nenhuma | — | — | — |

## REVIEW — Em revisão

| Decisão | Tema | Bloqueia principalmente | Estado |
| --- | --- | --- | --- |
| Nenhuma | — | — | — |

## AWAITING — Aguardando

| Decisão | Tema | Bloqueia principalmente | Estado |
| --- | --- | --- | --- |
| Nenhuma | — | — | — |

## DONE — Aprovadas

| Decisão | Tema | Bloqueia principalmente | Estado |
| --- | --- | --- | --- |
| [001](./DONE/decisao-001-retencao-expurgo-e-auditoria-v1.0.0.md) | Retenção e sobrevivência da auditoria | Stories 0.1 e 0.4; validação das FKs | APROVADA* |
| [002](./DONE/decisao-002-acesso-da-staff-a-canais-de-squad-v1.0.0.md) | Acesso opt-in da staff a texto/voz na própria guild | Story 1.4 | APROVADA |
| [003](./DONE/decisao-003-capabilities-da-staff-v1.0.0.md) | Capabilities nomeadas por cargo e guild | Stories 0.3 e 1.4 | APROVADA |
| [004](./DONE/decisao-004-cutover-e-retencao-do-legado-v1.0.0.md) | Cutover após ensaio em cópia; reset total e fallback compactado por sete dias | Story 0.4; operação de cutover | APROVADA* |
| [005](./DONE/decisao-005-aceite-de-risco-sec-009-prisma-deepmerge-ts-v1.0.0.md) | Aceite temporário do risco HIGH SEC-009 até reavaliação em 2026-10-27 | Tratamento operacional e reavaliação SEC-009 | APROVADA — temporária |

* A recomendação da Decisão 001 foi aprovada, mas os prazos numéricos de retenção permanecem pendentes e bloqueiam a implementação de expurgo automático.

* A Decisão 004 aprova a estratégia e as condições; reset/deploy continuam condicionados a ensaio, restauração e checklist operacional com evidências revisáveis.

Decisões arquiteturais aprovadas pelo Architect permanecem em `docs/ARCHITECTURE_DECISIONS.md`; elas não são aprovação humana do proprietário.
