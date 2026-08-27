# Changelog

Todas as mudanças relevantes do ShogunBot são documentadas neste arquivo.

## Não lançado

### Corrigido

- Deploy existente agora prepara temporariamente as variáveis PostgreSQL ausentes a partir da `DATABASE_URL`, sem defaults de senha no Compose e sem alterar o volume atual.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.0.0] - 2026-08-27

### Segurança

- Adicionada proteção do contexto Docker contra arquivos de ambiente, chaves e logs.
- Componentes Discord passaram a exigir autorização, guild correta e expiração; votos e compras são idempotentes/transacionais.
- Segredos Twitch passaram a ser fornecidos somente pelo ambiente/runtime.
- Relay Twitch, denúncias, lembretes e anúncios neutralizam menções e limitam conteúdo externo.
- Deploy passou a aplicar migrações Prisma versionadas e o Compose usa rede interna e healthcheck.

### Modificado

- Versão do projeto atualizada para `2.0.0` em `package.json`, `package-lock.json` e no runtime do bot.

## [1.2.0] - 2026-08-27

### Adicionado

- Comando `/versao` para administradores consultarem a versão atual em resposta privada.

### Modificado

- Versão do projeto atualizada para `1.2.0` em `package.json`, `package-lock.json` e no runtime do bot.

### Corrigido

- Restringida a consulta de versão a membros com permissão de administrador.

## [1.0.0] - 2026-08-27

### Adicionado

- Squads temporárias com canais de texto e voz.
- Economia por tempo de voz com Shogun Coins.
- Loja com cargos cosméticos e itens de squad.
- Perfis com elos por jogo e filtros de entrada.
- Reputação pós-partida com GG/Honor.
- Blacklist por squad e auditoria de moderação.
- Leaderboard de voz, moedas e reputação.
- Agendamento de squads, Eventos Oficiais do Discord e confirmação de presença.
- Integração Twitch para chat espelhado e avisos de live.
- Documentação de uso em `docs/USER_GUIDE.md`.

### Modificado

- O registro de comandos slash passou a reunir os fluxos administrativos, de squad, economia, perfil e eventos.
- O banco passou a armazenar perfis, sessões de voz, inventário, reputação, auditoria e eventos agendados.

### Corrigido

- Entradas em squads agora recusam usuários banidos ou fora do intervalo de elo configurado.
- Sessões de voz são finalizadas quando o usuário deixa a sala ou quando a squad é removida.
