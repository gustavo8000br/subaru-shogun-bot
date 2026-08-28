# SubaruShogun ShogunBot

Bot Discord do servidor SubaruShogun, responsável por squads temporárias, LFG com filtros de elo, economia por participação em voz, reputação, eventos agendados e integração com Twitch.

Versão atual: `v2.2.1-86287a2-alpha`.

O versionamento segue a política em [VERSIONING.md](VERSIONING.md). Antes de cada commit, atualize a versão completa, os espelhos e o changelog conforme essa política.

A documentação de uso para membros e staff está em [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Arquitetura e tecnologias

- **Node.js 24**: runtime da aplicação.
- **TypeScript**: código com tipagem estrita e módulos ESM.
- **Discord.js 14**: comandos slash, eventos, canais, componentes e eventos oficiais do Discord.
- **Prisma ORM**: acesso tipado ao banco e modelagem de dados.
- **PostgreSQL 16**: persistência de perfis, sessões, squads, economia, reputação e auditoria.
- **Docker Compose**: execução local e implantação do bot com PostgreSQL.
- **tmi.js**: conexão com o chat da Twitch.

A aplicação inicializa os serviços em `src/bot.ts`. O gerenciamento do ciclo de vida das squads fica em `src/squadManager.ts`; comandos administrativos e de usuário ficam em `src/commands/adminCommands.ts`; integrações ficam em `src/services/`.

## Estrutura Discord

Na guild SubaruShogun (`1229598456872570900`), a organização operacional é:

- `📌 │ INFORMAÇÕES`: `👋 · boas-vindas`, `📜 · regras`, `📢 · avisos`, `🎭 · cargos`, `🔗 · links-uteis`;
- `💬 │ COMUNIDADE`: `💬 · chat-geral`, `📸 · prints-e-clipes`, `🤖 · comandos`, `🎮 · games`, `🎵 · musica`;
- `📺 │ TWITCH`: `🔴 · live-agora`, `🟣 · chat-live`, `🎬 · clips`;
- `⚔️ │ SQUADS TEMPORÁRIAS`: `🛠️ · criar-squad`, `➕ · Criar Squad`;
- `🎮 │ LOBBIES (Voz Pública)`: `🔊 · Resenha Geral`, `🎲 · Outros Jogos`, `🌌 · Genshin Impact`, `⚙️ · Arknights: Endfield`, `🔥 · Diablo IV`, `💀 · Diablo III`, `⛏️ · Minecraft`, `🪓 · Terraria`, `💤 · AFK (Sem áudio)`;
- `🛠️ │ SUPORTE`: `🎟️ · tickets`, `❓ · faq`;
- `👑 │ STAFF (Privado)`: `💬 · staff-chat`, `📋 · logs`, `🚨 · moderacao`.

O servidor usa `💤 · AFK (Sem áudio)` como canal AFK nativo com timeout de 900 segundos. Os IDs estratégicos ficam no ambiente local: `SQUADS_CATEGORY_ID`, `SQUADS_CREATE_VOICE_CHANNEL_ID`, `SQUADS_CREATE_TEXT_CHANNEL_ID`, `LIVE_AGORA_CHANNEL_ID` e `CHAT_LIVE_CHANNEL_ID`. Não versione `.env` nem credenciais.

## Instalação local

### Pré-requisitos

- Node.js 24 ou compatível com ES2022;
- Docker Desktop com Docker Compose;
- uma aplicação Discord com token e ID;
- um banco PostgreSQL, local ou fornecido pelo Compose;
- credenciais Twitch, caso a integração seja utilizada.

### Setup

```bash
git clone <url-do-repositorio>
cd subaru-shogun-bot
npm ci
copy .env.example .env
```

No macOS/Linux, use `cp .env.example .env` no lugar de `copy`. Preencha no `.env` as credenciais Discord, os IDs dos canais e a `DATABASE_URL`. Para criação dinâmica, configure `SQUADS_CREATE_VOICE_CHANNEL_ID` ou use o nome exato `➕ · Criar Squad`. A categoria é localizada por `SQUADS_CATEGORY_ID` ou pelo nome `⚔️ │ SQUADS TEMPORÁRIAS`; o bot cria `🔊 · Squad de [NomeUsuario]` e `💬 · squad-de-[NomeUsuario]`, move o membro e apaga ambos quando ficam vazios. As variáveis de economia, Twitch e auditoria estão documentadas em [.env.example](.env.example).

Suba o PostgreSQL pelo Docker:

```bash
docker compose up -d db
```

O serviço `app` usa DNS explícito `1.1.1.1`, `1.0.0.1` e `8.8.8.8`. Para uma recuperação local completa, com o `.env` válido presente, execute `docker compose down -v && docker network prune -f && docker volume prune -f` somente neste projeto e depois recrie os serviços.

Gere o cliente Prisma e aplique o schema:

```bash
npm run db:generate
npm run db:migrate:deploy
```

Registre os comandos slash na guild configurada:

```bash
npm run deploy:commands
```

Execute o bot em desenvolvimento:

```bash
npm run dev
```

Para executar o build de produção localmente:

```bash
npm run build
npm start
```

O fluxo automatizado de implantação está em `deploy.sh` e usa `docker compose` para construir a aplicação, aplicar migrações versionadas e registrar os comandos. O script usa apenas Bash no host para preparar um arquivo temporário, sem exibir valores, preenchendo `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` ausentes a partir da `DATABASE_URL` interna já configurada; Node.js não é necessário na VPS. O arquivo é removido ao terminar; não coloque segredos no repositório.

Em uma instalação existente sem essas três variáveis no `.env`, confirme operacionalmente que `DATABASE_URL` continua usando o usuário legado, o banco `subaru_shogun`, a porta `5432` e o host interno `db`; preserve a senha existente sem registrá-la. Em seguida, faça um backup e registre o baseline uma única vez antes de executar `./deploy.sh`:

```bash
docker exec subaru-shogun-db sh -c 'pg_dump --format=custom -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backup-pre-migration-$(date +%Y%m%d%H%M%S).dump"
compose_env="$(mktemp)"; trap 'rm -f "$compose_env"' EXIT
bash scripts/bootstrap-compose-env.sh "$compose_env"
docker compose --env-file "$compose_env" build app
docker compose --env-file "$compose_env" run --rm --no-deps app npx prisma migrate resolve --applied 20260827_000000_legacy_baseline
./deploy.sh
```

O primeiro comando grava somente o dump binário local e não imprime a URL ou a senha. O baseline é apenas um marcador do schema legado; a migration seguinte reconcilia colunas, índices e tabelas sem resetar ou apagar dados. Ela preenche `guildId` legado com `legacy`, remove apenas o índice global substituído e remove o `clientSecret` legado sem ler, imprimir ou copiar seu valor. Antes do deploy, rotacione/reconfigure `TWITCH_CLIENT_SECRET` no ambiente/runtime; nunca registre o segredo. Se a URL não estiver disponível ou não usar o host interno `db`, interrompa o deploy e corrija o ambiente manualmente. O bootstrap não remove volumes, não executa `down` e não altera credenciais de um volume PostgreSQL já inicializado.

As credenciais Twitch não são armazenadas no banco: `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` devem permanecer somente no ambiente/runtime. A configuração `/twitch config credentials` salva apenas o Client ID.

## Como contribuir

1. Crie uma branch a partir de `main`.
2. Faça uma alteração pequena e focada, preservando os padrões existentes.
3. Atualize testes e documentação quando o comportamento mudar.
4. Execute `npm run build` e as validações relevantes do Prisma.
5. Abra um Pull Request descrevendo o problema, a solução e como validar.
6. Aguarde revisão antes do merge; não faça commit diretamente em `main`.

Mudanças que alterem schema devem incluir a atualização do Prisma e explicar o impacto de dados no Pull Request. Segredos e arquivos `.env` nunca devem ser commitados. A versão publicada deve ser atualizada em `package.json`, `package-lock.json` e `src/version.ts`.

## Padrões de commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` para funcionalidade;
- `fix:` para correção;
- `docs:` para documentação;
- `refactor:` para refatoração sem mudança de comportamento;
- `chore:` para manutenção e tooling;
- `test:` para testes.

Exemplo: `feat: adicionar filtro de elo nas squads`.

## Links rápidos

- [Guia de uso](docs/USER_GUIDE.md)
- [Histórico de mudanças](CHANGELOG.md)
- [Variáveis de ambiente](.env.example)
- [Schema Prisma](prisma/schema.prisma)
