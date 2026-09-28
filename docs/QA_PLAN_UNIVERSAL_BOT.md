# Plano de QA do Bot Discord Universal

**Snapshot histórico:** 2026-09-03 (estado da revisão original; itens de CI/clock não representam o estado atual).
**Escopo:** validação dos documentos de direção, arquitetura, auditoria de segurança, handoff de remediação e testes atuais.  
**Modo:** somente leitura para a revisão; este documento não autoriza alteração de código, schema, deploy ou commit.

## Lei do projeto: TDD Red → Green → Refactor

Toda nova implementação ou correção de produção deve obedecer, em cada incremento pequeno, à sequência abaixo:

1. **Red:** criar e executar primeiro o teste do comportamento ausente/incorreto; confirmar falha funcional esperada e descartar falha de setup/harness.
2. **Green:** implementar o mínimo necessário e executar o teste direcionado para confirmar aprovação.
3. **Refactor:** melhorar a estrutura mantendo comportamento e executar novamente os testes relevantes.

É proibido alterar produção antes de um Red válido. Se ambiente ou dependência impedir uma fase, registrar evidência e bloqueio na story e não declarar implementação pronta. O histórico do projeto começou sem TDD; testes e entregas anteriores permanecem históricos e não devem receber classificação TDD retroativa. Esta regra vale para todas as stories de implementação futuras, inclusive quando seus planos TDD originais tenham sido escritos antes desta regra.

## 1. Veredito

**NO-GO para iniciar stories de implementação da Fase 1.** O plano de produto e a arquitetura são suficientemente claros para quebrar o trabalho em stories de decisões, contratos, instrumentação e ambiente de teste, mas ainda não há evidência executável para afirmar que o núcleo universal é implementável com segurança.

**GO condicionado para criar stories da Fase 0**, desde que sejam stories de decisão e preparação de QA. Antes das stories que alteram schema ou runtime, PO e Architect precisam fechar os bloqueios de escopo, migração, permissões, lifecycle, reconciliação e segurança.

O `clientSecret` Twitch é uma credencial de configuração específica da guild e permanece cifrado no PostgreSQL conforme ADR-006; `SECRETS_MASTER_KEY`, token do bot e credenciais operacionais compartilhadas são runtime-only.

O principal motivo do NO-GO continua sendo testabilidade incompleta. Existe harness PostgreSQL efêmero (`npm run test:integration`) para integridade multi-guild. O baseline CI GitHub Actions da Story 0.6 está configurado e teve run hospedado verde; isso valida apenas os steps definidos no workflow, não lifecycle de domínio, clock controlado, concorrência da aplicação, adapter Discord fake/falhas injetáveis, deploy ou secret scanning. O clock controlado e adapter fake seguem como infraestrutura/cobertura pendente. Os cenários TDD abaixo são planejamento histórico, não resultados executados.

## 2. Cobertura das issues #1-#8

| Issue | Cobertura prevista                                                                  | Evidência mínima para aceite                                                                                                                 | Estado QA                              |
| ----- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| #1    | Reputação mostra display names atuais, com escopo e elegibilidade da guild/sessão   | Teste de componente com nomes amigáveis; nenhum ID exposto; usuário fora da sessão e voto expirado rejeitados                                | Coberta no plano, não testada hoje     |
| #2    | Recompensas Twitch são módulo opt-in e não bloqueiam squads                         | Guild A ativa Twitch e Guild B desativa; falha/pausa do Twitch não impede criar, entrar ou encerrar squad                                    | Coberta no plano, sem integração hoje  |
| #3    | Limite de squads e membros por guild/jogo sob concorrência                          | N requisições simultâneas resultam em no máximo o limite; sem duplicata e sem canal/registro órfão não reconciliado                          | Bloqueador de implementação            |
| #4    | Discord e banco convergem por operação idempotente, retry e reconciliação           | Falhas injetadas em cada etapa deixam estado diagnosticável; retry não duplica canais, mensagens ou registros                                | Bloqueador de implementação            |
| #5    | Lifecycle explícito para criação, entrada, saída, encerramento, expiração e restart | Matriz de estados executada com relógio controlado; restart e canal apagado produzem recuperação ou pendência auditável                      | Bloqueador de implementação            |
| #6    | Capabilities por ação, guild, squad e ator atual                                    | Matriz negativa e positiva para owner, staff, líder, membro, não membro e outra guild; componente expirado rejeitado                         | Risco alto, cobertura inexistente hoje |
| #7    | Expiração configurável por guild, com atividade relevante definida                  | Guilds com timeouts diferentes expiram no instante esperado; voz passiva não renova; motivo fica auditado                                    | Depende de #5                          |
| #8    | Tenant explícito em todas as entidades e consultas                                  | Teste de duas guilds com jogos, perfis, saldo, reputação, sessões, eventos, permissões e auditoria distintos, sem leitura ou mutação cruzada | Bloqueador absoluto                    |

## 3. Matriz de riscos

Escala: probabilidade e impacto de 1 a 5; exposição = produto. Riscos com exposição 15 ou com impacto 5 bloqueiam a distribuição ampla.

| Risco                                                 | Fonte              |   P |   I | Exposição | Controle verificável                                                                        | Gate                                              |
| ----------------------------------------------------- | ------------------ | --: | --: | --------: | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Vazamento de secrets no contexto/imagem Docker        | SEC-001            |   3 |   5 |        15 | `.dockerignore`, inspeção do contexto/imagem e rotação operacional documentada              | Bloqueia release                                  |
| Bypass de autorização em painel/select                | SEC-002/012        |   3 |   5 |        15 | autorização no momento da interação, guild/ator/alvo/expiração e testes negativos           | Bloqueia Fase 1                                   |
| Credencial Twitch persistida ou exposta               | SEC-003            |   2 |   5 |        10 | busca estrutural, migração, mascaramento, logs e rotação sem segredo reproduzido            | Bloqueia Twitch; release se houver legado exposto |
| Voto ou reputação repetível/fraudável                 | SEC-004            |   3 |   4 |        12 | elegibilidade da sessão, auto-voto, unicidade e idempotência transacional                   | Bloqueia Fase 2                                   |
| Compra/recompensa com saldo negativo ou duplicada     | SEC-005            |   3 |   5 |        15 | transação concorrente, ledger único, request idempotente e reconciliação                    | Bloqueia Economia                                 |
| Menção/spam por conteúdo externo                      | SEC-006/013        |   3 |   4 |        12 | `allowedMentions.parse=[]`, normalização, limite, rate limit e burst test                   | Bloqueia módulo externo                           |
| Banco/deploy com credenciais ou privilégio inadequado | SEC-007/008        |   3 |   5 |        15 | secrets externos, usuário não-root, filesystem/rede conforme política e teste de compose    | Bloqueia release                                  |
| Dependência high sem decisão de exceção               | SEC-009            |   3 |   4 |        12 | `npm audit --omit=dev` e audit completo reproduzíveis, correção ou aceite formal            | Bloqueia release                                  |
| Ausência de integração e concorrência                 | SEC-010            |   5 |   5 |        25 | harness Discord, PostgreSQL de teste, falhas injetáveis e CI                                | Bloqueia stories de implementação                 |
| Dados globais compartilhados entre guilds             | SEC-011            |   4 |   5 |        20 | matriz de escopo, constraints compostas, consultas com `guildId` e teste de duas guilds     | Bloqueia Fase 1                                   |
| Schema/app incompatíveis ou rollback não executável   | SEC-014            |   3 |   5 |        15 | `prisma migrate deploy`, backup restaurável, health/readiness, rollout e rollback ensaiados | Bloqueia deploy                                   |
| Canais órfãos ou deleção indevida de recurso externo  | Arquitetura, #4/#5 |   4 |   5 |        20 | ownership, estados de operação, reconciliação sem apagar desconhecidos                      | Bloqueia Fase 1                                   |

## 4. Critérios de aceite verificáveis

### Contrato universal e isolamento

- Toda operação de domínio recebe `guildId` no contexto e rejeita ausência, mismatch entre interação e entidade ou acesso de membro que não pertence mais à guild.
- A instalação, configuração, jogo, squad, sessão, evento, perfil local, rank, saldo, inventário, reputação, permissões e auditoria têm escopo explícito aprovado pelo PO/Architect.
- Em um cenário com Guild A e Guild B, valores iguais de `discordUserId` não compartilham saldo, inventário, rank, reputação, sessões, elegibilidade ou consultas de leaderboard.
- Uma consulta sem filtro de guild para entidade tenantizada falha em revisão estática/teste de contrato; nomes de canal e cache nunca são usados como tenant ou autorização.

### Retenção, expurgo e auditoria — Decisão Humana 001 v1.1.0

**Estado atual:** `tests/postgres-integrity.test.ts` já verifica perfis separados para o mesmo Discord ID, mutação A sem efeito em B, e escrita/lookup positivo de auditoria por `actorId`. O último caso demonstra a FK atual e **não** prova sobrevivência da auditoria ao expurgo. O teste de migration acrescenta `guildId` a tabelas legadas, mas não valida mapeamento misto de Discord IDs/profile IDs. O schema atual não contém `Squad.closedAt` nem `ProvisioningOperation`; `AuditLog.actorId` é opcional e mantém relação a `UserProfile`. Não existem testes de prazos, privacy deletion, referential isolation cruzado ou validação fail-closed de órfãos legados.

**Testes TDD requeridos nas stories de implementação após o contrato 0.1 ser aprovado:**

- Com relógio fixo do PostgreSQL: closed squad permanece em `closedAt + 90d - 1ms`; no limite de `+90d` fica elegível; nada com estado não terminal, `closedAt` nulo ou `orphan_pending` entra na seleção.
- Backfill de estado `closed` legado usa um único instante UTC da migração e mantém a linha por 90 dias adicionais; `ProvisioningOperation` não terminal e órfão externo não são eliminados pelo job.
- Audit event sobrevive ao expurgo da squad e perfil, sem cascade; permanece até `createdAt + 365d - 1ms` e fica elegível em `+365d`, por `createdAt` próprio e independente do encerramento da squad.
- Remoção/desinstalação da guild não apaga audit antes da retenção; operação de fechar squad persiste `closedAt`, estado/motivo e evento de auditoria atomicamente, reverte tudo em falha, e `closedAt` permanece imutável em retry/transição repetida.
- Depois de remover o perfil, o audit conserva `guildId` e `actorRef` opaco, sem FK/ID Discord/nome/campo pessoal em `target`/`details`; mesma pessoa não é correlacionada entre A/B e query de A nunca vê B.
- Migração de cada coluna de identidade legada verifica a origem e converte `(guildId, discordId)` ao profile ID local; duplicata, ausência ou guild mismatch impede validação e preserva o dado-fonte.
- Constraints compostas rejeitam membro/proprietário/participante apontando para `profileId` de outra guild; mesmo Discord ID em A e B resolve perfis independentes.
- Decisão Humana 007 aprova expurgo após 90 dias de `closedAt` de `VoiceSession` histórica e `ScheduledSquad`/attendees relacionados à squad. TDD futuro deve provar associação correta, fronteira temporal, ausência de remoção antes do limite e preservação independente de AuditLog por 365 dias. Não se alega que esses testes existem ou foram executados; decisão não autoriza job/cascade sem story própria.
- Decisão Humana 006 aprova DM amigável com seleção ao membro que sai; pedido de apagamento e remoção/desinstalação apagam perfil/preferências. Story de produto futura define UX, timeout/validade, DM indisponível e ausência de resposta. Não inferir timeout/fallback; TDD virá após esse contrato.

O teste de fronteira deve receber `asOf` capturado uma vez do banco em produção e substituível por instante fixo nos testes. Estes são cenários planejados, não evidência de implementação/teste executado nesta fase.

**Fronteira AIOX:** Story 0.1 entrega a classificação e o plano de testes, sem schema, migration, backfill, runtime ou expurgo. QA aqui pontua clareza/execução dos cenários; cada implementação subsequente precisa de story Ready própria e gates de dados.

### Setup e operação do núcleo

- Guild nova conclui `/setup`, `status`, confirmação, primeira squad e encerramento sem editar código, ambiente, banco ou painel administrativo.
- Setup interrompido pode ser retomado sem duplicar instalação, canais, configuração ou auditoria.
- Configuração incompleta, permissão insuficiente e falha recuperável retornam mensagem acionável e estado consultável por diagnóstico.
- Configuração mostra resumo antes da confirmação, mascara secrets e registra actor, data, mudança e resultado.

### Lifecycle e reconciliação

- Cada transição inválida é rejeitada e cada transição válida é idempotente.
- Criação parcial, falha de persistência, falha de API Discord, retry, reinício, canal apagado e canal desconhecido são cenários de teste obrigatórios.
- Retry não cria canais ou mensagens duplicadas; compensação só remove recursos com ownership do bot.
- Reconciliação marca divergência, oferece reparo explícito e gera auditoria; não apaga automaticamente registro ou canal desconhecido.
- Expiração usa relógio controlado, respeita valores por guild e registra motivo; presença passiva ou movimentação sem mudança de composição não renova atividade.

### Autorização e mensagens

- Owner e staff autorizado passam apenas nas capabilities previstas; líder só atua na própria squad; membro não executa ações destrutivas.
- Toda interação valida `guildId`, associação atual, alvo, capability e expiração do componente no momento do uso.
- Usuário de outra guild, ex-membro, alvo ausente, alvo fora da squad, componente expirado e repetição recebem rejeição segura e não mutam dados.
- Conteúdo externo é normalizado, limitado e enviado sem parsing de menções, salvo exceção explicitamente aprovada e testada.

### Segurança e release

- Nenhum secret aparece no repositório, contexto Docker, camada de imagem, logs, auditoria, diff, resposta de configuração ou artefato de teste.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npx prisma validate` e `npm audit` têm resultado registrado; exceções têm responsável, prazo e aceite de risco.
- Deploy usa migrations versionadas, backup verificável, readiness do banco/app, healthcheck, rollout observável e rollback ensaiado em ambiente equivalente.
- Container e PostgreSQL são executados conforme menor privilégio aprovado; a porta do banco não fica publicada acidentalmente.

## 5. Estratégia de testes por fase

### Fase 0: decisões e fundação

1. Testes de contrato para a matriz de escopo, permissões, lifecycle, retenção e migração.
2. Fixtures determinísticas de duas guilds e clock fake para timers.
3. Harness de PostgreSQL isolado, migrations aplicadas e limpeza por suite.
4. Adapter Discord fake com falhas injetáveis em create, edit, delete, send e fetch.
5. Pipeline mínimo executando build, typecheck, lint, testes, Prisma validate, audit e secret scanning.

**Saída obrigatória:** cada risco P0 tem um teste nomeado, dado de entrada, resultado esperado e evidência armazenada.

### Fase 1: núcleo universal confiável

- Unitários: políticas, capabilities, transições, validação de configuração e normalização.
- Integração DB: constraints por guild, transações, índices, idempotência e rollback lógico.
- Integração Discord: setup, provisionamento, permissões efetivas, painel, mensagens e reconciliação.
- End-to-end controlado: instalar Guild A e B, criar/entrar/sair/encerrar/expirar squads e reiniciar o processo.
- Resiliência: API Discord indisponível, banco indisponível, timeout, retry, cache vazio e canal removido manualmente.

**Gate:** nenhuma falha de isolamento, autorização, limite, lifecycle ou recurso órfão; primeira squad em guild nova sem intervenção técnica.

### Fase 2: comunidade jogável

- Reputação: nomes, participantes válidos, auto-voto, duplicata, expiração, visibilidade e retenção por guild.
- Eventos e ranking: timezone, lembretes escopados, atualização/restart e ausência de vazamento.
- Moderação: report, blacklist, auditoria, rate limit, payload grande e conteúdo de controle.

**Gate:** repetir a jornada de jogar, avaliar e retornar sem alterar o estado de outra guild.

### Fase 3: módulos opcionais

- Ativação, pausa, reset e reconfiguração de Economia e Twitch em uma guild sem afetar outra.
- Compra e reward concorrentes com saldo não negativo, ledger sem duplicata e request replay seguro.
- Twitch `clientSecret` cifrado por guild no PostgreSQL (ADR-006); `SECRETS_MASTER_KEY` e segredos operacionais compartilhados ficam apenas no runtime. Testar mascaramento/ausência em logs e isolamento por guild; falha externa isolada, rate limit por guild e mensagens sem menções abusivas.

**Gate:** desligar o módulo não quebra o core nem perde dados fora da política aprovada.

### Fase 4: distribuição e escala

- Teste de instalação por terceiro com permissões mínimas e comandos globais propagados.
- Smoke test de imagem produzida, filesystem, usuário, rede, volumes, logs e health/readiness.
- Ensaio de backup/restauração, migration deploy, rollback, rotação de secret e atualização sem downtime além do limite aprovado.
- Teste de carga com várias guilds e réplicas; rate limit compartilhado quando houver mais de um processo.

**Gate:** evidência de operação em ambiente equivalente, sem riscos críticos/altos abertos ou aceite formal nominal de cada exceção.

## 6. Dados de teste para duas guilds

Usar IDs sintéticos e fixos apenas no ambiente de teste:

| Dado              | Guild A                           | Guild B                           |
| ----------------- | --------------------------------- | --------------------------------- |
| Identidade        | `user-shared` também existe em B  | `user-shared` também existe em A  |
| Nome do jogo      | `Arena A`                         | `Arena B`                         |
| Limite por jogo   | 1 squad                           | 2 squads                          |
| Limite de membros | 2                                 | 3                                 |
| Expiração vazia   | 5 minutos                         | 30 minutos                        |
| Staff             | `staff-a`                         | `staff-b`                         |
| Módulos           | Twitch desligado, economia ligada | Twitch ligado, economia desligada |
| Canais            | categoria/canais próprios         | categoria/canais próprios         |

Fixtures adicionais: `owner-a`, `owner-b`, `member-a`, `member-b`, `outsider`, `ex-member`, dois jogos com o mesmo nome em guilds distintas, saldo 100 em A e 7 em B para `user-shared`, reputação e ranks deliberadamente diferentes, componentes de painel de cada guild e um canal sem ownership do bot.

Invariantes do cenário:

- ações em A nunca retornam ou mutam nomes, limites, saldo, rank, reputação, canais, auditoria ou módulos de B;
- `user-shared` pode ter identidade técnica comum, mas perfis e dados comunitários permanecem distintos;
- falhar o Twitch em B não altera a squad nem a economia de A;
- comandos recebidos por DM, guild errada, canal errado ou componente de outra guild são rejeitados.

## 7. Testes de concorrência

Executar contra PostgreSQL real de teste, com isolamento conhecido e logs de `correlationId`:

1. Enviar `limite + 5` criações simultâneas para o mesmo `(guildId, gameId)`; esperar exatamente o limite persistido, rejeições explícitas e nenhuma duplicata de canal/registro.
2. Enviar entradas simultâneas quando resta uma vaga; esperar uma única entrada aceita e nenhuma contagem acima do limite.
3. Repetir a mesma interação, evento e job com a mesma idempotency key; esperar uma mutação e respostas replayáveis.
4. Encerrar, expirar e sair da mesma squad simultaneamente; esperar estado final válido, cleanup idempotente e auditoria coerente.
5. Comprar/recompensar simultaneamente com saldo insuficiente e suficiente; esperar saldo nunca negativo, um ledger por request e nenhum item sem débito.
6. Executar as mesmas cargas em A e B em paralelo; esperar ausência de lock global indevido e ausência de contaminação entre tenants.
7. Repetir com duas réplicas para confirmar que rate limit e locks têm escopo compatível com a topologia aprovada.

Critérios de falha: deadlock não recuperado, timeout sem estado diagnosticável, contagem acima do limite, saldo negativo, duplicata, orphan resource ou qualquer mutação cruzada.

## 8. Segurança

- **Código e dados:** testes negativos de autorização, guild mismatch, componente expirado, ex-membro, alvo fora da squad, auto-voto, repetição e entrada inválida.
- **Mensagens:** payload com `@everyone`, `@here`, menções de usuário/cargo, caracteres de controle, Unicode inválido, texto máximo e burst; verificar `allowedMentions`, truncamento e rate limit.
- **Secrets:** inspeção de arquivos/contexto/imagem e logs; confirmar que `.env`, chaves, dumps e valores de teste não são empacotados.
- **Banco:** confirmar menor privilégio, ausência de porta publicada, backup cifrado conforme política e impossibilidade de consulta cross-guild por contrato.
- **Dependências:** executar audit completo e de produção, documentar advisories e verificar lockfile reproduzível.
- **Migração:** testar duplicidade, referência sem guild, saldo sem correspondência, rollback e restauração; não aceitar `db push` destrutivo em produção.
- **Auditoria:** cada alteração administrativa, reparo, rejeição sensível, recompensa, compra e exceção de permissão deve ser rastreável sem conteúdo sensível excessivo.

## 9. Deploy e operação

O deploy somente pode avançar após evidenciar:

- imagem construída a partir de contexto limpo e inspecionado;
- migrations versionadas aplicadas em staging equivalente, com backup antes e restauração testada;
- app aguardando readiness do banco e healthcheck útil, sem declarar sucesso antes de comandos e reconciliação concluírem;
- smoke test de `/diagnostics`, registro de comandos, setup, criação/encerramento de squad e logs estruturados;
- rollback para versão anterior testado com app e schema compatíveis;
- rotação de Discord/Twitch/database secrets executada pelo operador sem imprimir valores;
- observabilidade por guild para erros, retries, órfãos, jobs atrasados, permissões e módulos externos;
- limitações da VPS, registry, firewall, backups, permissões Discord efetivas e replicas registradas como evidência, não como suposição.

## 10. Condições de bloqueio

Bloquear criação de stories de implementação, promoção de fase ou distribuição ampla quando ocorrer qualquer condição abaixo:

- matriz de escopo, topologia, migração, retenção ou permissões sem aprovação registrada;
- ausência de teste executável de isolamento com duas guilds;
- qualquer bypass de autorização ou ação destrutiva permitida por membro comum;
- limite, lifecycle, restart ou reconciliação sem teste de falha e concorrência;
- registro global de entidade que deveria ser por guild, consulta sem tenant ou scheduled squad sem `guildId` definido;
- secret encontrado em código, imagem, contexto, log, relatório ou banco legado sem rotação/remoção aprovada;
- SEC-009 sem correção compatível ou aceite formal de risco residual;
- deploy sem migration versionada, backup restaurável, readiness, rollback ou smoke test;
- teste flaky não triado, falha mascarada por retry ilimitado ou evidência baseada apenas em build/typecheck;
- qualquer achado crítico/alto da auditoria que afete autorização, secrets, isolamento, dependência, integração ou deploy sem tratamento formal.

## 11. Gaps e stories necessárias

1. @qa pontua Story 0.1 revisada para identidade, estados de provisioning, retenção/privacidade e TDD; @po valida readiness. Decisão Humana 001 v1.1.0 está aprovada e seus mecanismos estão propostos em ADR-007; não reabrir prazos.
2. Criar story de ambiente QA com PostgreSQL isolado, fixtures de duas guilds, clock controlado, adapter Discord fake e falhas injetáveis.
3. Criar story de contratos de `GuildContext`, capabilities, idempotência, lifecycle e estados de reconciliação antes do schema final.
4. Criar story de cobertura de integração/concorrência; os quatro testes atuais não validam o risco principal.
5. Criar story de migração e rollback com backup restaurável, incluindo `ScheduledSquad`, perfis, ledger, reputação e referências órfãs.
6. Criar story de pipeline de qualidade com audit, secret scanning, build reproduzível e evidência de imagem/deploy.
7. Atualizar a auditoria após cada remediação, distinguindo “corrigido no código” de “validado em ambiente real”.
8. Definir explicitamente quais decisões entram em cada story para evitar que #1, #2 e #7 sejam implementadas antes dos contratos P0 de #8 e do core #3-#6.

## 12. Condição para mudar o veredito

O veredito pode mudar para **GO para stories de implementação da Fase 1** quando os gaps 1 a 6 tiverem evidência anexada, as decisões de escopo/permissão/migração estiverem aprovadas e os testes mínimos de isolamento, concorrência, falha, segurança e deploy passarem em ambiente controlado. A distribuição ampla continua condicionada ao fechamento ou aceite formal dos riscos residuais SEC-007, SEC-009, SEC-010, SEC-011 e SEC-014.
