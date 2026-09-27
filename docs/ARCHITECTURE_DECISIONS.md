# Decisões Arquiteturais — ShogunBot Universal

**Data:** 2026-09-11
**Autor:** @architect (Aria)
**Base:** [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md), [ARCHITECTURE_UNIVERSAL_BOT.md](ARCHITECTURE_UNIVERSAL_BOT.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md), código atual e issues #2, #3, #4, #6, #7, #9
**Status:** decisões aprovadas do lado do Architect. Itens marcados `[PO]` continuam dependendo de decisão de produto.

Este documento é a fonte única das decisões arquiteturais que destravam a Fase 0 e a Fase 1. Ele **não altera código, schema, migrations nem deploy**. Onde uma decisão exige mudança de schema, a mudança está **descrita**, não aplicada — a execução é de @data-engineer dentro da story correspondente.

Quando este documento contradiz `ARCHITECTURE_UNIVERSAL_BOT.md`, **este documento prevalece** (ele é posterior e incorpora decisões de produto confirmadas depois daquele texto). As divergências estão explicitadas em cada ADR.

---

## Sumário

| ADR | Assunto | Issue / Story | Estado |
| --- | --- | --- | --- |
| [ADR-001](#adr-001--concorrência-e-limites-de-squads) | Locking e atomicidade dos limites | #3 / 1.1 | Decidido |
| [ADR-002](#adr-002--reconciliação-discord--postgresql) | Reconciliação, rollback e FKs `NOT VALID` | #4, #9 Gap 3 / 1.2 | Decidido |
| [ADR-003](#adr-003--matriz-de-permissões-dos-canais-de-squad) | Matriz de permissões | #6 / 0.3 + 1.4 | Decidido (`[PO]` em staff) |
| [ADR-004](#adr-004--política-de-atividade-e-expiração) | Atividade, expiração e restart | #7 / 1.3 + 1.6 | Decidido |
| [ADR-005](#adr-005--registro-de-slash-commands-multi-guild) | Registro de comandos multi-guild | #9 Gap 1 | Decidido |
| [ADR-006](#adr-006--credenciais-twitch-por-guild) | `clientSecret` Twitch por guild | #9 Gap 2, #2 / 1.7 | Decidido |

---

## Achado transversal que motiva ADR-001 e ADR-002

`src/squadManager.ts:283` abre uma transação Prisma, adquire um advisory lock e **executa chamadas à API do Discord dentro dessa transação** (`createVoiceChannel`, `createTextChannel`, `textChannel.send`), só fechando a transação depois. Consequências:

1. **O lock `(guild, game)` fica retido durante I/O de rede.** Toda criação de squad do mesmo jogo na mesma guild serializa atrás da latência do Discord (centenas de ms, mais rate limit e retry). É o pior caso de contenção possível e piora linearmente com adoção.
2. **A conexão do pool fica presa** pelo mesmo período. Sob rate limit do Discord, o pool de conexões do Postgres esgota antes do Discord responder.
3. **A compensação é executada com a transação ainda aberta** e o resultado do `catch` é descartado (`.catch(() => undefined)`). Se o `delete` do canal falhar, a transação faz rollback — o banco esquece a squad, o Discord fica com os canais. É exatamente o canal órfão que a issue #4 quer eliminar, produzido pelo próprio caminho feliz de falha.
4. **Não há registro do efeito externo.** Depois do rollback não sobra nenhuma linha dizendo "criei estes canais e não consegui apagar".

Isto não é um detalhe de implementação: é a razão pela qual #3 e #4 não podem ser resolvidas independentemente. **A fronteira transacional nunca pode conter I/O do Discord.** Os dois ADRs abaixo partem dessa regra.

---

## ADR-001 — Concorrência e limites de squads

**Contexto:** issue #3 / Story 1.1. Limites: 10 squads ativas por jogo/guild e 15 membros por squad, ambos *defaults configuráveis por guild* (§12.1). Precisam valer sob criação simultânea.

### Decisão

**O padrão `pg_advisory_xact_lock` já usado no repositório se estende para este caso e passa a ser o mecanismo oficial de serialização de invariantes de contagem.** Com quatro correções obrigatórias.

Justificativa da escolha do padrão: o invariante é *"conte as linhas existentes e decida se pode inserir mais uma"*. Isso não é expressável por constraint declarativa quando o `N` é configurável por guild e pode ser **reduzido** pelo admin depois (baixar de 10 para 5 não pode invalidar as 10 squads já ativas). Precisa de leitura-decisão-escrita mutuamente exclusiva. Advisory lock transacional é o instrumento certo: é liberado automaticamente no commit/rollback (não vaza em caso de crash da aplicação), não bloqueia escritores não relacionados e não depende de uma linha-âncora existir.

### Correções obrigatórias

**C1 — Nenhuma chamada Discord dentro da transação.** Ver ADR-002 para o desenho em três fases. A transação que segura o lock executa apenas SQL.

**C2 — Namespacing das chaves de lock.** Hoje três domínios distintos compartilham o mesmo espaço de 64 bits sem prefixo:

| Local | Chave atual | Domínio |
| --- | --- | --- |
| `squadManager.ts:283` | `{guildId}:{gameName}` | limite de squads |
| `squadManager.ts:677` | `{guildId}:{squadId}` | limite de membros |
| `voiceEconomy.ts:58` | `{guildId}:{profile.id}` | sessão de voz |

Como `hashtextextended` mapeia tudo para o mesmo espaço, uma colisão entre domínios é possível e se manifestaria como uma serialização silenciosa e inexplicável entre operações não relacionadas (nunca como corrupção — o risco é de performance e de debug impossível, não de correção). Adotar a forma de dois argumentos, `pg_advisory_xact_lock(classid int4, objid int4)`, com `classid` fixo por domínio (`1 = squad_count`, `2 = squad_membership`, `3 = voice_session`), ou prefixar a string com um literal de domínio. A forma de dois argumentos é preferível por ser autodocumentada.

**C3 — Chavear por `gameId`, não por `gameName`.** `{guildId}:{gameName}` usa um nome mutável e sensível a caixa/acentuação. Duas grafias do mesmo jogo pegam locks diferentes e furam o limite; um rename de jogo troca o lock no meio do voo. A chave correta é `(guildId, gameId)` — o mesmo par que o limite protege. Como `getOrCreateGame` roda dentro da transação, o `gameId` está disponível antes da contagem.

**C4 — Timeouts explícitos.** A transação deve executar `SET LOCAL lock_timeout` e `SET LOCAL statement_timeout` (sugestão inicial: 3s e 10s) e o `$transaction` do Prisma deve declarar `maxWait`/`timeout` coerentes. Sem isso, um lock retido por um caminho lento acumula conexões até esgotar o pool. Estouro de `lock_timeout` é erro de negócio recuperável ("tente novamente"), não erro 500.

### Alocação dos locks

| Invariante | Chave | Escopo da transação |
| --- | --- | --- |
| ≤ N squads ativas por jogo | `(squad_count, hash(guildId, gameId))` | contar squads em `provisioning`+`active`, inserir `Squad` + `SquadMember` do dono + linha de provisioning. Só SQL. |
| ≤ M membros por squad | `(squad_membership, hash(guildId, squadId))` | ler squad, contar membros, inserir membro. Já está correto em `createMemberEntryIfNeeded` — só precisa de C2/C4. |
| Um usuário não entra duas vezes | — | `UNIQUE (guildId, squadId, userId)` já existente. Invariante declarativo, não depende de lock. |
| Um usuário não está em duas squads do mesmo jogo | mesmo lock de `squad_count` | a checagem `alreadyMember` já roda sob o lock correto. |

**Squads em `provisioning` contam para o limite.** É a escolha conservadora: prefere-se recusar uma criação a estourar o limite. Uma linha travada em `provisioning` é liberada pelo reconciliador (ADR-002), não por expiração de lock.

### Nível de isolamento

Read Committed (default do Prisma/Postgres). O advisory lock cobre a janela ler-decidir-escrever, então Repeatable Read/Serializable não acrescentam garantia e introduziriam `40001` e necessidade de retry. **Não usar Serializable aqui.**

### Alternativas rejeitadas

| Alternativa | Por que foi rejeitada |
| --- | --- |
| `SELECT ... FOR UPDATE` na linha de `Game` | Funciona e serializa igual, mas acopla o limite de squads ao bloqueio da linha `Game`, que é lida por muitos outros caminhos (rename, config, matchmaking). Cria contenção em operações que nada têm a ver com o limite. |
| Reserva declarativa de slot (`Squad.slotIndex` + `UNIQUE (guildId, gameId, slotIndex)` parcial) | Elegante e sem lock, mas o `N` é configurável por guild e redutível. Um índice único não expressa "no máximo N" sem fixar N no schema, e reduzir o limite exigiria migration. Também não cobre o limite de membros de forma natural. |
| `SERIALIZABLE` + retry | Troca uma espera determinística por abortos e retries sob a mesma carga, com pior previsibilidade e pior observabilidade. |
| Lock em memória do processo (mutex) | Quebra no momento em que existir mais de uma réplica. A topologia alvo (§12.1) não garante processo único para sempre. |

### Consequências

- Toda criação de squad do mesmo jogo/guild é serializada — mas agora por alguns milissegundos de SQL, não por uma chamada de rede.
- O teste de concorrência da Story 1.1 precisa de PostgreSQL real (Story 0.5): advisory lock não existe em mock nem em SQLite.
- A estratégia fica documentada no código no ponto de aquisição de cada lock, com o `classid` nomeado por constante.

---

## ADR-002 — Reconciliação Discord ↔ PostgreSQL

**Contexto:** issue #4 / Story 1.2, e Gap 3 da issue #9. Depende de ADR-001.

### Decisão A — Máquina de estados persistida + outbox + reconciliador periódico

Rejeita-se explicitamente a saga com compensação automática distribuída e qualquer forma de 2PC. Discord não é um recurso transacional: é rate-limited, eventualmente consistente no cache, e a deleção de canal é irreversível. O modelo correto é **operação persistida com estado observável e reparo explícito**.

#### Estados da `Squad`

```
provisioning ──> active ──> closing ──> closed
     │                                     ▲
     └──> failed_provisioning ─────────────┘
                    │
                    └──> orphan_pending  (compensação falhou; exige ação humana)
```

**Mudança relevante:** `closed` substitui a exclusão física. Hoje `deleteSquadRecord` faz `squad.deleteMany`, o que destrói a trilha de auditoria e é a razão de existir o trigger `preserve_voice_session_history_before_squad_delete` e os `ON DELETE CASCADE` da migration `20260903_000003`. Com `closed` + retenção, o histórico de sessão, reputação e auditoria permanece íntegro por construção e os CASCADEs deixam de ser o mecanismo de preservação. A retenção antes do expurgo é `[PO]` (Story 0.1, política de privacidade).

#### Criação em três fases

| Fase | Transação? | Conteúdo | Falha resulta em |
| --- | --- | --- | --- |
| **T1** | Sim, com advisory lock (ADR-001) | valida limites; insere `Squad` em `provisioning`; insere `SquadMember` do dono; insere `ProvisioningOperation` com `requestId` idempotente e o plano de efeitos | nada foi criado no Discord; rollback é limpo e completo |
| **P2** | Não | efeitos Discord, um a um; **cada recurso criado é persistido imediatamente após sua criação**, antes do próximo efeito | `failed_provisioning`; os recursos já criados estão registrados e são compensáveis |
| **T3** | Sim | `provisioning` → `active`; fecha a `ProvisioningOperation` | reconciliador conclui ou compensa a partir do estado registrado |

O ponto central de P2: **persistir `voiceChannelId` assim que o canal de voz existir, antes de tentar criar o canal de texto.** Hoje os dois IDs são gravados juntos no final — por isso o cenário "voz criada, texto falhou" perde o rastro do canal de voz. Sem esse registro, nenhuma compensação é possível e nenhum reconciliador consegue distinguir o canal órfão de um canal legítimo do servidor.

#### Idempotência

`ProvisioningOperation.requestId` é derivado da interação Discord (`interaction.id`), que é único e estável em retry. Um retry com o mesmo `requestId` reanexa à operação existente em vez de criar uma segunda squad. Mesma regra vale para encerramento, compra e reward — é o `idempotency key` que a arquitetura §8 já pedia.

#### Ownership

Todo recurso criado pelo bot recebe um marcador de propriedade verificável: `ProvisioningOperation` guarda o `channelId` **e** o canal carrega o `squadId` em metadado durável (topic para texto; para voz, o vínculo é o registro no banco, já que canal de voz não tem topic confiável). **Nome de canal nunca é marcador de propriedade nem de autorização** (ADR-003).

#### Compensação

Só é permitido apagar um recurso que satisfaça as três condições ao mesmo tempo: (a) consta em uma `ProvisioningOperation` desta guild, (b) o estado da operação é terminal de falha, (c) uma leitura via API (`fetch`, não cache) confirma que o recurso existe e continua correspondendo ao registro. Falhando qualquer uma, a operação vai para `orphan_pending`, gera audit event e aparece em `/diagnostics`. **Nunca apagar por inferência.**

#### Reconciliador

Roda no startup e periodicamente. Classifica, e só então age:

| Divergência | Ação padrão |
| --- | --- |
| Registro no banco sem canal no Discord | marca `pending_reconciliation`; após 2 detecções consecutivas com `fetch` confirmando ausência, move a squad para `closing`/`closed` com motivo `reconciled_missing_channel` |
| Canal com marcador de ownership sem registro ativo | compensa conforme as três condições acima |
| Canal **sem** marcador de ownership | nunca tocar. Registra e reporta, nada mais |
| Tipo/parent/overwrites divergentes | reaplica o estado desejado (idempotente), audita |
| Instalação sem permissão necessária | marca a instalação como degradada e notifica o staff; não tenta o efeito |

**Correção obrigatória no código atual:** a varredura de "canal controlado órfão" (`src/squadManager.ts` ~linha 649) decide pelo cache (`guild.channels.cache`) e apaga na primeira detecção. Cache frio no startup é indistinguível de canal apagado — esse caminho pode deletar canais legítimos logo após um restart. Passa a exigir `fetch` e duas detecções consecutivas espaçadas, com o período de graça do ADR-004.

### Decisão B — Plano seguro para validar as FKs `NOT VALID` (Gap 3)

São 15 constraints `NOT VALID` entre `20260903_000002` e `20260903_000003`. `VALIDATE CONSTRAINT` toma apenas `SHARE UPDATE EXCLUSIVE` na tabela filha (não bloqueia DML) mas **falha inteira** se existir uma única linha órfã. Em produção, falhar no meio de uma janela é aceitável; o que não é aceitável é descobrir os órfãos durante a janela.

**Pré-condições antes de qualquer `VALIDATE` em produção:**

1. **A Decisão A deste ADR precisa estar implantada.** Validar FKs enquanto o código ainda faz `deleteMany` de `Squad` e enquanto existem linhas em estados intermediários não registrados é validar contra um alvo móvel.
2. **Backup restaurável e testado** (não apenas tirado) — pré-condição já exigida pela Story 0.4.
3. **Inventário de órfãos executado sobre um snapshot/cópia**, constraint por constraint, com anti-join:

   ```sql
   -- template; repetir por constraint
   SELECT count(*) FROM "SquadMember" c
   LEFT JOIN "Squad" p ON p."guildId" = c."guildId" AND p."id" = c."squadId"
   WHERE c."squadId" IS NOT NULL AND p."id" IS NULL;
   ```
4. **Classificar cada órfão** em: (i) linha legada com `guildId = 'legacy'`, (ii) referência a entidade já removida, (iii) divergência real de tenant. As três têm remediações diferentes e nenhuma delas é "apagar".
5. **Remediar antes de validar:** backfill de `guildId` onde a guild é determinável; `NULL` na coluna FK onde ela é anulável (`VoiceSession.squadId` já é anulável e o trigger existente faz exatamente isso); arquivamento em tabela `*_orphans` quando a linha não puder ser corrigida nem anulada. Nunca `DELETE` silencioso.
6. **Uma constraint por vez**, fora do pico, com `SET lock_timeout`, e re-executando o anti-join correspondente **imediatamente antes** de cada `VALIDATE`, na mesma janela. Um anti-join limpo de ontem não é evidência.
7. **Rollback documentado:** não existe "invalidar" uma constraint validada. O rollback é `DROP CONSTRAINT` + `ADD ... NOT VALID`. Precisa estar escrito no runbook antes de começar.

**Dois bloqueadores que precisam de decisão antes de validar, não durante:**

- **`AuditLog_guildId_actorId_fkey` → `UserProfile`.** Validar essa FK acopla a trilha de auditoria ao ciclo de vida do perfil: a remoção de dados de um membro (política de privacidade, §12.1) passaria a exigir apagar ou reescrever registros de auditoria. Recomendação do Architect: **não validar essa constraint; substituí-la por `ON DELETE SET NULL` ou removê-la**, mantendo `actorId` como referência fraca e preservando um `actorDiscordId` desnormalizado no próprio registro de auditoria. Auditoria precisa sobreviver ao expurgo do sujeito. `[PO]` confirma a política de retenção.
- **Inconsistência de chave de identidade.** Conforme o cabeçalho da própria migration `000003`, `SquadMember.userId`, `Squad.ownerId`, `ReputationParticipant.userId` e `ReputationVote.voterId/targetId` guardam **Discord IDs**, enquanto `UserProfile.id` é um ID interno — e `Squad_guildId_ownerId_fkey` referencia `UserProfile(guildId, discordId)` enquanto as demais referenciam `UserProfile(guildId, id)`. Há duas chaves de identidade convivendo. **Unificar antes de validar**, adotando `(guildId, discordId)` como chave natural escopada por guild (é a que o Discord entrega em toda interação e a que elimina uma indireção em todo caminho quente). Essa unificação é trabalho de schema da Story 0.1/0.4, executado por @data-engineer.

---

## ADR-003 — Matriz de permissões dos canais de squad

**Contexto:** issue #6 / Stories 0.3 e 1.4; SEC-002 e SEC-012.

### Princípio inegociável

**Nenhuma ação de squad escreve um permission overwrite que conceda a um usuário `Administrator`, `ManageChannels`, `ManageRoles`, `ManageGuild`, `MoveMembers`, `MuteMembers`, `DeafenMembers` ou `ManageMessages`.** Os poderes do líder sobre a própria squad são aplicados **na camada de aplicação**, comparando o ator com `Squad.ownerId`, e executados pelo bot com as permissões do bot. O líder nunca recebe poder no Discord; ele recebe uma capacidade no domínio.

Isso responde diretamente ao critério "nenhuma ação da Squad concede `Administrator` ou equivalente" e ao risco SEC-002. Conceder `ManageChannels` ao dono da squad seria o atalho óbvio e é precisamente o que está proibido: no Discord, `ManageChannels` em um canal permite editar overwrites daquele canal, o que é escalonamento de privilégio dentro da área de squads.

### Matriz de overwrites nos canais da squad (voz e texto)

| Ator | ViewChannel | Connect | Speak | SendMessages | Overwrite escrito? |
| --- | --- | --- | --- | --- | --- |
| `@everyone` | **deny** | **deny** | — | **deny** | sim, explícito |
| Bot | allow | allow | allow | allow | herdado da categoria (+ `ManageChannels`, `ManageRoles`, `MoveMembers` na categoria) |
| Membro da squad | allow | allow | allow | allow | sim, por usuário |
| Líder (owner) | allow | allow | allow | allow | **idêntico ao membro** — sem overwrite extra |
| Staff configurado | allow | allow (`[PO]`) | allow | allow | por **cargo**, não por usuário; opcional por guild |
| Ex-membro / expulso / banido da squad | overwrite removido | — | — | — | remoção do overwrite + desconexão da voz se conectado |
| Usuário externo à squad | — | — | — | — | **nenhum overwrite** — negado pelo deny de `@everyone` |
| Usuário de outra guild | irrelevante | — | — | — | a interação é rejeitada antes de qualquer efeito |

Notas:

- As permissões do **bot** são concedidas na **categoria**, não canal a canal. Menos overwrites, menos drift, e é o que permite a reconciliação reaplicar estado de forma idempotente.
- `userLimit` do canal de voz é **UX, não autorização**. Ele não impede staff com `MoveMembers` de inserir alguém acima do limite. O limite autoritativo é a contagem no banco (ADR-001), verificada na entrada.
- A visibilidade de staff nos canais de squad é **opt-in por guild**, default **desligado**. Staff enxergar toda conversa privada de squad por padrão é uma escolha de privacidade que pertence ao dono da guild, não ao produto. `[PO]`

### Matriz de capabilities por ação

| Ação | Dono/Admin da guild | Staff configurado | Líder da squad | Membro | Externo |
| --- | --- | --- | --- | --- | --- |
| `/setup`, resetar setup | sim | se capability `manage_setup` | não | não | não |
| Alterar configuração da guild | sim | por área configurada | não | não | não |
| Criar squad | sim | sim | sim | sim | sim (membro da guild) |
| Entrar / sair de squad | sim | sim | sim | sim | sim (sujeito a rank/blacklist) |
| Renomear a **própria** squad | sim | se `manage_any_squad` | sim | não | não |
| Expulsar/bloquear na **própria** squad | sim | se `manage_any_squad` | sim | não | não |
| Encerrar a **própria** squad | sim | se `manage_any_squad` | sim | não | não |
| Encerrar **qualquer** squad | sim | se `manage_any_squad` | não | não | não |
| Ver auditoria / `/diagnostics` | sim | se `view_audit` | não | não | não |
| Votar reputação | sem privilégio especial | sem privilégio especial | como participante | como participante | não |

### Modelo de staff

**Cargos por ID + capabilities nomeadas.** Não por nome de cargo (renomeável, falsificável), não por permissão Discord como modelo primário.

`Administrator` / `ManageGuild` da guild são aceitos **apenas como bootstrap**: enquanto nenhum cargo de staff estiver configurado, quem tem essas permissões pode executar ações de staff — caso contrário uma guild recém-instalada fica sem ninguém capaz de rodar `/setup`. Cada uso desse caminho grava audit event `authz_fallback_guild_permission`. Assim que houver cargo configurado, o fallback deixa de valer para ações de módulo. Isso encerra o risco SEC-012 (uso de `Administrator`/`ManageChannels` como atalho de autorização espalhado pelos handlers) sem tornar o primeiro setup impossível.

### Validações obrigatórias em toda interação

Avaliadas **no momento da ação**, nunca em cache do setup:

1. `interaction.guildId` existe e é igual ao `guildId` da entidade alvo (bloqueia interação cross-guild e componente reenviado em outra guild);
2. o ator ainda é membro da guild **e** ainda detém o cargo/capability exigido (cargos mudam depois do setup);
3. a entidade alvo pertence à guild da interação e está em estado que admite a ação (`active`, não `closing`/`closed`);
4. o `custom_id` do componente carrega `squadId` + timestamp de emissão e é rejeitado após TTL — painel antigo não executa ação nova;
5. o alvo da ação (expulsar/bloquear) pertence à squad;
6. a operação é idempotente sob repetição do mesmo componente (duplo clique não produz dois efeitos);
7. as permissões efetivas **do bot** são verificadas antes de cada efeito externo, com mensagem acionável se faltar alguma.

### Casos de borda decididos

- **Líder sai da guild:** propriedade transfere para o membro mais antigo remanescente; se não houver, a squad vai para `closing`. Audit event em ambos os casos.
- **Líder perde cargo de staff:** irrelevante — os poderes de líder derivam de `Squad.ownerId`, não de cargo.
- **Membro sai da guild:** overwrite removido, membro removido da squad, conta como evento de atividade (ADR-004).
- **Cargo de staff é deletado na guild:** a capability simplesmente não resolve; `/diagnostics` reporta a configuração quebrada. Nunca degradar para "todo mundo pode".

---

## ADR-004 — Política de atividade e expiração

**Contexto:** issue #7 / Stories 1.3 e 1.6.

### Confirmação dos defaults de §12.1

Confirmado após leitura de `PROJECT_DIRECTION.md` §12.1. Os valores já são decisão de produto registrada e **não são reabertos**:

| Parâmetro | Default | Configurável por guild |
| --- | --- | --- |
| Squads ativas por jogo | 10 | sim |
| Participantes por squad | 15 | sim |
| Squad vazia | 5 minutos | sim |
| Squad ocupada sem atividade relevante | 24 horas | sim |

§12.1 também já estabelece que "presença passiva e movimentação de voz sem mudança de composição não renovam atividade". A formalização abaixo é a aplicação dessa regra, não uma nova decisão.

### Eventos que renovam `lastActivityAt`

| Evento | Conta? | Razão |
| --- | --- | --- |
| Mensagem de um **membro da squad** no canal de texto da squad | **sim** | intenção explícita, ator identificado |
| Entrada de participante | **sim** | muda a composição |
| Saída / expulsão / banimento de participante | **sim** | muda a composição |
| Alteração de configuração da squad (rename, faixa de rank, blacklist) | **sim** | ação deliberada sobre a entidade |
| Ação administrativa do líder ou do staff sobre a squad | **sim** | idem |
| Interação de painel que **muta estado** | **sim** | idem |
| Transferência de propriedade | **sim** | idem |

### Eventos que NÃO renovam

| Evento | Razão |
| --- | --- |
| Presença passiva em voz | é o caso que a política existe para encerrar; um usuário esquecido conectado manteria o canal vivo para sempre |
| Mute/deafen/câmera/stream | não muda composição nem demonstra intenção |
| Mover-se entre canais de voz **da mesma squad** | idem |
| Mensagem de bot ou webhook | não há ator humano |
| Mensagem de quem **não é membro** da squad | não é participação; evita que um outsider mantenha a squad viva |
| Reação, digitação, edição, pin | ruído; abriria um vetor trivial de manter canal vivo |
| Leituras: `/diagnostics`, `/config show`, ver o painel sem mutar | consulta não é atividade |

**Princípio que resolve os casos futuros:** só renova atividade um evento que tenha (a) um ator humano que seja membro da squad e (b) uma mutação de estado ou uma comunicação dirigida à squad. Consulta e presença nunca renovam.

### Regra de squad vazia

"Vazia" = o canal de voz tem zero membros humanos conectados. A janela de 5 minutos é ancorada em **`Squad.emptySinceAt` persistido no banco**, não em `setTimeout` de memória. Ao alguém conectar, `emptySinceAt = NULL`.

Isto corrige o `scheduleEmptySquadCleanup` atual, que mantém o prazo apenas em `this.cleanupTimers`: hoje um restart perde todos os timers, e uma squad que ficou vazia antes do restart só é coletada pela regra de 24h — ou nunca, se o `runCleanupChecks` não reencontrar o canal. Timer em memória passa a ser só otimização; a verdade está no banco.

### Comportamento após restart

1. **Nenhum timer é autoritativo.** No boot, o reconciliador recalcula os dois prazos a partir de `lastActivityAt` e `emptySinceAt` persistidos.
2. **O tempo de downtime conta.** Os prazos são wall-clock, não uptime do bot. Uma squad que atingiu 24h de inatividade enquanto o bot estava fora está expirada.
3. **Período de graça no boot.** Antes de qualquer expiração destrutiva, o bot observa por uma janela de graça (sugestão: o maior entre 5 min e um ciclo do timeout de vazio) para ler o estado real de voz via `fetch`. Sem isso, um downtime longo somado a cache frio produziria uma deleção em massa de squads que têm gente conectada agora. Esta regra e a regra de duas detecções do ADR-002 são a mesma proteção vista de dois ângulos.
4. **Expiração e reconciliação são o mesmo caminho de código.** Uma squad só sai de `active` pelo caminho `closing → closed` do ADR-002, qualquer que seja o motivo.

### Auditabilidade

Todo encerramento grava um audit event com motivo tipado e os timestamps que o dispararam:

`closed_by_owner` · `closed_by_staff` · `expired_empty` · `expired_inactivity` · `reconciled_missing_channel` · `closed_guild_removed`

Hoje o código grava um único motivo `"expired_or_reconciled"` (`src/squadManager.ts` ~linha 448), que funde pelo menos quatro causas distintas e torna impossível responder "por que minha squad sumiu?" — critério de aceite explícito da issue #7. A separação é obrigatória.

---

## ADR-005 — Registro de slash commands multi-guild

**Contexto:** Gap 1 da issue #9. Hoje `src/bot.ts:193` e `src/deploy-commands.ts:15` usam `Routes.applicationGuildCommands(clientId, GUILD_ID)` com uma única guild fixa, exigida como variável de ambiente obrigatória.

### Decisão

**Registro global via `Routes.applicationCommands(clientId)`, executado uma vez por deploy.** Registro por guild permanece disponível apenas como atalho de desenvolvimento, sob `DEV_GUILD_ID` opcional, nunca no caminho de produção.

### Trade-off

| | Global (`applicationCommands`) | Por guild (`applicationGuildCommands` em `GuildCreate`) |
| --- | --- | --- |
| Propagação | até 1h documentado (na prática, minutos) | instantânea |
| Guild nova | coberta automaticamente | exige handler de `GuildCreate` |
| Guild que entrou com o bot offline | coberta automaticamente | **exige job de backfill** — furo silencioso |
| Custo de deploy | 1 requisição | 1 requisição × número de guilds |
| Drift entre guilds | impossível | guilds antigas ficam com definições velhas até rerregistro |
| Rate limit | irrelevante | cresce com adoção; risco real de 429 em deploy |
| Remoção de comando | 1 operação | precisa varrer todas as guilds; sobras duplicam o global |
| Contextos DM / user-install | suportado | não suportado |

A latência de propagação é o único ponto a favor do modelo por guild, e ela afeta apenas **mudanças na definição** do comando — não a disponibilidade do bot em uma guild nova. É um custo de deploy, absorvido pelo mantenedor uma vez por release. O modelo por guild transfere esse custo para um problema de **consistência distribuída entre N guilds**, com um modo de falha silencioso (guild que entrou durante um downtime nunca recebe comandos) que contradiz diretamente o critério "guild nova opera sem intervenção técnica" (§9, Fase 1).

### Consequências obrigatórias

1. **Nenhuma definição de comando pode depender de dados de uma guild.** Um comando global tem uma definição única para todas. Valores por guild — jogos cadastrados, canais, cargos — **só podem aparecer via autocomplete**, resolvido em runtime com o `guildId` da interação. Nada de `addChoices` construído a partir do banco. Esta é a restrição de desenho mais impactante deste ADR e precisa ser respeitada por toda story que adicionar comando.
2. **`GUILD_ID` deixa de ser variável obrigatória.** `src/deploy-commands.ts` passa a registrar global; `DEV_GUILD_ID` é opcional e só vale fora de produção.
3. **Registrar apenas quando a definição mudar.** Persistir um hash do payload de comandos e executar o `PUT` só na mudança. Sem isso, um container em crash-loop dispara um `PUT` por reinício e entra em rate limit.
4. **Módulo desligado ≠ comando ausente.** Como a definição é global, comandos de módulos opcionais existem em todas as guilds. O gate é em **execução**: responder de forma efêmera e acionável ("este recurso não está habilitado neste servidor; peça a um administrador para ativar em `/config modules`"). Isso é coerente com §5.3 (configuração começa desligada).
5. **`setDefaultMemberPermissions` e `setDMPermission(false)`** em todo comando administrativo. É defesa em profundidade de UX — a autorização autoritativa continua sendo a do ADR-003, avaliada no servidor.
6. **Limpeza única na migração:** ao adotar global, os comandos de guild já registrados na SubaruShogun precisam ser removidos com um `PUT` de array vazio naquela guild, senão o usuário vê cada comando duplicado.

---

## ADR-006 — Credenciais Twitch por guild

**Contexto:** Gap 2 da issue #9 e issue #2 / Story 1.7. Decisão de produto já confirmada: cada guild tem seu próprio app Twitch, com `clientId` **e** `clientSecret` próprios.

### Vulnerabilidade atual que esta decisão fecha

`src/services/twitchConfig.ts` lê `clientId` do banco **por guild** e o `clientSecret` de `process.env.TWITCH_CLIENT_SECRET`, **global da instalação**. Isso emparelha o `clientId` de qualquer guild com o secret do operador. O resultado prático é um par de credenciais inválido (falha silenciosa da integração) e, conceitualmente, um vazamento de fronteira: um segredo do operador é usado em nome de uma guild de terceiro. Além disso, o fallback global é exatamente o "fallback silencioso" que §4 da arquitetura proíbe. **O fallback de ambiente deve ser removido, não mantido como default.**

### Decisão

**`clientSecret` persistido por guild no PostgreSQL, cifrado com AES-256-GCM, chave mestra do operador em variável de ambiente, com versionamento de chave.**

Isto **supersede** a recomendação de `ARCHITECTURE_UNIVERSAL_BOT.md` §4 ("secret somente no runtime/secret manager") e §11 ("sem secret no banco"): aquele texto pressupunha um único secret do operador. Com credenciais por guild, o secret é um dado de configuração da guild e não pode viver no ambiente do processo sem reintroduzir a configuração por env var por guild, que §6 proíbe explicitamente.

### Desenho

- **Cifra:** AES-256-GCM (autenticada). IV de 96 bits aleatório por operação de escrita, nunca reutilizado.
- **Chave mestra:** `SECRETS_MASTER_KEY`, 32 bytes em base64, exclusivamente em variável de ambiente do runtime. Nunca no banco, nunca em log, nunca no repositório.
- **AAD (dados adicionais autenticados):** `"{guildId}|twitch.clientSecret|v{keyVersion}"`. Consequência de isolamento: um ciphertext copiado para a linha de outra guild, ou para outro campo, **falha na decifragem** em vez de decifrar silenciosamente. A fronteira multi-guild passa a ser garantida pela criptografia, não só pela query.
- **Versionamento:** `keyVersion` por linha permite rotação da chave mestra sem downtime (decifra com a versão antiga, recifra com a nova).

**Mudança de schema necessária (descrita, não aplicada — executar em Story 1.7 via @data-engineer):** em `TwitchConfig`, adicionar `clientSecretCiphertext Bytes?`, `clientSecretIv Bytes?`, `clientSecretAuthTag Bytes?`, `clientSecretKeyVersion Int?`, `clientSecretUpdatedAt DateTime?`, `clientSecretUpdatedBy String?`. Nenhuma coluna de secret em claro. Não reaproveitar `clientId` para nada além do que já é.

### Impacto em `resolveTwitchConfig` e `TwitchMonitorService`

| Item | Hoje | Alvo |
| --- | --- | --- |
| `resolveTwitchConfig` | síncrona na leitura do secret, via `process.env` | assíncrona, decifra por guild; **sem fallback de ambiente**; retorna `null` se a guild não tem secret |
| Tipo de retorno | espalha o secret em claro em `ResolvedTwitchConfig` | secret não trafega junto da config; é obtido sob demanda por uma porta dedicada e mantido apenas no escopo da chamada de auth |
| Token de app | implícito/compartilhado | cache de token **por `guildId`**, com expiração, backoff e circuit breaker independentes. Um token jamais é reutilizado entre guilds |
| Falha da Twitch | — | isolada por guild; **nunca** pode bloquear criar/entrar/encerrar squad (§4, módulo opcional) |
| Exposição | `/config show`, logs, mensagens de erro | secret sempre mascarado (`****`); proibido em audit `details`, em erro do SDK e em `/config show` |
| Coleta | opção de slash command | **DM efêmera** ou modal com resposta efêmera (issue #9); o valor nunca é ecoado de volta nem aparece em canal público ou log de comando |
| Startup | — | self-check: se existe ciphertext e `SECRETS_MASTER_KEY` está ausente, **falhar alto** com mensagem clara, nunca desabilitar a integração em silêncio |
| Operação | — | comandos de rotação e de revogação do secret da guild, ambos auditados (sem valor) |

### Alternativas rejeitadas

| Alternativa | Por que foi rejeitada |
| --- | --- |
| Secret manager externo (Vault, AWS SM) | Tecnicamente superior e é o alvo da Fase 4. Adiciona hoje uma dependência operacional que o deploy atual (VPS única, Docker Compose) não tem, e atrasa a Fase 3 sem reduzir risco de forma proporcional. O desenho com `keyVersion` e AAD permite migrar depois sem mudar o modelo de dados. |
| Env var por guild | Viola §6 ("o administrador não deve editar código, schema ou arquivo de ambiente") e não escala além de um punhado de guilds. |
| Guardar hash do secret | Impossível: o secret precisa ser reapresentado à Twitch, é reversível por necessidade. |
| Manter o secret global do operador | É o estado atual e é justamente o defeito: acopla todas as guilds à conta Twitch do mantenedor, contra decisão de produto confirmada. |

---

## Decisões humanas e pendências do proprietário

As decisões humanas são mantidas em [`docs/human_decisions/README.md`](human_decisions/README.md). As decisões 001–004 foram aprovadas: 001 aprova a política geral de sobrevivência da auditoria, mas deixa prazos numéricos de retenção pendentes; 002 aprova acesso opt-in da staff a texto e voz dentro da mesma guild; 003 aprova capabilities nomeadas por cargo/guild; 004 aprova cutover após ensaio completo em cópia e aceite, com reset total e fallback compactado por sete dias. A execução permanece condicionada às evidências e ao checklist operacional descritos na Decisão 004.
