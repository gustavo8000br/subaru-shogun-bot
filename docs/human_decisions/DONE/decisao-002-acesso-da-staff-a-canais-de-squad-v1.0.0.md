# Decisão 002 — Acesso da staff aos canais de squad

**Estado:** APROVADA

**Versão:** v1.0.0

**Relacionada:** Story 0.3, Story 1.4, ADR-003, issues #6 e #9

## O que precisa ser decidido

Qual acesso os cargos de staff configurados pela guild devem ter aos canais de texto e voz das squads das quais não são membros?

## Recomendação

Manter a visibilidade de texto e voz desligada por padrão e permitir que cada guild ative separadamente o acesso que deseja. Esta é a recomendação de privacidade do Architect registrada no ADR-003; a escolha final pertence ao proprietário do produto.

## Alternativas

- Acesso de staff sempre habilitado: facilita moderação, mas expõe conversas e voz privadas por padrão.
- Acesso de staff sempre negado: maximiza privacidade, mas impede intervenção direta nos canais.
- Acesso opt-in por guild, com texto e voz configuráveis separadamente: recomendado; mantém escolha explícita e menor privilégio.

## Impacto da aprovação

Determina os overwrites e as opções de setup/configuração da guild. Não concede capacidades administrativas por si só; cada ação continua sujeita às capabilities e verificações do ADR-003.

## Aprovação do proprietário

**Escolha:** [X] Aprovar recomendação [ ] Rejeitar [ ] Solicitar alteração

**Staff pode ver texto de squads alheias?** [X] Sim, opt-in (somente dentro da mesma guild Discord) [ ] Não

**Staff pode conectar na voz de squads alheias?** [X] Sim, opt-in (somente dentro da mesma guild Discord) [ ] Não

**Observações:** Aprovado o acesso opt-in separado por guild; staff de outra guild não recebe acesso.
