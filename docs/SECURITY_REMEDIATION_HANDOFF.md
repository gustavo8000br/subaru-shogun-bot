# Handoff de Remediação de Segurança

**Origem:** `aiox-cyber-chief` / Cypher
**Destino:** `@dev` / implementação
**Push:** reservado a `@devops` conforme `.claude/rules/agent-authority.md`
**Status:** aguardando execução do agente responsável

## Escopo obrigatório

Remediar os achados do relatório [SECURITY_AUDIT.md](SECURITY_AUDIT.md), preservando as alterações existentes e sem ler ou expor secrets.

## Ordem de prioridade

1. **SEC-001:** criar `.dockerignore` e garantir que `.env`, `.env.*`, chaves, logs, `node_modules`, `dist` e `.git` não entrem no contexto Docker. Rotação de credenciais deve ser feita pelo operador, não pelo código.
2. **SEC-002/012:** autorizar cada ação de painel/select no momento da interação: proprietário da squad ou staff autorizada; validar guild, associação, alvo e expiração do componente.
3. **SEC-003:** remover `clientSecret` persistido em claro; migrar para secret externo/cifrado e atualizar o fluxo de configuração sem imprimir valores.
4. **SEC-004:** modelar votos com squad, votante, alvo e tipo; impedir auto-voto, voto fora da sessão e repetição.
5. **SEC-005:** tornar compra atômica com saldo condicional e registrar transação/ledger; nunca permitir saldo negativo.
6. **SEC-006/013:** usar `allowedMentions: { parse: [] }`, limites de tamanho, normalização e rate limit no relay Twitch, reportes e lembretes; revisar o `@everyone` de anúncios.
7. **SEC-007/008:** endurecer Compose/Docker sem quebrar a regra de `DATABASE_URL` interna da VPS; usar usuário não-root, `npm ci`, dependências de produção e rede interna.
8. **SEC-009/010/011/014:** resolver dependências vulneráveis compatíveis, adicionar testes e rate limits, validar entradas, isolar dados por `guildId` e trocar `db push` por migrações versionadas.

## Critérios de aceite

- `npm run build` passa.
- `npx prisma validate` passa e a migração é revisada antes de aplicar.
- Testes cobrem autorização de painel, idempotência de voto, concorrência de compra e neutralização de menções.
- Testes cobrem também remoção via select, guild incorreta, componente expirado, alvo fora da squad e repetição da operação.
- Nenhum secret aparece em código, imagem, logs, relatório ou diff.
- `npm audit` é executado e qualquer exceção fica documentada.
- O relatório é atualizado com status de cada SEC e risco residual.
- O relatório registra explicitamente limitações de VPS, registry, backups, permissões efetivas do Discord e rotação operacional.

## Encaminhamento

Após a implementação, `@qa` deve revisar os critérios e o agente `@devops` deve executar os gates de pre-push e o push. Não marcar como resolvido apenas porque o build passou.
