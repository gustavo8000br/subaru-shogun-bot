# Arquitetura do Bot Discord Universal

**Data:** 2026-09-03
**Base:** [Direção de Produto](PROJECT_DIRECTION.md), código atual e auditoria de segurança
**Status:** proposta arquitetural para validação do PO e do usuário

## 1. Veredito

**NO-GO arquitetural para distribuição ampla neste momento.** A direção de produto é coerente e pode ser implementada sem reescrever o bot, mas há bloqueios antes de instalar em guilds de terceiros:

- o registro de slash commands e a inicialização ainda dependem de uma única `GUILD_ID`;
- `UserProfile`, saldo, inventário, sessões de voz e reputação são globais por `discordId` ou por perfil, não por guild;
- `ScheduledSquad` não possui contexto de guild;
- limites, canais, jogos implícitos e expiração são definidos por ambiente ou nomes fixos;
- criação/remoção de canais e gravação no banco não formam uma operação reconciliável;
- handlers de componentes e rotinas de eventos ainda precisam de uma fronteira central de autorização e de validação de guild;
- a auditoria de segurança ainda tem riscos residuais, incluindo dependências e ausência de testes de integração/concorrência.

**GO condicional para a arquitetura e o planejamento.** A ordem proposta abaixo é suficiente para transformar a direção validada em backlog implementável, desde que as decisões pendentes do PO/usuário sejam fechadas.

Este documento não altera código, banco, migrations ou deploy.

## 2. Estado atual e implicações

A aplicação é um processo Node.js/TypeScript com Discord.js, Prisma/PostgreSQL e serviços opcionais de Twitch e economia. `src/bot.ts` instancia todos os serviços, registra handlers e restaura squads ao iniciar. `src/squadManager.ts` cria canais Discord e registros de squad, reage a voz/mensagens e executa limpeza. `src/commands/adminCommands.ts` concentra comandos, componentes, perfis, reputação, compras, eventos e reports.

Há bons pontos de partida:

- `Game` e `Squad` já têm `guildId` e unicidade de jogo por guild;
- `TwitchConfig` já é por guild e os serviços Twitch mantêm estado por guild;
- compras usam débito condicional, transação e `PurchaseLedger` por interação;
- votos de reputação têm janela de expiração e unicidade por sessão;
- mensagens externas já usam normalização e `allowedMentions` em partes relevantes;
- migrations versionadas já substituem o baseline legado.

As limitações que controlam o desenho alvo são igualmente claras:

- constantes como limites, categoria, canal de criação e timeouts são lidas no carregamento do processo;
- o mapa de lobby para jogo e o jogo `Squad Dinâmica` são hardcoded;
- `ScheduledSquad` e seus attendees se apoiam em perfis globais;
- consultas de leaderboard e comandos de perfil não recebem `guildId` como parte do contexto;
- a restauração apaga registros quando não encontra canais, em vez de registrar e reconciliar o estado divergente;
- a criação atual pode criar canais e falhar antes de persistir a squad, deixando recursos órfãos;
- a autorização está distribuída entre handlers e usa `Administrator`/`ManageChannels` como atalhos, sem uma política por ação;
- a economia de voz recompensa sessões globais e usa configuração de processo;
- a configuração Twitch combina valores persistidos por guild com fallback global de ambiente.

## 3. Arquitetura alvo

### 3.1 Forma do sistema

O alvo continua sendo um serviço único no início, com módulos internos isolados e uma única base PostgreSQL. Não há necessidade de microserviços ou painel web para a Fase 1.

```text
Discord Gateway / Slash Commands / Components / Voice
                         |
                Interaction Context
        (guild, actor, permissions, correlationId)
                         |
       Command Router + Policy + Input Validation
                         |
       Core Application Services / Use Cases
       |          |           |          |
   Guild       Squad       Event     Member Context
   Config      Lifecycle   Scheduler  (profile/rank)
       |          |           |          |
       +----------+-----------+----------+
                         |
              Repository / Unit of Work
                         |
              PostgreSQL + Outbox/Jobs
                         |
       Discord Adapter | Twitch Adapter (optional)
```

O núcleo decide regras de negócio. Adaptadores Discord/Twitch traduzem eventos e executam efeitos externos. Nenhum módulo deve consultar `process.env` diretamente para decisões de uma guild, nem importar internals de outro módulo para contornar seus contratos.

### 3.2 Fronteiras core/módulos

**Core obrigatório:**

- contexto de guild e identidade de membro;
- configuração e onboarding;
- jogos e matchmaking;
- squad lifecycle: criar, entrar, sair, bloquear, encerrar, expirar e recuperar;
- autorização por ação;
- eventos/agendamentos básicos;
- auditoria, diagnósticos, idempotência e reconciliação;
- políticas de privacidade, retenção e mensagens seguras.

**Módulos opcionais:**

- `Reputation`: reconhecimento pós-sessão, regras e relatórios;
- `Economy`: saldo, recompensas, loja e inventário;
- `Leaderboards`: projeções/consultas derivadas, sem ser fonte de verdade;
- `Twitch`: credenciais de runtime, relay, live e recompensas;
- `DiscordProvisioning`: criação de categoria, canais, cargos e eventos;
- `Moderation`: reports, blacklist e ferramentas de staff.

Cada módulo expõe comandos/capabilities, recebe `GuildContext`, persiste somente por seus repositórios e pode ser desativado sem impedir criação, entrada e encerramento de squads. O módulo não deve registrar listeners globais que alterem outro módulo sem passar por eventos de domínio ou uma porta explícita.

## 4. Modelo de configuração por guild

A guild é o tenant e deve estar presente no contexto de toda operação de domínio. Recomenda-se uma entidade raiz `GuildInstallation`/`GuildConfig` com status (`pending`, `active`, `suspended`), versão de configuração, idioma, fuso horário, timestamps e actor da última alteração.

A configuração deve ser normalizada por área, com tabelas tipadas para dados consultados e JSON apenas para extensões estáveis. Uma mudança administrativa deve seguir:

1. validar actor, entrada, dependências e permissões Discord atuais;
2. apresentar resumo e efeitos previstos;
3. criar uma revisão/audit event em estado pendente;
4. confirmar e aplicar atomicamente a configuração persistida;
5. iniciar provisioning/reconciliação dos canais afetados;
6. informar sucesso, pendência ou falha recuperável.

Valores recomendados:

- **Squads:** jogos, canal/categoria de criação, tipo de criação, limite de membros, limite por jogo, timeouts e política de canal;
- **Matchmaking:** campos de rank aceitos, normalização, faixa e tratamento de membro sem rank;
- **Permissões:** cargos de staff e capacidades, sem guardar somente nomes de cargo;
- **Eventos:** canal padrão, timezone, antecedência e duração;
- **Reputação:** tipos, janela, elegibilidade, visibilidade e limites;
- **Economia:** habilitação, fonte de recompensa, intervalo, valores, catálogo, limites e cargos;
- **Twitch:** client ID, canal e IDs Discord da guild; secret somente no runtime/secret manager;
- **Auditoria/privacidade:** canal, retenção, acesso e remoção.

`/config status` deve mostrar estado e pendências; `/config show` deve mascarar secrets; `/config reset` deve exigir confirmação e definir uma política explícita para sessões e dados existentes. Configuração ausente usa `off` ou valores conservadores, nunca fallback silencioso para a SubaruShogun.

## 5. Decisão recomendada: perfil, economia e reputação

### 5.1 Perfil e identidade

Recomenda-se separar:

- **DiscordIdentity:** referência técnica global a `discordUserId`, sem métricas de comunidade;
- **GuildMemberProfile:** relação da identidade com uma guild, contendo preferências e estado daquela comunidade;
- **GameMemberRank:** rank por `guildId + memberProfileId + gameId`, com valor normalizado e valor exibível.

Assim, um usuário pode aparecer em várias guilds sem compartilhar elo, nome preferido, métricas ou histórico social entre elas. O leaderboard sempre consulta `guildId`. A remoção de uma guild pode apagar/anonymizar o perfil local sem apagar a identidade técnica de outras guilds.

### 5.2 Economia

A economia deve ser **por guild**. Saldo, inventário, catálogo, preços, recompensas, ledger e cargos são recursos da comunidade que os habilitou. A recomendação é um ledger imutável por `guildId + memberProfileId`, com saldo derivado ou atualizado na mesma transação, `requestId` idempotente e reason/source para cada crédito e débito.

Não se recomenda saldo global: ele permitiria que uma guild financiasse compras em outra e tornaria retenção, reset, auditoria e privacidade ambíguos. O reward de voz deve usar o `guildId` da sessão, não o primeiro perfil global encontrado.

### 5.3 Reputação

A reputação também deve ser **por guild**, baseada em participação verificável de uma sessão encerrada. Voto deve referenciar guild, sessão/squad, voter e target locais, com uma regra de elegibilidade e unicidade transacional. A pontuação é uma projeção derivada dos votos aceitos, não um contador sem origem.

A recomendação inicial é manter `GG` e `Honor` como tipos distintos, com limites configuráveis e possibilidade de expiração/retensão definida pelo PO. Não deve existir reputação global nem voto baseado apenas em IDs recebidos de componentes. A UI deve mostrar display names atuais da guild; IDs ficam apenas como valores internos.

## 6. Fluxos de onboarding

### Instalação

1. Usuário autoriza o bot com escopos e permissões mínimas documentadas.
2. Ao entrar em uma guild, o bot cria uma instalação `pending`, sem criar canais automaticamente.
3. `/setup` verifica owner/admin autorizado, permissões disponíveis e presença de configuração anterior.
4. O wizard coleta idioma/timezone, jogos, estratégia de canais, limites, expiração e módulos.
5. O bot mostra resumo, riscos e permissões que serão usadas.
6. Após confirmação, grava uma revisão ativa e executa provisioning/reconciliação.
7. `/diagnostics` apresenta pendências; `/setup resume` retoma uma etapa interrompida.

### Guild com canais existentes

O administrador seleciona canais/categoria por opções Discord. O bot valida pertencimento à guild, tipo, permissões efetivas e capacidade de criar/mover/deletar antes de ativar a configuração. IDs são persistidos; nomes são somente fallback visual, nunca identidade.

### Criação automática

O bot cria recursos com marcador de ownership em topic/name/metadata e registra cada efeito. Se uma etapa falhar, a instalação fica `pending_reconciliation`, os recursos já criados são identificáveis e o administrador recebe uma ação de retry/diagnostics. O bot não deleta canais preexistentes que não foram criados por ele.

### Reentrada e restart

Ao reiniciar, o bot carrega instalações ativas, restaura jobs por estado persistido e executa reconciliação. Não deve inferir guild por busca global de canal nem apagar registros apenas porque o cache ainda não contém um recurso.

## 7. Migração da instalação SubaruShogun

A migração deve ser incremental, reversível e executada com backup validado:

1. **Inventário:** congelar IDs da instalação legada, mapear jogos, canais, membros, squads, eventos, saldos, inventário e auditoria.
2. **Tenant:** criar a instalação para `1229598456872570900` e associar explicitamente cada `Game`, `Squad`, TwitchConfig e evento.
3. **Identidade:** criar `DiscordIdentity` e `GuildMemberProfile` a partir de `UserProfile`, preservando IDs e uma tabela de correspondência.
4. **Dados locais:** copiar ranks, saldo, métricas, inventário e reputação para o perfil da guild; não duplicar silenciosamente registros conflitantes.
5. **Sessões e eventos:** preencher o tenant de cada sessão/agendamento e validar referências órfãs antes de ativar o novo caminho.
6. **Dual-read controlado:** durante uma janela curta, comparar leituras antiga/nova e registrar divergências; não manter dual-write indefinidamente.
7. **Cutover:** ativar o runtime por instalação, executar reconciliação de canais e verificar invariantes.
8. **Retenção:** manter backup e dados legados pelo prazo aprovado; remover/anonymizar somente após aceite do PO e verificação de rollback.

O valor especial `legacy` não deve permanecer como tenant de produção após o cutover. A migration deve falhar de forma segura se houver duplicidade de nomes, referências sem guild ou saldo sem correspondência.

## 8. Concorrência, rollback e reconciliação

### Invariantes

- uma pessoa não entra duas vezes na mesma squad;
- limite de membros e limite de squads são respeitados sob concorrência;
- uma squad só pertence a uma guild e seus canais também;
- cada efeito administrativo/reward/purchase tem chave idempotente;
- uma guild nunca lê ou altera entidade de outra guild;
- canal criado pelo bot tem registro de ownership e estado;
- encerramento é idempotente e deixa sessão, reputação e auditoria em estado coerente.

### Estratégia

Usar transações PostgreSQL para invariantes de dados, constraints compostas por guild, `SELECT ... FOR UPDATE` ou advisory lock por `(guildId, gameId)` quando a contagem de limite exigir, e idempotency keys em interações/eventos. O handler Discord deve ser fino: validar contexto, chamar caso de uso e responder com o resultado.

Efeitos externos e persistência não são uma transação distribuída. Para criação/deleção de canais, usar uma operação persistida com estados como `requested`, `discord_applied`, `database_applied`, `reconciling`, `completed` e `failed`. Uma outbox/job pode repetir a etapa com backoff, sem duplicar canais ou mensagens.

### Rollback

- configuração: voltar à revisão anterior e reconciliar recursos afetados;
- criação: marcar operação falha, tentar compensar somente recursos de propriedade do bot e manter evidência se a compensação não for possível;
- encerramento: não reabrir automaticamente canal deletado; restaurar apenas estado lógico quando isso for seguro e informar o staff;
- migration: restaurar backup ou executar script reverso aprovado, nunca `db push` destrutivo em produção.

### Reconciliação

Um job periódico e `/diagnostics` devem comparar banco, cache/API Discord e configuração: canal ausente, canal sem registro, tipo/permissão divergente, squad órfã, evento inexistente e instalação sem permissões. A ação padrão é marcar divergência e reparar de forma explícita, não apagar dados automaticamente. Toda reparação gera audit event.

## 9. Permissões

A autorização deve ser centralizada em capabilities e avaliada no momento da ação:

| Ação                                     |   Dono/admin |     Staff configurado |             Líder |            Membro |
| ---------------------------------------- | -----------: | --------------------: | ----------------: | ----------------: |
| concluir/resetar setup                   |          sim | conforme configuração |               não |               não |
| alterar configuração                     |          sim |         conforme área |               não |               não |
| criar/entrar/sair de squad               |          sim |                   sim |               sim |               sim |
| bloquear/renomear/encerrar própria squad |          sim |                   sim |               sim |               não |
| expulsar/banir da própria squad          |          sim |     conforme política |               sim |               não |
| encerrar qualquer squad                  |          sim |  capacidade explícita |               não |               não |
| consultar auditoria/diagnostics          |          sim |       conforme escopo |               não |               não |
| votar reputação                          | não especial |          não especial | como participante | como participante |

A tabela é uma recomendação sujeita a decisão do PO. O bot deve validar que a interação pertence à guild, que a entidade pertence à guild, que o ator ainda é membro e que o componente não expirou. `Administrator` não deve ser o único modelo de autorização para ações de módulo; cargos configurados devem ser armazenados por ID. Permissões Discord são verificadas antes de cada efeito, pois podem mudar após o setup.

Canais temporários devem começar com `@everyone` sem acesso indevido, conceder ao bot somente o necessário e aplicar overwrite de membro/staff conforme política. Nunca usar nome de canal como autorização.

## 10. Observabilidade e operação

Toda operação deve carregar `correlationId`, `guildId`, `actorId` opcional, módulo, ação, resultado, duração e entidade técnica. Logs estruturados não podem conter tokens, secrets, conteúdo integral de reports ou dados além da retenção aprovada.

Métricas mínimas:

- guilds `pending/active/suspended`;
- setup concluído, falho e tempo até primeira squad;
- criação/entrada/encerramento e latência Discord/DB;
- conflitos de limite, retries, órfãos e reconciliações;
- erros de permissão por ação/canal;
- jobs atrasados e falhas de restore;
- compras rejeitadas/duplicadas e divergências de ledger;
- votos inválidos/duplicados;
- saúde e erros por guild de Twitch, sem expor credenciais.

`/diagnostics` deve ser acionável pelo staff, com checks de banco, permissões, canais, configuração, jobs e módulos. Alertas operacionais devem agrupar por guild e não mencionar usuários automaticamente. Healthcheck de processo não substitui readiness de banco nem o estado de reconciliação.

## 11. Compatibilidade com funcionalidades atuais

| Capacidade atual            | Destino universal                          | Compatibilidade                                          |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| squads manuais e por voz    | Core Squad/Provisioning, regras por guild  | preservada; mapa de lobby vira configuração              |
| limites de membros/squads   | GuildConfig + constraints/transações       | preservada; deixa de usar env em runtime                 |
| canais temporários          | Provisioning idempotente                   | preservada; ownership e recuperação adicionados          |
| painel de squad             | Command/Component adapter + policy central | preservado; labels usam display names                    |
| expiração e restart         | Lifecycle + reconciliation job             | preservados com estados explícitos                       |
| eventos agendados           | Event module com `guildId`                 | preservados; lembretes escopados                         |
| rank e filtros              | GuildMemberProfile/GameMemberRank          | preservados sem compartilhamento entre guilds            |
| reputação GG/Honor          | Reputation module por sessão e guild       | preservada, com decisão de retenção/visibilidade         |
| coins, loja e inventário    | Economy module por guild                   | preservados quando ativados; ledger vira fonte auditável |
| Twitch                      | módulo opcional por guild                  | preservado; sem secret no banco e sem requisito do core  |
| reports/blacklist/auditoria | Moderation/Audit                           | preservados e ampliados por policy/retention             |
| `/versao`                   | Core diagnostics                           | preservado; escopo de consulta deve ser decidido         |

## 12. Ordem recomendada das issues #1-#8

A ordem abaixo respeita as prioridades da direção e dependências técnicas:

1. **#8 - escopo universal/multi-guild:** fechar tenant, perfil, rank, economia, reputação, auditoria, scheduled squads e matriz de dados. É o contrato que evita migrações repetidas.
2. **#3 - limites sob concorrência:** implementar invariantes e testes transacionais por guild/jogo antes de aumentar instalação.
3. **#4 - convergência Discord/DB:** introduzir operação persistida, idempotência, compensação e reconciliação para canais e eventos.
4. **#5 - lifecycle e recuperação:** formalizar estados, atividade, expiração, restart, canal apagado e jobs recuperáveis.
5. **#6 - permissões de squads:** centralizar capabilities, validar actor/guild/entidade no momento da interação e testar cada ação.
6. **#1 - UX de reputação:** nomes amigáveis, elegibilidade local, janela, duplicidade e mensagens sem IDs.
7. **#7 - expiração configurável:** mover timeouts e política de atividade para configuração por guild depois que o lifecycle base for confiável.
8. **#2 - recompensas Twitch:** entregar por último como módulo opcional, com rate limit, secrets de runtime, isolamento por guild e desligamento independente.

A auditoria de segurança não é uma issue posterior: seus achados críticos/altos e especialmente isolamento multi-guild, dependências, testes de integração e deploy versionado são gates transversais antes da distribuição ampla.

## 13. Decisões pendentes do PO/usuário

1. **Escopo do perfil:** confirmar que elo, saldo, inventário, reputação, voice minutes e leaderboards são por guild, sem exceção.
2. **Reputação:** definir se GG/Honor expiram, se staff pode moderar/reverter e qual retenção/visibilidade é aceitável.
3. **Economia:** confirmar que moedas não atravessam guilds, fontes de recompensa, reset inicial e política para saldos legados.
4. **Administração:** escolher se staff é definido por cargos configuráveis, permissões Discord, ou ambos, e quais ações cada capability cobre.
5. **Provisioning:** escolher entre somente canais existentes, criação automática opt-in ou ambos; definir o que o bot pode apagar.
6. **Migração:** aprovar tratamento dos dados SubaruShogun, janela dual-read, retenção de backup e critério de cutover.
7. **Privacidade:** definir retenção, exportação, anonimização e remoção de perfis por guild.
8. **Operação:** confirmar banco compartilhado com isolamento lógico para a primeira escala, limites de guilds/replicas e destino dos logs/métricas.
9. **Distribuição Discord:** aprovar registro global de comandos para instalação universal e estratégia para atualização/propagação.
10. **Auditoria:** aceitar ou bloquear distribuição até resolver SEC-009, SEC-010 e os riscos operacionais residuais descritos em [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## 14. Próximo gate arquitetural

Depois das decisões acima, o Architect deve produzir o modelo de dados/migration plan, contratos de módulos, matriz final de permissões e plano de testes de isolamento/concorrência. O PO valida escopo e trade-offs; o usuário aprova a migração e as políticas de dados. Só então o Dev deve implementar a Fase 1.
