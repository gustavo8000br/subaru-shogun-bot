# Changelog

Todas as mudanças relevantes do ShogunBot são documentadas neste arquivo.

## [2.2.0] - 2026-08-27

### Modificado

- Versão completa estabelecida como `v2.2.0-1cddaad-alpha`, com `alpha` como estágio atual.

### Corrigido

- Adicionada reconciliação versionada e idempotente para instalações PostgreSQL legadas sem histórico Prisma, com instruções de backup e baseline antes do deploy.
- O `clientSecret` legado é removido sem ser selecionado ou exposto; as credenciais Twitch continuam somente no ambiente/runtime.

## [2.1.0] - 2026-08-27

### Modificado

- Versão completa estabelecida como `v2.1.0-2105fef-alpha`, com `alpha` como estágio atual.
- Política normativa de versionamento adicionada em `VERSIONING.md`.

### Decisão de versão

- Bump `minor` escolhido porque esta release consolida funcionalidades compatíveis de Discord/criação dinâmica e melhorias operacionais de deploy; o hash `2105fef` identifica o commit de origem.

### Corrigido

- Criação dinâmica agora reconhece `➕ · Criar Squad` e `SQUADS_CREATE_VOICE_CHANNEL_ID`, localiza `⚔️ │ SQUADS TEMPORÁRIAS` por nome ou `SQUADS_CATEGORY_ID`, cria os canais com os nomes definidos, move o criador e remove a squad ao sair o último usuário.
- Estrutura da guild SubaruShogun organizada sem apagar conteúdo: categorias e canais equivalentes foram renomeados/movidos, o AFK nativo foi configurado com timeout de 900 segundos e os lobbies passaram a usar os nomes oficiais.
- Deploy existente agora prepara temporariamente as variáveis PostgreSQL ausentes a partir da `DATABASE_URL`, sem defaults de senha no Compose e sem alterar o volume atual.
- Bootstrap do deploy não depende mais de Node.js instalado no host; Docker Compose continua sendo o único runtime necessário na VPS.

### Configuração

- IDs estratégicos documentados em `SQUADS_CATEGORY_ID`, `SQUADS_CREATE_VOICE_CHANNEL_ID`, `SQUADS_CREATE_TEXT_CHANNEL_ID`, `LIVE_AGORA_CHANNEL_ID` e `CHAT_LIVE_CHANNEL_ID`; nenhum secret é incluído.

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
