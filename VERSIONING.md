# Versionamento do ShogunBot

Este documento define o versionamento do ShogunBot e é a referência para releases, commits e deploys.

## Formato

```text
vMAJOR.MINOR.PATCH-HHHHHHH-STAGE
```

Exemplo: `v2.0.0-c7a3560-alpha`.

Os componentes `MAJOR`, `MINOR` e `PATCH` formam o núcleo SemVer. O terceiro componente é `PATCH`.

O hash `HHHHHHH` é exatamente o SHA curto de sete caracteres do commit de origem usado para preparar a release. `STAGE` deve ser um destes valores: `alpha`, `beta`, `rc` ou `stable`.

## Onde a versão vive

| Arquivo | Conteúdo |
| --- | --- |
| `VERSION` | String completa canônica, incluindo `v`, hash e estágio. |
| `.release-stage` | Somente o estágio atual. |
| `package.json` | Apenas o núcleo SemVer consumido pelo npm. |
| `package-lock.json` | Espelho do núcleo SemVer. |
| `src/version.ts` | String completa exibida pelo bot. |
| `CHANGELOG.md` | Notas da versão e commits promovidos. |

## Regra antes do commit

O bump de versão deve acontecer **antes de cada commit**. O bump deve estar no mesmo commit da alteração correspondente; não é permitido criar um commit de código com manifests, runtime e changelog divergentes.

1. Escolha `major`, `minor` ou `patch` conforme o impacto real da mudança.
2. Atualize `VERSION` usando o hash de origem correto.
3. Atualize `.release-stage` apenas quando o estágio humano mudar.
4. Sincronize `package.json`, `package-lock.json` e `src/version.ts`.
5. Adicione a entrada correspondente no `CHANGELOG.md`.
6. Atualize `README.md` e `docs/USER_GUIDE.md` quando houver impacto de setup ou uso.
7. Execute testes, build e validações antes do commit.

O tipo do Conventional Commit não determina sozinho o nível da versão: uma correção ampla pode ser `minor`, enquanto uma alteração pontual pode ser `patch`.

## Estágios

`alpha` é o estágio atual e indica sistema em construção. A progressão para `beta`, `rc` ou `stable` é uma decisão manual; nenhuma automação pode promover o estágio sem decisão explícita.

## Tags e releases

Tags de release devem usar o conteúdo de `VERSION` literalmente, por exemplo `v2.0.0-c7a3560-alpha`. O núcleo em `package.json` permanece `2.0.0`, sem hash ou estágio, para manter compatibilidade com ferramentas npm.