# Relatório do marco M2

- Data: 2026-10-31 22:49
- Passos concluídos: 13
- Tag git: `marco-M2`
- Verificações (`format:check`, `lint`, `typecheck`, `test`): **passaram** no fechamento do marco

## Passos e commits

- `3707f45` M2.1 IDs e erros
- `355a193` M2.2 Estado da tarefa
- `c1e1bc7` M2.3 Dinheiro e horas
- `5983353` M2.4 Datas
- `621fe18` M2.5 Chamado e papéis
- `3c94f8f` M2.6 Organização, usuário, entidade, projeto
- `4266ee2` M2.7 Tarefa e envolvimento
- `2d76ac4` M2.8 Eventos e agendamento
- `99fb4f1` M2.9 Ator e política de acesso
- `fa00c2b` M2.10 Custo e prazo
- `408e7fc` M2.11 Linha do tempo
- `0190443` M2.12 Dashboard
- `39d4f28` M2.13 Fechamento do core

## Testes

```
[2m Test Files [22m [1m[32m18 passed[39m[22m[90m (18)[39m
[2m      Tests [22m [1m[32m529 passed[39m[22m[90m (529)[39m
```

## Cobertura

```
[34m % [39m[2mCoverage report from [22m[33mv8[39m
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.92 |    92.72 |     100 |   99.58 |
 application/src   |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 contract/src      |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 core/src          |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 core/src/entities |   98.43 |    88.46 |     100 |   98.27 |
  contributor.ts   |     100 |    83.33 |     100 |     100 | 26
  meeting.ts       |     100 |      100 |     100 |     100 |
  organization.ts  |     100 |      100 |     100 |     100 |
  participation.ts |    87.5 |     87.5 |     100 |    87.5 | 24
  project.ts       |     100 |      100 |     100 |     100 |
  task.ts          |     100 |    86.66 |     100 |     100 | 99-101
  ...line-event.ts |     100 |      100 |     100 |     100 |
  user.ts          |     100 |      100 |     100 |     100 |
  validation.ts    |     100 |      100 |     100 |     100 |
 core/src/policies |     100 |      100 |     100 |     100 |
  access-policy.ts |     100 |      100 |     100 |     100 |
  actor.ts         |       0 |        0 |       0 |       0 |
 core/src/rules    |   98.93 |     90.9 |     100 |     100 |
  cost.ts          |     100 |      100 |     100 |     100 |
  dashboard.ts     |     100 |      100 |     100 |     100 |
  ...line-label.ts |     100 |      100 |     100 |     100 |
  timeline.ts      |   98.07 |    88.13 |     100 |     100 | ...01,108,127-129
 core/src/shared   |     100 |      100 |     100 |     100 |
  errors.ts        |     100 |      100 |     100 |     100 |
  ids.ts           |     100 |      100 |     100 |     100 |
 core/src/values   |   98.75 |    95.08 |     100 |     100 |
  date-only.ts     |   96.77 |    88.88 |     100 |     100 | 15,60-61
  decimal.ts       |     100 |      100 |     100 |     100 |
  hours.ts         |     100 |      100 |     100 |     100 |
  money.ts         |     100 |      100 |     100 |     100 |
  role.ts          |     100 |      100 |     100 |     100 |
  task-status.ts   |     100 |      100 |     100 |     100 |
  ticket.ts        |     100 |      100 |     100 |     100 |
 infra-sqlite/src  |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 ui/src            |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
-------------------|---------|----------|---------|---------|-------------------
```

## Dependências adicionadas neste marco

_nenhuma_

## Arquivos alterados

```
 CLAUDE.md                                        |   2 +-
 PROGRESS.md                                      | 252 ++++++++++++++++++++---
 packages/core/src/entities/contributor.ts        |  31 +++
 packages/core/src/entities/entities.test.ts      |  79 +++++++
 packages/core/src/entities/meeting-event.test.ts |  70 +++++++
 packages/core/src/entities/meeting.ts            |  24 +++
 packages/core/src/entities/organization.ts       |  12 ++
 packages/core/src/entities/participation.ts      |  30 +++
 packages/core/src/entities/project.ts            |  28 +++
 packages/core/src/entities/task.test.ts          | 127 ++++++++++++
 packages/core/src/entities/task.ts               | 136 ++++++++++++
 packages/core/src/entities/timeline-event.ts     |  36 ++++
 packages/core/src/entities/user.ts               |  34 +++
 packages/core/src/entities/validation.ts         |  13 ++
 packages/core/src/index.test.ts                  |  13 ++
 packages/core/src/index.ts                       |  23 ++-
 packages/core/src/policies/access-policy.test.ts | 134 ++++++++++++
 packages/core/src/policies/access-policy.ts      |  63 ++++++
 packages/core/src/policies/actor.ts              |   8 +
 packages/core/src/rules/cost.test.ts             |  35 ++++
 packages/core/src/rules/cost.ts                  |  19 ++
 packages/core/src/rules/dashboard.test.ts        |  81 ++++++++
 packages/core/src/rules/dashboard.ts             |  38 ++++
 packages/core/src/rules/deadline-label.test.ts   |  21 ++
 packages/core/src/rules/deadline-label.ts        |  18 ++
 packages/core/src/rules/timeline.test.ts         | 136 ++++++++++++
 packages/core/src/rules/timeline.ts              | 131 ++++++++++++
 packages/core/src/shared/errors.ts               |  35 ++++
 packages/core/src/shared/ids.test.ts             |   6 +-
 packages/core/src/shared/ids.ts                  |  29 +++
 packages/core/src/values/date-only.test.ts       |  57 +++++
 packages/core/src/values/date-only.ts            |  63 ++++++
 packages/core/src/values/decimal.ts              |  18 ++
 packages/core/src/values/hours.test.ts           |  34 +++
 packages/core/src/values/hours.ts                |  13 ++
 packages/core/src/values/money.test.ts           |  40 ++++
 packages/core/src/values/money.ts                |  21 ++
 packages/core/src/values/role.test.ts            |  34 +++
 packages/core/src/values/role.ts                 |  26 +++
 packages/core/src/values/task-status.test.ts     |  34 +++
 packages/core/src/values/task-status.ts          |  24 +++
 packages/core/src/values/ticket.test.ts          |  24 +++
 packages/core/src/values/ticket.ts               |  27 +++
 scripts/codex-loop/README.md                     | 105 ++++++----
 scripts/codex-loop/docs.sh                       | 118 +++++++++++
 scripts/codex-loop/prompt.md                     |   8 +-
 scripts/codex-loop/regras.md                     |  85 ++++++++
 scripts/codex-loop/run.sh                        |  81 +++++++-
 tooling/eslint-boundaries.test.ts                |   2 +-
 vitest.config.ts                                 |   3 +
 50 files changed, 2395 insertions(+), 86 deletions(-)
```

## Pontos de revisão sugeridos

Pedro revisa a matriz de acesso nos testes do M2.9 e as frases da linha do tempo.

## Notas dos passos (PROGRESS.md)

- [x] M2.1 IDs e erros
  - Notas da rodada: implementados os oito IDs marcados e conversores com validação de ULID, além dos erros tipados com seus quatro códigos. Os testes existentes foram executados antes da implementação e falharam pela ausência dos módulos; corrigido também o tipo auxiliar da tupla de conversores nos testes. Não há falha anterior nem dependência nova. Validação: `pnpm check` passou (formatação, lint, tipos e 372 testes). Checkbox mantido para o laço.
- [x] M2.2 Estado da tarefa
  - Notas da rodada: implementados os cinco estados ordenados, rótulos em pt-BR, tipo `TaskStatus`, validação e conversão com erro `VALIDATION` para valores inválidos. Testes escritos primeiro e executados antes da implementação, falhando pela ausência do módulo. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 384 testes). Checkbox preservado para o laço.
- [x] M2.3 Dinheiro e horas
  - Notas da rodada: testes escritos e executados antes da implementação, com falha inicial pela ausência dos módulos. Implementados conversão e formatação de dinheiro em centavos e horas em centésimos, arredondamento decimal meio para cima, validação de valores seguros e soma de dinheiro. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 426 testes), após corrigir espaço não separável sinalizado pelo lint. Checkbox preservado para o laço.
- [x] M2.4 Datas
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência do módulo. Implementados validação de datas gregorianas, comparação, diferença em dias de calendário (de `a` até `b`) e conversão de instante no fuso informado; cobertas viradas, anos bissextos e entradas inválidas. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 449 testes). Checkbox preservado para o laço.
- [x] M2.5 Chamado e papéis
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência dos módulos. Implementados chamado com ID inteiro positivo seguro e link opcional HTTP(S), além dos tipos e validações dos papéis de usuário e participação. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 475 testes). Checkbox preservado para o laço.
- [x] M2.6 Organização, usuário, entidade, projeto
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência das entidades. Criadas as quatro entidades com nomes obrigatórios, iniciais do primeiro e último nomes, valor/hora padrão positivo em centavos, validação de papel e origem, e chave de projeto normalizada; stakeholders não têm vínculo com conta. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 490 testes). Checkbox preservado para o laço.
- [x] M2.7 Tarefa e envolvimento
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência dos módulos. Implementadas tarefa e participação imutáveis, responsável inicial criador, troca entre usuários participantes, validação e prevenção de duplicatas, campos editáveis e busca normalizada por título e projeto. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 495 testes). Checkbox preservado para o laço.
- [x] M2.8 Eventos e agendamento
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência das entidades. Criados os onze tipos de evento com payloads tipados e metadados de autoria, e agendamentos com título obrigatório, data validada, hora local HH:mm e participantes usuários. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 505 testes). Checkbox preservado para o laço.
- [x] M2.9 Ator e política de acesso
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da política. Implementados ator e políticas puras para participação, tarefas, projetos, valores, agenda e dashboard, com isolamento por organização e entidades sem acesso. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 510 testes). Checkbox preservado para o laço.
- [x] M2.10 Custo e prazo
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência das regras. Implementados subtotal com arredondamento meio para cima em aritmética inteira, soma dos subtotais e frases de prazo por dias de calendário, priorizando tarefas concluídas. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 523 testes). Checkbox preservado para o laço.
- [x] M2.11 Linha do tempo
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da regra. Implementados diffs dos campos e envolvimentos, incluindo troca de responsável e comparação de chamados por conteúdo, além de descrições em pt-BR com filtro de valores pela política de acesso e organização. Testados os onze tipos e a ocultação de valores de terceiros. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 525 testes). Checkbox preservado para o laço.
- [x] M2.12 Dashboard
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da regra. Implementadas distribuições percentuais pelo maior resto, com desempate pela ordem dos estados, e estatísticas por usuário usando a política de participação e isolamento por organização. A decisão sobre incluir gestores na tabela permanece em aberto para a etapa de interface. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 528 testes). Checkbox preservado para o laço.
- [x] M2.13 Fechamento do core
  - Notas da rodada: API pública do core exporta valores, entidades, políticas, regras e erros; teste da entrada escrito antes da implementação e confirmado com falha inicial. Configurado limite de 95% de linhas para o core; `sanity.test.ts` já havia sido removido. O teste existente de ESLint precisou de prazo maior para analisar a nova entrada durante a cobertura. Sem falha anterior ou dependência nova. Validação: `pnpm check` e `pnpm coverage` passaram (529 testes; 99,58% de linhas no relatório atual). Checkbox preservado para o laço.
- [ ] PARADA M2: Pedro revisa a matriz de acesso nos testes do M2.9 e as frases da linha do tempo.

## Pendências abertas para o Pedro

O Codex acrescenta uma linha por item, no formato `- [ ] <passo> · <TIPO>: <texto>`.
Tipos: `CONFERIR`, `TESTAR-NO-WINDOWS`, `RODAR-E2E`, `DECIDIR`.

- [ ] M1 · CONFERIR: abrir `tooling/layers.js` e confirmar que as fronteiras entre camadas refletem a tabela 3.1 do PLANO.
- [ ] M2.9 · CONFERIR: ler os testes de `access-policy` (matriz de acesso, PLANO 6.1) e confirmar que cada linha reflete a regra desejada.

## Como revisar ou desfazer

- Ver tudo: `git diff <commit-anterior> marco-M2`
- Ver um passo: `git show <commit>`
- Voltar a este marco: `git switch -c revisao-M2 marco-M2`
- Refazer um passo: `git revert <commit>`, desmarque o `[x]` no `PROGRESS.md` e rode o laço
