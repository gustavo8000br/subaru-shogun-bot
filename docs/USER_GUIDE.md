# Guia do Usuário

Guia para membros e staff do servidor SubaruShogun.

## Gerenciamento de Squads e LFG

### Criar uma sala

Há duas formas de iniciar uma squad:

- Entre em um canal de lobby de jogo configurado. O ShogunBot cria uma sala temporária e move você para ela.
- Use `/squad create` e informe `game`. Opcionalmente, defina `min_rank` e `max_rank` para restringir o elo dos participantes.

Para consultar e administrar a squad atual, use `/squad panel`. O painel permite bloquear a sala, remover membros, renomear a squad e encerrá-la.

Ao entrar em uma squad com restrição de elo, o bot verifica o elo cadastrado no seu perfil. Usuários sem o elo adequado são removidos da sala. O líder também pode usar `/squad ban user:@membro` para impedir a reentrada de uma pessoa naquela sala.

As squads temporárias são removidas quando ficam vazias por tempo suficiente ou quando expiram por inatividade.

## Integração Twitch

A configuração exige permissão de administrador:

1. Mantenha `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` no ambiente/runtime e use `/twitch config credentials` somente com o `client_id`. O segredo nunca é salvo no banco.
2. Use `/twitch config channel` com o nome do canal Twitch.
3. Use `/twitch config setup` e selecione o canal Discord para espelhar o chat e o canal para avisos de live.

Depois da configuração, o bot reconecta os serviços e publica avisos no canal definido. Para limpar o histórico do chat espelhado, a staff deve apagar as mensagens no canal Discord configurado, respeitando as permissões e a política de retenção do servidor.

## Economia e Loja

Enquanto participa de uma squad em voz, você recebe Shogun Coins em intervalos configurados pelo servidor. O bot não recompensa usuários mutados ou ensurdecidos, nem salas vazias.

- `/balance`: consulta seu saldo atual.
- `/shop`: lista os itens disponíveis e seus preços.
- `/buy item_id:<id>`: resgata um item quando houver saldo suficiente.

Os itens podem incluir cargo cosmético, cor de chat, slot extra e emoji extra de squad. O cargo cosmético é aplicado automaticamente quando configurado pela staff.

## Perfil e Reputação

Cadastre o elo de cada jogo antes de entrar em squads com filtro:

`/profile set-rank game:<jogo> rank:<elo>`

Ao encerrar uma squad, os participantes recebem uma mensagem privada para escolher um colega e conceder GG/Honor. Cada reconhecimento aumenta a reputação do membro avaliado.

## Agendamento e Eventos

Use `/squad schedule` com `game`, `time`, `title` e `channel`. Os campos `min_rank` e `max_rank` são opcionais.

O bot registra a sessão e cria um Evento Oficial do Discord. Na mensagem publicada, clique em **Confirmar Presença**. Os inscritos recebem uma notificação no canal do evento 15 minutos antes do início.

Informe `time` como data ISO futura, por exemplo: `2026-09-01T20:00:00Z`.

## Leaderboards

Use `/top categoria:<categoria>` para consultar os dez melhores colocados. As categorias são:

- `voice`: mais tempo em voz;
- `coins`: maior saldo de Shogun Coins;
- `reputation`: maior reputação e quantidade de GGs.

Os rankings são apresentados em formato de embed e podem ser consultados por qualquer membro.

## Denúncias

Use `/report user:@membro reason:<motivo>` para enviar uma denúncia à staff. O registro é salvo na auditoria do bot e encaminhado ao canal de staff configurado.

## Versão do Bot

Administradores podem usar `/versao` para consultar a versão instalada do ShogunBot. A resposta é privada e só aparece para quem solicitou o comando. A versão desta release é `2.0.0`.
