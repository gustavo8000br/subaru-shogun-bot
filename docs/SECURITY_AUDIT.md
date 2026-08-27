# Auditoria de Segurança do ShogunBot

**Data:** 2026-08-27
**Escopo:** aplicação Discord, Prisma/PostgreSQL, integração Twitch, Docker e dependências.
**Método:** revisão estática do código e configuração, inspeção de arquivos versionados, `npm audit --omit=dev`, `npm run build` e `prisma validate`. Nenhum valor de `.env`, token, senha ou chave foi lido ou reproduzido.

## Resumo executivo

A aplicação não deve ser considerada pronta para um ambiente hostil sem corrigir os achados críticos e altos abaixo. O maior risco é a possibilidade de secrets entrarem na imagem Docker por causa do contexto de build. Também existe um bypass de autorização que permite a qualquer membro presente na squad acionar ações destrutivas do painel.

**Status geral:** PARTIALLY_REMEDIATED
**Prioridade imediata:** impedir vazamento de `.env`, corrigir autorização do painel, retirar credenciais Twitch do banco em claro e tornar reputação/economia idempotentes e transacionais.

## Status da remediação

| Achado | Status | Risco residual |
|---|---|---|
| SEC-001 | Corrigido no código | Imagens/cache antigos exigem limpeza e rotação operacional de credenciais. |
| SEC-002 | Corrigido | Permissões efetivas do Discord devem ser confirmadas na guild real. |
| SEC-003 | Corrigido para novos dados | O segredo continua necessário no runtime; registros antigos exigem rotação/remoção operacional. |
| SEC-004 | Corrigido | Votos legados não foram reconstruídos; elegibilidade depende da migração aplicada. |
| SEC-005 | Corrigido | Ledger não substitui reconciliação de saldos já inconsistentes. |
| SEC-006 | Corrigido | Rate limit é por processo; múltiplas réplicas exigem limitador compartilhado. |
| SEC-007 | Parcial | Compose exige credenciais externas e rede interna; `deploy.sh` faz bootstrap temporário das variáveis ausentes a partir da URL interna, sem defaults de senha. VPS, firewall, backups e permissões do host não foram auditados. |
| SEC-008 | Corrigido no Dockerfile | Filesystem somente leitura e capabilities mínimas ainda dependem da política de deploy. |
| SEC-009 | Em aberto | `npm audit --omit=dev` ainda reporta 3 high em `deepmerge-ts` transitivo do Prisma; atualização compatível precisa ser avaliada. |
| SEC-010 | Parcial | Há testes de utilitários e scripts de qualidade; testes de integração Discord/concorrência exigem harness e banco de teste. |
| SEC-011 | Parcial | Novos jogos/squads são escopados por guild; perfis e dados legados ainda usam IDs Discord globais. |
| SEC-012 | Corrigido | Requer validação em guild real para confirmar permissões de desconexão. |
| SEC-013 | Corrigido | Anúncios `@everyone` foram desativados; limites de outros fluxos externos ainda merecem teste de integração. |
| SEC-014 | Corrigido no fluxo | Migração foi adicionada, mas baseline de banco existente, backup, rollout e rollback são operações da VPS. |

## Achados

### SEC-001 - `.env` pode ser incorporado à imagem Docker

**Severidade:** Crítica
**Evidência:** [Dockerfile](../Dockerfile) executa `COPY . .` e não há `.dockerignore` excluindo `.env`. O `.gitignore` não protege o contexto enviado ao Docker.
**Impacto:** tokens Discord, credenciais Twitch e `DATABASE_URL` podem ficar em camadas da imagem, no cache de build ou em registros de container. Um usuário com acesso à imagem pode recuperar os secrets.

**Correção recomendada:** criar `.dockerignore` com `.env`, `.env.*`, `node_modules`, `dist`, `.git` e logs; usar secrets do ambiente/runtime; reconstruir e rotacionar imediatamente qualquer credencial que já tenha participado de um build.

### SEC-002 - Ações destrutivas do painel não verificam o autor

**Severidade:** Alta
**Status:** Corrigido. Cada componente agora inclui timestamp e valida proprietário/staff, membro atual e guild no momento da interação.
**Impacto:** qualquer membro que obtenha a mensagem/componente pode bloquear ou encerrar uma squad, causando perda de sessão e canais.

**Correção recomendada:** validar `interaction.user.id === squad.ownerId` ou permissão de staff em cada ação; rejeitar componentes antigos e verificar que o usuário ainda pertence à squad.

### SEC-003 - Credenciais Twitch armazenadas em texto claro

**Severidade:** Alta
**Status:** Corrigido para novos dados. `clientSecret` foi removido do modelo e da migração; o fluxo usa somente `TWITCH_CLIENT_SECRET` no runtime.
**Impacto:** acesso ao banco, dumps, backups ou logs administrativos expõe o segredo reutilizável da Twitch.

**Correção recomendada:** armazenar o segredo em um secret manager ou em variável de ambiente por guild; se persistência for indispensável, cifrar com uma chave fora do banco, aplicar rotação e mascarar valores em logs e ferramentas administrativas.

### SEC-004 - Reputação pode ser falsificada e repetida

**Severidade:** Alta
**Status:** Corrigido. Elegibilidade expirada é registrada por sessão e a unicidade impede repetição.
**Impacto:** qualquer usuário pode submeter votos repetidos para qualquer outro usuário e inflar reputação.

**Correção recomendada:** criar registro de voto com `squadId`, `voterId`, `targetId` e tipo; impor `@@unique([squadId, voterId, targetId, type])`; validar que ambos participaram da sessão encerrada e expirar o componente.

### SEC-005 - Compras vulneráveis a concorrência

**Severidade:** Alta
**Status:** Corrigido. Débito condicional e ledger por interação ocorrem na mesma transação.
**Impacto:** compras simultâneas podem passar pela mesma leitura e deixar saldo negativo, concedendo itens sem pagamento.

**Correção recomendada:** executar um `updateMany` condicional (`id` e `shogunCoins >= price`) dentro da transação, verificar `count === 1` e registrar um ledger imutável de transações.

### SEC-006 - Relay Twitch permite injeção de menções Discord

**Severidade:** Alta
**Status:** Corrigido. Relay normaliza, limita e neutraliza menções, com rate limit por guild.
**Impacto:** mensagem enviada no chat Twitch pode mencionar cargos, usuários ou `@everyone`, gerando spam e notificações abusivas.

**Correção recomendada:** desabilitar parsing de menções no relay, limitar tamanho do texto, normalizar caracteres de controle e aplicar rate limit/backpressure.

### SEC-007 - PostgreSQL usa credenciais e rede previsíveis

**Severidade:** Média/Alta
**Evidência:** [docker-compose.yml](../docker-compose.yml) exige `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`, mantém healthcheck e rede interna sem publicar porta. [deploy.sh](../deploy.sh) usa [scripts/bootstrap-compose-env.sh](../scripts/bootstrap-compose-env.sh) para derivar apenas variáveis ausentes da `DATABASE_URL`, em arquivo temporário removido ao sair; o bootstrap usa Bash e não exige Node.js no host.
**Impacto:** comprometimento de outro serviço Docker ou configuração equivocada pode facilitar acesso ao banco; a senha também é conhecida por padrão.

**Correção recomendada:** manter secrets fortes fora do repositório, rede interna dedicada sem publicação de porta, healthcheck, usuário com menor privilégio e backup cifrado. O bootstrap é compatibilidade operacional para a instalação existente, não substitui rotação da senha legada `postgres`.

### SEC-008 - Container executa como root e instala dependências de forma não reprodutível

**Severidade:** Média
**Evidência:** [Dockerfile](../Dockerfile) não define `USER` e usa `npm install --include=dev` em vez de instalação determinística de produção.
**Impacto:** uma exploração no processo do bot ganha privilégios elevados no container; builds podem variar e incluem ferramentas desnecessárias.

**Correção recomendada:** usar multi-stage build, `npm ci`, imagem final sem devDependencies, usuário não-root e filesystem somente leitura quando possível.

### SEC-009 - Dependências reportam vulnerabilidades high

**Severidade:** Média
**Evidência:** `npm audit --omit=dev` reportou 3 vulnerabilidades high em `deepmerge-ts`, transitivo de `@prisma/config`/Prisma.
**Impacto:** superfície de risco em ferramentas de build/CLI; a exploração depende do caminho de uso da dependência.

**Correção recomendada:** avaliar atualização compatível do Prisma, fixar versão corrigida, executar o audit completo em CI e documentar qualquer exceção.

### SEC-010 - Ausência de testes de segurança, rate limits e validação centralizada

**Severidade:** Média
**Evidência:** [package.json](../package.json) não possui scripts de teste, lint ou typecheck; handlers aceitam strings livres para jogo/elo/motivo e não há rate limit para denúncias, compras ou agendamentos.
**Impacto:** regressões de autorização, spam e entradas abusivas podem chegar à produção sem detecção.

**Correção recomendada:** adicionar testes de autorização e invariantes de economia/reputação, validação por schema, limites por usuário/guild, logs estruturados sem secrets e CI com `npm audit`.

### SEC-011 - Escopo de dados não é isolado por guild

**Severidade:** Média
**Evidência:** [schema.prisma](../prisma/schema.prisma) tem `Game.name` global e `UserProfile`/`Squad` não possuem `guildId`; consultas usam apenas IDs Discord ou jogo.
**Impacto:** instalações multi-guild podem compartilhar jogos, contagens e dados de usuários indevidamente.

**Correção recomendada:** adicionar `guildId` às entidades de domínio, incluir a guild nos índices únicos e filtrar toda consulta por contexto de guild.

### SEC-012 - Seleção de membro permite expulsão sem autorização

**Severidade:** Alta
**Evidência:** em [adminCommands.ts](../src/commands/adminCommands.ts#L528-L547), o handler de `squad-member-actions` desconecta e remove o alvo sem validar líder/staff, guild da interação, pertencimento atual ou expiração do componente.
**Impacto:** um membro comum que obtenha o ID do componente pode remover participantes de uma squad.
**Correção recomendada:** aplicar autorização no momento da interação, validar guild e associação do alvo, escopar/expirar o custom ID e tornar a operação idempotente.
**Validação:** testes com líder, membro comum, staff, guild diferente, alvo ausente e repetição.

### SEC-013 - Conteúdo externo permite menções e abuso de canal

**Severidade:** Alta
**Evidência:** [twitchChat.ts](../src/services/twitchChat.ts#L19-L33) envia texto Twitch sem `allowedMentions` restritivo, limite ou normalização; [bot.ts](../src/bot.ts#L104-L108) envia lembretes com menções sem `allowedMentions`; [twitchMonitor.ts](../src/services/twitchMonitor.ts#L58-L64) permite `@everyone` explicitamente. Motivos de report também são concatenados diretamente em [adminCommands.ts](../src/commands/adminCommands.ts#L208-L211).
**Impacto:** spam, ping abusivo, caracteres de controle e mensagens grandes podem atingir canais Discord.
**Correção recomendada:** usar `allowedMentions: { parse: [] }` em texto externo, limitar/normalizar conteúdo, aplicar rate limit/backpressure e definir política explícita para `@everyone`.
**Validação:** testes com menções, texto longo, controles e bursts.

### SEC-014 - Deploy usa `prisma db push` sem migração versionada

**Severidade:** Média
**Evidência:** [deploy.sh](../deploy.sh#L4-L12) executa `prisma db push` durante o deploy. Não há healthcheck, rollout ou rollback automatizado no Compose.
**Impacto:** alterações de schema podem ocorrer sem revisão/auditoria e deixar app e banco incompatíveis após falha parcial.
**Correção recomendada:** usar migrações versionadas e revisadas em produção, backup/verificação prévia, healthcheck e procedimento de rollback.

## Pontos positivos

- `.env` está ignorado pelo Git e não aparece como arquivo versionado.
- O bot usa intents relativamente restritos e respostas efêmeras em diversos comandos.
- `npm run build` passou com exit code 0.
- `prisma validate` passou; informou somente o carregamento de `.env`, sem expor valores.
- O deploy aplica o schema Prisma antes de reiniciar o app, mas usa `db push` e requer o hardening de SEC-014.
- Existe trilha inicial de auditoria para denúncias e bans, que pode ser expandida para eventos de segurança.

## Plano recomendado

1. Corrigir SEC-001 e rotacionar todos os secrets potencialmente presentes em imagens antigas.
2. Corrigir SEC-002, SEC-004 e SEC-005 com testes automatizados de autorização, idempotência e concorrência.
3. Remover secrets Twitch do banco em claro e neutralizar menções do relay.
4. Endurecer Docker/PostgreSQL e atualizar Prisma/dependências após validar compatibilidade.
5. Adicionar CI com build, testes, audit, secret scanning e revisão de permissões Discord.

## Limitações

Esta auditoria foi estática e os checks locais não destrutivos passaram. Não incluiu teste autorizado contra uma guild real, build/análise de imagem publicada (evitado porque o contexto atual pode incorporar `.env`), inspeção de backups, configuração efetiva da VPS ou rotação de credenciais. Esses itens devem ser verificados separadamente antes de declarar o ambiente seguro.
