# Decisão 005 — Tratamento de risco SEC-009 (`deepmerge-ts` / Prisma)

**Estado:** APROVADA — ACEITE TEMPORÁRIO

**Versão:** v1.0.0

**Relacionada:** SEC-009 em `docs/SECURITY_AUDIT.md`, Story 0.5, gate QA `docs/qa/gates/0.5-baseline-de-testes-universais.yml`

## O que precisa ser decidido

Como tratar os três findings HIGH do advisory GHSA-ggr8-5vv4-36mx para `deepmerge-ts` <8.0.0, transitivo de Prisma 6.19.3 via `@prisma/config` 6.19.3?

## Evidência técnica registrada

- `npm audit` e `npm audit --omit=dev` retornam findings HIGH e exit code 1.
- A árvore instalada é `prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5`; a versão corrigida consultada é 8.0.2.
- A triagem @devops não encontrou release oficial compatível dentro da linha Prisma 6 que remova a dependência vulnerável. Override da transitiva não tem compatibilidade garantida pelo pacote pai; `npm audit fix` pode implicar upgrade major.
- Nenhuma atualização automática foi aplicada. O finding permanece aberto e bloqueia o gate QA até correção compatível ou aceite formal.
- `npm audit --omit=dev` também retorna o finding. A árvore constatada passa por Prisma tooling; exposição em runtime não foi confirmada. Este registro não afirma que a dependência vulnerável está ativa no runtime da aplicação.

## Opções

1. **Aceitar temporariamente o risco documentado:** registrar justificativa, escopo confirmado, mitigação operacional, responsável e data-limite de reavaliação. A decisão não elimina o advisory nem autoriza descrevê-lo como corrigido.
2. **Autorizar uma story de migração de Prisma major:** manter SEC-009 como bloqueador até a migração, revisão de breaking changes e gates completos.
3. **Solicitar alternativa técnica:** registrar proposta de override ou outra mitigação para avaliação de @architect/@devops antes de alterar dependências.

## Impacto da decisão

O proprietário aprovou tratamento temporário até 2026-10-27, com a mitigação operacional futura registrada acima. SEC-009 permanece HIGH e aberto, sem correção de dependência. O gate QA e o status da Story 0.5 são mantidos conforme a decisão desta fase; eventuais mudanças de gate cabem ao @qa na etapa seguinte. Uma migração major deve ser executada em story própria e validada pela pipeline.

## Aprovação do proprietário

**Escolha:** Opção 1 — aceitar temporariamente o risco documentado.

**Data da aprovação:** 2026-09-27

**Escopo/runtime afetado confirmado:** `npm audit --omit=dev` também retorna o finding; a árvore instalada constatada passa por Prisma tooling. Exposição runtime não confirmada.

**Mitigação operacional / justificativa:** até a reavaliação, restringir a execução de Prisma CLI/configuração a entradas confiáveis. Reavaliar assim que surgir release oficialmente suportada que remova a dependência afetada e, em qualquer caso, antes do prazo. Essa mitigação é controle operacional futuro; sua implantação ainda não foi verificada. O aceite não corrige nem elimina o finding.

**Responsável:** Proprietário do projeto (usuário solicitante).

**Data-limite de reavaliação:** 2026-10-27 (30 dias após aprovação).

**Observações:** SEC-009 permanece aberto e classificado HIGH. A decisão autoriza somente o tratamento temporário do risco descrito; não confirma exposição em runtime nem declara o advisory corrigido.
