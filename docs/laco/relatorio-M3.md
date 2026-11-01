# Relatório do marco M3

- Data: 2026-11-01 00:07
- Passos concluídos: 16
- Tag git: `marco-M3`
- Verificações (`format:check`, `lint`, `typecheck`, `test`): **passaram** no fechamento do marco

## Passos e commits

- `23fe6ce` M3.1 Base do contrato
- `0374d78` M3.2 Schemas: sessão, usuários, projetos, entidades
- `a5ec61c` M3.3 Schemas: tarefas, envolvimentos, linha do tempo
- `d8af56d` M3.4 Schemas: dashboard e agenda; `AgileBoxApi` e `DesktopShellApi`
- `813c468` M3.5 Portas da aplicação
- `295372e` M3.6 Fakes e builders
- `16f321d` M3.7 Suíte de contrato dos repositórios
- `1a69eec` M3.8 Mappers
- `863cb72` M3.9 Casos de uso: sessão, usuários, projetos
- `6d51cd5` M3.10 Casos de uso: entidades
- `7476cb1` M3.11 Casos de uso: criar, ver, editar e mover tarefa
- `fa3bb5b` M3.12 Casos de uso: listas de tarefas
- `a6307bb` M3.13 Casos de uso: envolvimentos
- `1a7ff73` M3.14 Casos de uso: linha do tempo e dashboard
- `2cd68e3` M3.15 Casos de uso: agenda
- `df5f78e` M3.16 `createUseCases` e roteiro

## Testes

```
Test Files  42 passed (42)
Tests  632 passed (632)
```

## Cobertura

```
  ...icipations.ts |     100 |      100 |     100 |     100 |
  projects.ts      |     100 |      100 |     100 |     100 |
  result.ts        |     100 |      100 |     100 |     100 |
  session.ts       |     100 |      100 |     100 |     100 |
  ...ed-schemas.ts |     100 |      100 |     100 |     100 |
  shell-api.ts     |     100 |      100 |     100 |     100 |
  tasks.ts         |     100 |      100 |     100 |     100 |
  timeline.ts      |     100 |      100 |     100 |     100 |
  users.ts         |     100 |      100 |     100 |     100 |
 core/src          |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 core/src/entities |   98.38 |       94 |     100 |   98.24 |
  contributor.ts   |     100 |      100 |     100 |     100 |
  meeting.ts       |     100 |      100 |     100 |     100 |
  organization.ts  |     100 |      100 |     100 |     100 |
  participation.ts |    87.5 |     87.5 |     100 |    87.5 | 24
  project.ts       |     100 |      100 |     100 |     100 |
  task.ts          |     100 |    93.33 |     100 |     100 | 101
  ...line-event.ts |     100 |      100 |     100 |     100 |
  user.ts          |     100 |      100 |     100 |     100 |
  validation.ts    |     100 |      100 |     100 |     100 |
 core/src/policies |     100 |      100 |     100 |     100 |
  access-policy.ts |     100 |      100 |     100 |     100 |
  actor.ts         |       0 |        0 |       0 |       0 |
 core/src/rules    |   98.93 |     92.2 |     100 |     100 |
  cost.ts          |     100 |      100 |     100 |     100 |
  dashboard.ts     |     100 |      100 |     100 |     100 |
  ...line-label.ts |     100 |      100 |     100 |     100 |
  timeline.ts      |   98.07 |    89.83 |     100 |     100 | ...01,108,127-129
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

```
"zod": "^4.6.7"
```

## Arquivos alterados

```
 .../use-cases/contributors/create-contributor.ts   |  29 ++
 .../use-cases/contributors/list-contributors.ts    |  13 +
 .../src/use-cases/contributors/set-default-rate.ts |  42 +++
 .../src/use-cases/dashboard/get-dashboard.ts       |  24 ++
 .../src/use-cases/meetings/meetings.test.ts        | 157 +++++++++++
 .../application/src/use-cases/meetings/meetings.ts | 120 ++++++++
 .../participations/participations.test.ts          | 260 ++++++++++++++++++
 .../src/use-cases/participations/participations.ts | 301 +++++++++++++++++++++
 .../src/use-cases/projects/create-project.ts       |  43 +++
 .../src/use-cases/projects/list-projects.ts        |  26 ++
 .../src/use-cases/projects/project-members.ts      |  92 +++++++
 .../src/use-cases/projects/projects.test.ts        | 142 ++++++++++
 .../src/use-cases/session/get-current-actor.ts     |  10 +
 .../src/use-cases/session/list-users.ts            |  13 +
 .../src/use-cases/session/session.test.ts          |  76 ++++++
 .../src/use-cases/session/switch-user.ts           |  21 ++
 .../application/src/use-cases/tasks/list-tasks.ts  | 109 ++++++++
 .../src/use-cases/tasks/task-lists.test.ts         | 228 ++++++++++++++++
 .../application/src/use-cases/tasks/tasks.test.ts  | 214 +++++++++++++++
 packages/application/src/use-cases/tasks/tasks.ts  | 205 ++++++++++++++
 .../src/use-cases/timeline-dashboard.test.ts       | 176 ++++++++++++
 .../src/use-cases/timeline/list-timeline.ts        |  45 +++
 .../src/use-cases/users/set-default-rate.test.ts   |  76 ++++++
 .../src/use-cases/users/set-default-rate.ts        |  39 +++
 packages/contract/package.json                     |   3 +
 packages/contract/src/api.test.ts                  |  20 ++
 packages/contract/src/api.ts                       | 211 +++++++++++++++
 packages/contract/src/changes.ts                   |   6 +
 packages/contract/src/channels.ts                  |  49 ++++
 packages/contract/src/contributors.test.ts         |  35 +++
 packages/contract/src/contributors.ts              |  23 ++
 packages/contract/src/dashboard-meetings.test.ts   |  81 ++++++
 packages/contract/src/dashboard.ts                 |  35 +++
 packages/contract/src/errors.ts                    |  11 +
 packages/contract/src/index.ts                     |  17 +-
 packages/contract/src/meetings.ts                  |  51 ++++
 packages/contract/src/participations.test.ts       | 113 ++++++++
 packages/contract/src/participations.ts            |  53 ++++
 packages/contract/src/projects.test.ts             |  56 ++++
 packages/contract/src/projects.ts                  |  25 ++
 packages/contract/src/result.test.ts               |  15 +
 packages/contract/src/result.ts                    |  15 +
 packages/contract/src/session.test.ts              |  44 +++
 packages/contract/src/session.ts                   |  28 ++
 packages/contract/src/shared-schemas.ts            |  17 ++
 packages/contract/src/shell-api.ts                 |  23 ++
 packages/contract/src/tasks.test.ts                | 105 +++++++
 packages/contract/src/tasks.ts                     |  73 +++++
 packages/contract/src/timeline.test.ts             |  39 +++
 packages/contract/src/timeline.ts                  |  31 +++
 packages/contract/src/users.test.ts                |  33 +++
 packages/contract/src/users.ts                     |  21 ++
 packages/core/src/entities/entities.test.ts        |   6 +-
 packages/core/src/entities/validation.ts           |   1 -
 scripts/codex-loop/README.md                       |  38 ++-
 scripts/codex-loop/docs.sh                         |   6 +-
 scripts/codex-loop/run.sh                          |  64 ++++-
 scripts/codex-loop/start.sh                        |  27 ++
 scripts/codex-loop/status.sh                       |  36 +++
 94 files changed, 5610 insertions(+), 41 deletions(-)
```

## Pontos de revisão sugeridos

Pedro revisa os casos de uso e o roteiro.

## Notas dos passos (PROGRESS.md)

- [x] M3.1 Base do contrato
  - Nota: Criados o envelope discriminado de resultado, `ApiError`, eventos de mudança e canais da API e da janela; exportados pela entrada do pacote.
  - Nota: `zod` já estava declarado como dependência de produção; sem dependências novas.
  - Nota: Teste do envelope primeiro falhou sem a implementação; `pnpm check` passou após `pnpm format` (531 testes).
- [x] M3.2 Schemas: sessão, usuários, projetos, entidades
  - Nota: schemas e DTOs inferidos para sessão, usuários, projetos, membros e entidades; setters recebem centavos e DTOs usam valores em R$ ou `null`.
  - Nota: testes de aceitação/rejeição adicionados antes da implementação. `pnpm check` passou (formatação, lint, tipos e 547 testes); sem dependências novas.
- [x] M3.3 Schemas: tarefas, envolvimentos, linha do tempo
  - Nota: Criados schemas de tarefas, filtros de quadros, detalhe com permissões, envolvimentos discriminados e eventos da linha do tempo; exportados pela entrada do contrato.
  - Nota: Testes escritos antes da implementação cobrem IDs inválidos, campos vazios, horas com vírgula, visibilidade de valor/hora e validações de papel. `pnpm check` passou (560 testes), sem dependências novas.
- [x] M3.4 Schemas: dashboard e agenda; `AgileBoxApi` e `DesktopShellApi`
  - Nota: Schemas de dashboard e agenda e interfaces `AgileBoxApi`/`DesktopShellApi` implementados; registry valida canal e schemas para todos os métodos da seção 7.
  - Nota: Agenda usa IDs de usuários como participantes, seguindo o modelo da seção 5; decisão 12.5 registrada para confirmação antes do M8.
  - Nota: `pnpm check` passou após corrigir um exemplo de teste que somava 100% e, por isso, era válido.
- [x] M3.5 Portas da aplicação
  - Nota: Criadas as portas assíncronas de repositórios, transação, relógio, IDs e notificação; `AppDeps` e exportações públicas adicionados.
  - Nota: Teste de tipos cobre assinaturas assíncronas e `organizationId` em primeiro lugar; aplicado também a `Clock` e `IdGenerator`, conforme texto do passo, embora PLANO 3.6 restrinja a regra explicitamente aos repositórios.
  - Nota: `pnpm check` passou (formatação, lint, tipos e 566 testes); sem dependências novas.
- [x] M3.6 Fakes e builders
  - Nota: Fakes em memória para as portas, relógio, IDs sequenciais, notificações gravadas e builders de usuários, projetos, entidades, tarefas, envolvimentos e reuniões; exportação separada `@agilebox/application/testing`.
  - Nota: Testes cobrem relógio, sequência de IDs, notificação, isolamento por organização e rollback do `UnitOfWork`; `pnpm check` passou (571 testes), sem dependências novas.
- [x] M3.7 Suíte de contrato dos repositórios
  - Nota: Contrato reutilizável criado e executado nos repositórios em memória; cobre gravação/leitura, remoção, Recentes, Frequentes, busca sem acentos, chave de projeto por organização e isolamento. `pnpm check` passou (576 testes), sem dependências novas.
- [x] M3.8 Mappers
  - Nota: Mappers de usuário, entidade, projeto, tarefa, envolvimento, agenda, linha do tempo e dashboard exportados pela aplicação; tarifas e total em reais são filtrados pelas políticas do domínio.
  - Nota: DTO de detalhe inclui `total` em reais ou `null`; cobertura verifica tarifas ocultas para colaborador, total apenas para gestor e detalhe somente leitura para membro.
  - Nota: `pnpm check` passou (579 testes), sem dependências novas.
- [x] M3.9 Casos de uso: sessão, usuários, projetos
  - Nota: Casos de sessão, tarifa padrão, listagem/criação de projetos e gestão de membros implementados com testes de acesso, validação, notificações e isolamento por organização.
  - Nota: `ActorSession` foi incluída como porta da aplicação; a troca de usuário publica `session`, e mudanças de tarifa e projeto publicam seus respectivos tipos.
  - Nota: `pnpm check` passou (593 testes), sem dependências novas.
- [x] M3.10 Casos de uso: entidades
  - Nota: Listagem por organização e alteração de tarifa restrita ao gestor implementadas, com filtro no mapper, validação e notificação; testes incluídos.
  - Nota: Criação ficou pendente: o contrato recebe só nome, mas o domínio exige tarifa padrão positiva; não há valor inicial definido nos documentos.
  - Nota: `pnpm check` passou (598 testes); retomada depende da decisão registrada em `.loop/blocked.md`.
  - Nota: Criar entidade agora usa tarifa inicial 0, origem `manual`, ator como autor e organização da sessão; qualquer papel pode criar e a mudança é notificada. O zero é aceito como padrão no domínio, mas definir tarifa zero continua inválido para usuários e entidades.
  - Nota: Testes de criação, validação, notificação, isolamento e tarifa padrão passaram; `pnpm check` passou (601 testes), sem dependências novas.
- [x] M3.11 Casos de uso: criar, ver, editar e mover tarefa
  - Nota: Criar, consultar detalhe, editar e mover tarefa foram ligados ao `createUseCases`, com acesso por organização, participação/membresia e tarifa padrão do criador.
  - Nota: Criação e diffs de edição/movimentação gravam tarefa e eventos na mesma transação; marcação `asManager` deriva sempre do papel do ator.
  - Nota: Testes cobrem sucesso, negação, prazo/chamado via mapeamento, notificações, somente leitura e rollback quando a gravação do evento falha.
  - Nota: `pnpm check` passou: 609 testes, sem dependências novas.
- [x] M3.12 Casos de uso: listas de tarefas
  - Nota: Casos de uso de listas e registro de abertura ligados ao `createUseCases`; acesso, participação, projeto e busca cobertos por testes.
  - Nota: Fakes ordenam estados na ordem do produto e Frequentes pela última abertura (desempate por contagem); `pnpm check` passou (615 testes).
- [x] M3.13 Casos de uso: envolvimentos
  - Nota: Os quatro casos foram implementados e ligados a `createUseCases`; testes cobrem cópia de tarifa, permissões por participante, horas, tarifa padrão, marca Gestor e rollback.
  - Nota: `pnpm check` passou (623 testes), sem dependências novas.
- [x] M3.14 Casos de uso: linha do tempo e dashboard
  - Nota: Linha do tempo valida acesso à tarefa, resolve nomes na organização, ordena do evento mais recente e aplica o filtro de tarifa por viewer.
  - Nota: Dashboard aceita somente gestor; distribuição global e estatísticas por participante reaproveitam as regras do core e omitem usuários sem tarefas.
  - Nota: Decisão provisória PLANO 12.4: incluir gestor na tabela quando participar de tarefas; `pnpm check` passou (627 testes).
- [x] M3.15 Casos de uso: agenda
  - Nota: Os cinco casos foram ligados a `createUseCases`; consultas usam a organização do ator e a data de `Clock`.
  - Nota: Gravações são exclusivas do gestor, usam `UnitOfWork` e publicam mudança de agenda; testes cobrem permissões, ordenação e ausência de registros.
  - Nota: `pnpm check` passou: 631 testes, sem dependências novas.
- [x] M3.16 `createUseCases` e roteiro
  - Nota: Adicionado roteiro ponta a ponta com fakes desde a criação do projeto até a edição do gestor e conferência da linha do tempo.
  - Nota: Índice público agora exporta os casos de uso de participações e agenda junto da composição `createUseCases`.
  - Nota: `pnpm check` passou (632 testes); cobertura em `packages/application`: 92,96% statements e 96,51% linhas.
- [ ] PARADA M3: Pedro revisa os casos de uso e o roteiro.

## Pendências abertas para o Pedro

O Codex acrescenta uma linha por item, no formato `- [ ] <passo> · <TIPO>: <texto>`.
Tipos: `CONFERIR`, `TESTAR-NO-WINDOWS`, `RODAR-E2E`, `DECIDIR`.

- [ ] M1 · CONFERIR: abrir `tooling/layers.js` e confirmar que as fronteiras entre camadas refletem a tabela 3.1 do PLANO.
- [ ] M2.9 · CONFERIR: ler os testes de `access-policy` (matriz de acesso, PLANO 6.1) e confirmar que cada linha reflete a regra desejada.
- [ ] M3.4 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.5) — a agenda aceita participantes usuários conforme o modelo da seção 5; confirmar se entidades sem conta também devem poder participar antes do M8.
- [ ] M3.14 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.4) — a tabela do dashboard inclui o gestor quando ele tiver tarefas; confirmar essa regra antes do M7 (alternativa: exibir somente colaboradores).
- [x] M3.10 · DECIDIR: tarifa inicial de entidade. **Decidido:** valor padrão 0 = "não definido"; criação só com nome (PLANO 6.2).

## Como revisar ou desfazer

- Ver tudo: `git diff marco-M2 marco-M3`
- Ver um passo: `git show <commit>`
- Voltar a este marco: `git switch -c revisao-M3 marco-M3`
- Refazer um passo: `git revert <commit>`, desmarque o `[x]` no `PROGRESS.md` e rode o laço
