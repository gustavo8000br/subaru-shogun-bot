# SubaruShogun ShogunBot

Bot Discord do servidor SubaruShogun, responsável por squads temporárias, LFG com filtros de elo, economia por participação em voz, reputação, eventos agendados e integração com Twitch.

Versão atual: `1.2.0`.

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
npm install
copy .env.example .env
```

No macOS/Linux, use `cp .env.example .env` no lugar de `copy`. Preencha no `.env` as credenciais Discord, os IDs dos canais e a `DATABASE_URL`. As variáveis de economia, Twitch e auditoria estão documentadas em [.env.example](.env.example).

Suba o PostgreSQL pelo Docker:

```bash
docker compose up -d db
```

Gere o cliente Prisma e aplique o schema:

```bash
npm run db:generate
npm run db:push
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

O fluxo automatizado de implantação está em `deploy.sh` e usa `docker compose` para construir a aplicação, atualizar o schema e registrar os comandos.

## Como contribuir

1. Crie uma branch a partir de `main`.
2. Faça uma alteração pequena e focada, preservando os padrões existentes.
3. Atualize testes e documentação quando o comportamento mudar.
4. Execute `npm run build` e as validações relevantes do Prisma.
5. Abra um Pull Request descrevendo o problema, a solução e como validar.
6. Aguarde revisão antes do merge; não faça commit diretamente em `main`.

Mudanças que alterem schema devem incluir a atualização do Prisma e explicar o impacto de dados no Pull Request. Segredos e arquivos `.env` nunca devem ser commitados.

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
