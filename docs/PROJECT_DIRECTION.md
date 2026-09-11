# Direção de Produto do ShogunBot

**Data:** 2026-09-03  
**Status:** Direção proposta para validação do PO e do Architect

## 1. Visão

Transformar o ShogunBot em um bot Discord universal para comunidades que jogam juntas: instalável em qualquer servidor, configurável pelo dono e pela equipe autorizada dentro do Discord, e útil sem depender de ajustes manuais no código ou em variáveis de ambiente para cada guild.

O ShogunBot deve ajudar uma comunidade a:

- encontrar pessoas para jogar;
- criar e encerrar salas temporárias sem trabalho manual;
- organizar eventos e acompanhar participação;
- reconhecer bons companheiros de equipe;
- oferecer recompensas opcionais à comunidade;
- manter tudo isolado, compreensível e sob controle do dono do servidor.

O produto não deve pressupor a estrutura, os jogos, os nomes de canais ou a cultura da SubaruShogun. A SubaruShogun continua sendo a primeira referência de uso, mas deixa de ser uma dependência do produto.

## 2. Problema que vamos resolver

Hoje o bot funciona como uma instalação dedicada. A operação depende de uma guild principal, nomes e IDs de canais, variáveis de ambiente e decisões embutidas no comportamento atual. Isso dificulta três coisas:

1. instalar o bot em outro servidor;
2. entender e alterar a configuração sem acesso técnico;
3. garantir que dados, permissões, economia e reputação de uma guild nunca vazem para outra.

O backlog atual confirma a necessidade de robustez antes de expansão: há riscos de concorrência, canais órfãos, lifecycle pouco formalizado, permissões de squads, UX de reputação e escopo multi-guild ainda a decidir.

## 3. Posicionamento e público inicial

### Público primário

Donos e administradores de servidores Discord pequenos e médios, especialmente comunidades de jogos que querem organizar partidas sem manter uma equipe técnica.

### Usuário secundário

Membros da comunidade que entram, criam ou participam de squads, confirmam eventos e usam recompensas.

### Promessa do produto

“Instale, responda a algumas perguntas no Discord e deixe a comunidade encontrar gente para jogar.”

## 4. Escopo do produto

### Núcleo universal

O primeiro produto universal deve incluir:

- instalação e ativação em uma guild;
- configuração guiada pelo dono ou administradores autorizados;
- cadastro de jogos, nomes e regras de matchmaking da guild;
- criação de squads temporárias por comando e, quando configurado, por entrada em canal de voz;
- limite de membros e de squads por jogo, configurável por guild;
- painel da squad para proprietário, membros e staff, com permissões separadas;
- lifecycle previsível: criação, entrada, saída, encerramento, expiração e recuperação após reinício;
- eventos/agendamentos de partidas;
- perfil de jogo e reputação, sempre dentro do escopo definido para a guild;
- denúncias e trilha de auditoria para a equipe;
- mensagens seguras, sem menções abusivas e com limites claros;
- ajuda, status e diagnóstico acessíveis pelo Discord.

### Módulos opcionais

Os módulos abaixo devem poder ser ativados por guild, sem obrigar todas as comunidades a usá-los:

- Twitch: anúncios, chat espelhado e recompensas de subs/cheers;
- economia: moedas, loja e itens;
- leaderboards;
- eventos oficiais do Discord;
- criação automática de canais e cargos;
- políticas avançadas de elo e elegibilidade.

O bot deve ter uma experiência funcional sem Twitch e sem economia. Integrações externas nunca podem ser requisito para o núcleo de squads.

### Fora do escopo inicial

- painel web obrigatório;
- marketplace ou assinatura antes de provar adoção;
- suporte a outras plataformas além do Discord;
- arbitragem automática de conflitos entre membros;
- coleta de dados de usuários fora do necessário para o funcionamento da guild;
- customização ilimitada de cada mensagem e regra antes de validar o fluxo principal.

## 5. Princípios de produto

1. **Guild é o contexto padrão.** Jogos, canais, regras, perfis de uso, economia, reputação, cargos e auditoria devem ter uma regra explícita de escopo.
2. **Discord-first para o dono.** O administrador não deve editar código, schema ou arquivo de ambiente para configurar a experiência da sua guild.
3. **Configuração segura por padrão.** Toda configuração começa desativada ou com valores conservadores; o bot explica permissões necessárias antes de criar canais, cargos ou eventos.
4. **Menor privilégio.** O bot pede apenas as permissões necessárias e uma ação de membro nunca concede poder administrativo.
5. **Estado recuperável.** Uma falha, reinício ou intervenção manual não deve deixar a guild em um estado que exija limpeza técnica imediata.
6. **Transparência operacional.** O dono consegue saber o que está ativo, quem pode administrar, quais canais são usados e por que uma squad foi encerrada.
7. **Módulos independentes.** Twitch, economia e rankings podem ser desligados sem quebrar squads e eventos.
8. **Privacidade proporcional.** Guardar apenas o necessário, deixar o escopo visível e oferecer limpeza de dados conforme a política definida.
9. **Valor antes de variedade.** O fluxo de criar uma squad, entrar nela e encerrá-la é a medida principal de qualidade.

## 6. Configuração por guild

### Princípio de configuração

As decisões próprias de uma guild devem ser persistidas por guild e alteráveis por comandos administrativos. Variáveis de ambiente ficam reservadas a segredos e à operação do serviço, como token do bot, conexão de banco e credenciais externas compartilhadas pela instalação.

### Onboarding do dono

Após a instalação, o dono ou administrador autorizado executa `/setup` e passa por um fluxo curto:

1. escolher idioma e fuso horário;
2. escolher os jogos iniciais ou cadastrar um jogo;
3. escolher entre canais existentes ou criação automática de uma área de squads;
4. definir limite de participantes, limite de squads e política de expiração;
5. ativar ou não eventos, economia, reputação, leaderboards e Twitch;
6. revisar permissões e confirmar.

O setup deve ser retomável. `/config status` mostra o que falta e `/config help` explica cada decisão sem exigir conhecimento técnico.

### Áreas configuráveis

- **Squads:** jogos, limites, nome dos canais, categoria, canal de criação e tempo de expiração.
- **Matchmaking:** uso de elo, campos aceitos, faixa mínima/máxima e regra para usuários sem elo.
- **Permissões:** dono, cargos de staff e ações permitidas para proprietário, membro e moderador.
- **Eventos:** canal padrão, antecedência de lembrete e fuso horário.
- **Reputação:** tipos de reconhecimento, janela para votar, elegibilidade e visibilidade.
- **Economia:** ativação, ritmo de recompensa, loja, cargos e limites antiabuso.
- **Twitch:** canal Twitch, canais Discord, anúncios, menções e cargos de recompensa.
- **Auditoria e privacidade:** canal de logs, retenção e comandos de consulta/limpeza.

Cada mudança deve mostrar um resumo antes da confirmação e registrar quem alterou, quando e o que mudou. Segredos não devem ser exibidos em respostas, logs ou resumos.

## 7. Experiência do dono do servidor

### Resultado esperado

Em menos de dez minutos, um dono deve conseguir instalar o bot, configurar uma experiência mínima e testar uma squad sem consultar o código.

### Comandos de administração esperados

Os nomes podem mudar na implementação, mas a experiência deve cobrir:

- `/setup` e `/setup resume`;
- `/config status`, `/config show` e `/config reset`;
- `/config squads`, `/config games`, `/config permissions`;
- `/config modules` para ligar/desligar recursos;
- `/diagnostics` para permissões ausentes, canais inválidos e estado da integração;
- `/audit` para consultar eventos administrativos relevantes.

O dono deve receber respostas claras para quatro situações: configuração salva, configuração incompleta, permissão insuficiente e falha recuperável. Nenhuma dessas situações deve exigir descobrir IDs no painel do Discord como primeiro passo.

### Experiência do membro

O membro deve encontrar uma entrada simples: escolher um jogo, criar ou entrar em uma squad, entender os limites e receber feedback imediato. Menus de reputação devem mostrar nomes amigáveis, não IDs. Ao ser removido ou impedido de entrar, o membro deve saber o motivo sem expor informações privadas.

## 8. Priorização do backlog atual

As issues #1 a #8 continuam válidas, mas deixam de ser o roadmap completo. Elas serão absorvidas assim:

| Prioridade | Issue                  | Decisão de produto                                                                                                                                                        |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0         | #8                     | Definir agora o que é global e o que é por guild. Saldo, reputação, jogos, permissões e auditoria não podem ficar ambíguos.                                               |
| P0         | #3                     | Preservar limites configuráveis por guild mesmo sob operações simultâneas.                                                                                                |
| P0         | #4                     | Tornar Discord e persistência convergentes, com recuperação segura e auditável.                                                                                           |
| P0         | #7                     | Formalizar a política base de atividade, expiração e recuperação após restart. É pré-requisito da Fase 1, não item de evolução.                                          |
| P0         | #6                     | Definir e validar a matriz de permissões dos canais temporários.                                                                                                          |
| P0         | #5                     | Estabelecer o baseline de testes (duas guilds, PostgreSQL real, clock controlado, adapter Discord falso) e fechar a suíte sobre o núcleo implementado. É o gate da Fase 1. |
| P0         | Auditoria de segurança | Tratar achados abertos e risco residual como bloqueadores para distribuição ampla. Especial atenção a dependências, testes de integração, deployment e dados multi-guild. |
| P1         | #1                     | Corrigir a apresentação dos membros na reputação como parte da experiência mínima do membro.                                                                              |
| P1         | #7 (parte configurável) | Mover os timeouts já definidos para configuração por guild depois que o lifecycle base estiver estável. Corresponde à Story 1.6, na Fase 2.                              |
| P2         | #2                     | Entregar recompensas Twitch como módulo opcional, após o núcleo universal e a configuração por guild.                                                                     |

> **Correção de rastreabilidade (2026-09-11, @architect):** a versão anterior desta tabela atribuía a #5 a descrição do lifecycle e rebaixava #7 a P1. A política base de atividade/expiração é da **#7** e é **P0** (bloqueia a Fase 1); apenas a parte configurável por guild é P1 (Story 1.6, Fase 2). A **#5** é o baseline e o fechamento da suíte de testes, e é P0 por ser o gate da Fase 1. A ordem de execução autoritativa está na issue #9.

## 9. Fases de entrega

### Fase 0: Decisões e fundação

**Objetivo:** eliminar ambiguidades que poderiam contaminar todas as guilds.

- validar escopo de perfil, economia, reputação, jogos e auditoria;
- definir matriz de permissões e modelo de administração;
- decidir política de dados, retenção, remoção e migração da instalação atual;
- fechar riscos da auditoria de segurança relevantes para distribuição;
- estabelecer métricas e um ambiente de teste com pelo menos duas guilds.

**Saída:** decisões de PO/Architect aprovadas e backlog técnico pronto para execução.

### Fase 1: Núcleo universal confiável

**Objetivo:** instalar em uma guild nova e operar squads sem configuração manual no código.

- comandos de setup e status;
- configuração por guild para jogos, canais, limites e expiração;
- criação, entrada, saída, painel e encerramento de squads;
- permissões isoladas e verificadas no momento de cada ação;
- rollback/reconciliação e restauração após restart;
- testes de concorrência, isolamento e falhas principais;
- ajuda e diagnóstico básicos.

**Gate:** uma guild nova consegue completar o fluxo principal sem intervenção técnica.

### Fase 2: Comunidade jogável

**Objetivo:** aumentar retenção e organização sem comprometer o núcleo.

- eventos e lembretes configuráveis;
- perfis e filtros de elo;
- reputação com UX amigável e regras por guild;
- leaderboards opcionais;
- denúncias, auditoria e ferramentas de moderação;
- política formal de atividade e expiração configurável.

**Gate:** membros conseguem repetir o fluxo de jogar, avaliar e voltar a encontrar a comunidade.

### Fase 3: Engajamento modular

**Objetivo:** adicionar incentivos e integrações que cada guild escolhe usar.

- economia e loja por guild;
- recompensas Twitch de subs e top bits;
- cargos automáticos e outras integrações;
- limites, rate limits e observabilidade específicos por módulo;
- desligamento e reconfiguração sem perda do núcleo.

**Gate:** módulos podem ser ativados, pausados ou reconfigurados por uma guild sem afetar outra.

### Fase 4: Distribuição e escala

**Objetivo:** tornar a instalação repetível e sustentável em muitas guilds.

- instalação documentada e fluxo de permissões revisado;
- telemetria mínima sem dados sensíveis;
- procedimentos de migração, backup, rollback e rotação de secrets;
- testes em guilds reais autorizadas;
- avaliação de custos, suporte e eventual monetização.

**Gate:** o produto pode ser instalado e operado por terceiros com suporte previsível.

## 10. Critérios de sucesso

### Adoção e ativação

- uma guild nova conclui o setup e cria sua primeira squad em até dez minutos;
- pelo menos 80% das instalações de teste concluem o setup sem intervenção do mantenedor;
- o dono consegue identificar e corrigir uma permissão ou configuração ausente pelo próprio Discord.

### Uso

- membros conseguem criar ou entrar em uma squad em até três interações principais;
- squads expiram ou são encerradas conforme a política, sem canais órfãos recorrentes;
- o fluxo de reputação usa nomes compreensíveis e não exige suporte manual.

### Segurança e confiança

- nenhum dado de uma guild aparece em outra nos testes de isolamento;
- nenhuma ação de membro concede permissão administrativa;
- texto externo não gera menções não autorizadas;
- falhas e mudanças administrativas ficam auditáveis sem secrets;
- os achados críticos e altos da auditoria têm correção ou risco residual explicitamente aceito antes da distribuição ampla.

### Operação

- restart, canal apagado manualmente e falha parcial têm comportamento definido e verificável;
- o bot informa estado saudável e integrações incompletas;
- configurações podem ser alteradas sem redeploy para decisões próprias da guild.

## 11. Riscos de produto

- **Complexidade excessiva no onboarding:** reduzir o primeiro setup ao núcleo e usar módulos opt-in.
- **Permissões assustadoras:** explicar cada permissão e oferecer modo com canais existentes antes da criação automática.
- **Mistura de dados entre guilds:** bloquear a expansão até a regra de escopo e os testes de duas guilds estarem aprovados.
- **Dependência da Twitch:** manter Twitch fora do caminho crítico de squads.
- **Customização sem fim:** começar com opções de alto valor e adiar templates livres de mensagens e layouts.
- **Custo operacional de canais temporários:** permitir limites e política de expiração por guild, com diagnóstico e reconciliação.

## 12. Decisões que precisam de validação

### PO

- O saldo de economia é por guild ou global para um mesmo usuário?
- A reputação é por guild, por comunidade ou pode acompanhar o usuário entre guilds?
- Quais módulos entram no primeiro lançamento universal: eventos, reputação, economia e Twitch?
- Qual é o conjunto mínimo de jogos e configurações no onboarding?
- Qual política de retenção e remoção de dados será apresentada ao dono e aos membros?
- A instalação SubaruShogun deve migrar dados existentes ou iniciar uma nova configuração por guild?
- Quais métricas definem sucesso do primeiro mês: guilds ativadas, squads criadas, membros recorrentes ou outro resultado?

### Architect

- Qual é a fronteira entre segredo de runtime e configuração persistida por guild?
- Qual abordagem garante isolamento de guild em todas as entidades e consultas existentes?
- Como serão tratados migração, compatibilidade e rollback da instalação atual?
- O bot será um único processo multi-guild ou haverá uma instalação por conjunto de guilds?
- Qual matriz mínima de permissões Discord permite o núcleo sem pedir privilégios excessivos?
- Como Discord e persistência serão reconciliados sem apagar recursos desconhecidos?
- Qual estratégia de testes representa concorrência, restart e integração com uma guild real autorizada?

### 12.1 Bloqueios para iniciar a Fase 1

As decisões abaixo precisam de uma resposta registrada antes de transformar a direção em stories de implementação. Os defaults indicados são propostas de PO para reduzir ambiguidade; não são decisão aprovada enquanto PO e Architect não as validarem.

| Decisão                 | Default proposto para validação                                                                                                                                                                                                                                                       | Evidência de pronto                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Escopo dos dados        | Identidade Discord (`discordId`) pode ser global; jogos, saldo, reputação, inventário, elegibilidade, permissões, squads, eventos e auditoria são por guild.                                                                                                                          | Matriz de escopo aprovada e teste com duas guilds sem leitura ou mutação cruzada.                                     |
| Topologia               | Um processo pode atender várias guilds; toda configuração e toda autorização recebem `guildId`; secrets permanecem no runtime da instalação.                                                                                                                                          | Instalação em duas guilds com configurações diferentes e sem IDs fixos da SubaruShogun.                               |
| Primeiro lançamento     | Fase 1 é o núcleo de squads: setup, jogos, canais, limites, permissões, lifecycle, reconciliação, diagnóstico e ajuda. Eventos, reputação, leaderboards, economia e Twitch ficam fora do gate de ativação da Fase 1 e entram somente nas fases indicadas.                             | Guild nova cria, usa e encerra uma squad sem intervenção técnica; módulos adiados não são pré-requisitos.             |
| Limites e lifecycle     | Defaults iniciais são 10 squads por jogo/guild, 15 participantes por squad, 5 minutos para squad vazia e 24 horas sem atividade relevante para squad ocupada; todos são alteráveis por guild. Presença passiva e movimentação de voz sem mudança de composição não renovam atividade. | Política publicada, timers testáveis sem espera real, restart/reconciliação e motivo da expiração auditáveis.         |
| Administração e canais  | Dono e cargos de staff autorizados administram; proprietário administra somente sua squad; membros não bloqueiam, removem ou encerram; `@everyone` não vê áreas privadas; nenhuma ação concede permissões administrativas.                                                            | Matriz de permissões aprovada e validada para líder, membro, staff, usuário externo, saída da guild e perda de cargo. |
| Migração SubaruShogun   | Não migrar automaticamente dados legados para novas guilds. A instalação atual recebe uma migração explícita, com backup, mapeamento de `legacy` e rollback operacional documentado.                                                                                                  | Plano aprovado, pré-condições verificadas e teste de restauração antes da distribuição universal.                     |
| Dados e privacidade     | Retenção, exportação/consulta e remoção por guild precisam de prazo, ator autorizado, efeito em ledger/auditoria e tratamento de pedidos de saída da guild.                                                                                                                           | Política exibida no onboarding e comandos de consulta/limpeza com confirmação e auditoria.                            |
| Segurança de lançamento | Achados críticos/altos e itens parciais da auditoria que afetem distribuição (dependências, autorização, secrets, deploy, integração e isolamento) bloqueiam release até correção ou aceite formal de risco residual.                                                                 | Checklist de release com evidência técnica e aceite nominal para cada exceção.                                        |

### 12.2 Dependências de sequência

1. PO aprova a matriz de escopo, o corte de módulos da Fase 1, a política de dados e a migração.
2. Architect aprova topologia, fronteiras de configuração/runtime, matriz de permissões e estratégia de reconciliação. — **CONCLUÍDO em 2026-09-11.** As decisões estão em [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) (ADR-001 a ADR-006). Vereditos por story: 0.1 GO com condições, 0.2 GO condicionado, 0.3 GO, 0.4 NO-GO até incorporar as emendas registradas na própria story.
3. Só então o trabalho de schema e implementação pode ser quebrado em stories; #8 precede qualquer mudança de persistência, e #3–#6 precedem o gate da Fase 1.
4. #1 pode ser entregue como correção independente de UX. #2 permanece bloqueada até o núcleo universal estar aprovado.

### 12.3 Definições métricas

- **Setup concluído:** `/setup` confirmado, configuração mínima persistida, permissões verificadas e primeira squad criada, tudo dentro de dez minutos.
- **Sem intervenção:** nenhum acesso do mantenedor ao código, banco, ambiente ou painel administrativo do Discord durante o setup; suporte documental conta como intervenção e deve ser medido separadamente.
- **Guild ativa:** guild que concluiu o setup e criou pelo menos uma squad no período medido.
- **Squad órfã recorrente:** recurso Discord sem registro correspondente ou registro sem recurso após a reconciliação, contado por guild e por janela de 24 horas.
- **80% das instalações de teste:** denominador, período, versão do bot e motivo de exclusão definidos antes do experimento; guilds que abandonarem o setup não podem ser removidas do denominador.

## 13. Decisão de rumo

O próximo trabalho de produto deve preparar a Fase 0 e a Fase 1. Não priorizar novas recompensas Twitch ou customizações avançadas antes de resolver escopo multi-guild, configuração por guild, permissões, lifecycle e reconciliação. A proposta de valor universal depende de o dono conseguir operar o bot com segurança e de uma guild não conseguir afetar outra.

**Veredito desta validação:** NO-GO para iniciar a implementação da Fase 1; GO condicionado para executar a Fase 0. O documento fica executável como direção e backlog de decisões, mas a implementação deve aguardar o fechamento dos bloqueios de 12.1 e as aprovações da sequência de 12.2.

**Atualização de 2026-09-11 (@architect):** o item 2 da sequência de 12.2 está fechado — topologia, fronteira configuração/runtime, concorrência, reconciliação, permissões, lifecycle, registro de comandos e credenciais Twitch estão decididos em [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md). O veredito de Fase 1 continua **NO-GO** até que (a) o PO registre sua aprovação do item 1 de 12.2, (b) a Story 0.4 incorpore as emendas apontadas pelo Architect e (c) a Story 0.5 entregue o baseline de testes. Seis decisões de produto seguem abertas e estão listadas ao final do ADR.

Este documento define direção e prioridades. Ele não substitui a validação do PO, as decisões arquiteturais nem as stories de implementação.
