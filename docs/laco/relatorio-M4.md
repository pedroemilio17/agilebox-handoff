# Relatório do marco M4

- Data: 2026-11-01 00:57
- Passos concluídos: 8
- Tag git: `marco-M4`
- Verificações (`format:check`, `lint`, `typecheck`, `test`): **passaram** no fechamento do marco

## Passos e commits

- `9a48e95` M4.1 Cliente e configuração
- `ed88219` M4.2 Schema: organização, usuários, entidades, projetos, membros
- `61a6c04` M4.3 Schema: tarefas, envolvimentos, eventos, aberturas, agenda, `local_settings`; migração inicial
- `4054390` M4.4 Mappers e repositórios: organização, usuários, entidades, projetos
- `ef9b31f` M4.5 Repositórios: tarefas, envolvimentos, linha do tempo, aberturas
- `742227a` M4.6 Repositório de agenda, `SqliteUnitOfWork`, `createSqliteAdapters`
- `03e14ad` M4.7 Seed e scripts
- `668efbe` M4.8 ABI do better-sqlite3 (Node × Electron)

## Testes

```
Test Files  52 passed (52)
Tests  654 passed (654)
```

## Cobertura

```
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
 infra-sqlite/src  |   96.55 |       50 |     100 |     100 |
  client.ts        |     100 |      100 |     100 |     100 |
  ...e-adapters.ts |     100 |      100 |     100 |     100 |
  index.ts         |       0 |        0 |       0 |       0 |
  unit-of-work.ts  |   94.44 |       50 |     100 |     100 | 19-29
 ...te/src/mappers |      90 |       50 |     100 |     100 |
  core-mappers.ts  |     100 |       50 |     100 |     100 | 45
  task-mappers.ts  |   83.33 |       50 |     100 |     100 | 24-55
 ...c/repositories |   82.28 |     55.2 |   85.96 |   88.38 |
  ...positories.ts |   88.23 |    64.28 |   93.33 |   93.54 | 94-99
  ...repository.ts |   93.02 |     62.5 |     100 |     100 | 53-122
  ...positories.ts |   75.51 |    51.51 |   77.41 |   81.39 | ...04,114-135,175
 ...ite/src/schema |    27.9 |      100 |       0 |    27.9 |
  contributors.ts  |   33.33 |      100 |       0 |   33.33 | 9-16
  index.ts         |       0 |        0 |       0 |       0 |
  ...l-settings.ts |     100 |      100 |     100 |     100 |
  ...rticipants.ts |      25 |      100 |       0 |      25 | 10-15
  meetings.ts      |      25 |      100 |       0 |      25 | 11-21
  organizations.ts |     100 |      100 |     100 |     100 |
  ...ct-members.ts |      20 |      100 |       0 |      20 | 10-19
  projects.ts      |      25 |      100 |       0 |      25 | 11-19
  task-events.ts   |      25 |      100 |       0 |      25 | 11-20
  task-opens.ts    |      25 |      100 |       0 |      25 | 10-17
  ...icipations.ts |      20 |      100 |       0 |      20 | 13-21
  tasks.ts         |      20 |      100 |       0 |      20 | 13-32
  users.ts         |   33.33 |      100 |       0 |   33.33 | 11-19
 ...qlite/src/seed |   94.82 |    85.71 |      70 |   96.29 |
  data.ts          |     100 |      100 |     100 |     100 |
  seed.ts          |   94.73 |    85.71 |      70 |   96.22 | 49-51
 ui/src            |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
-------------------|---------|----------|---------|---------|-------------------
```

## Dependências adicionadas neste marco

```
"better-sqlite3": "^13.0.3"
"drizzle-orm": "^0.45.4"
"@electron/rebuild": "^4.2.1"
"vite": "^8.3.5"
```

## Arquivos alterados

```
 PROGRESS.md                                        |   42 +-
 docs/decisoes/0002-better-sqlite3-abi.md           |   13 +
 package.json                                       |   10 +-
 .../src/testing/fakes/in-memory-repositories.ts    |    2 +-
 .../application/src/testing/repository-contract.ts |   23 +-
 .../application/src/use-cases/tasks/tasks.test.ts  |    2 +-
 packages/infra-sqlite/drizzle.config.ts            |   10 +
 .../infra-sqlite/migrations/0000_harsh_miek.sql    |  150 +++
 .../migrations/meta/0000_snapshot.json             | 1088 ++++++++++++++++++++
 .../infra-sqlite/migrations/meta/_journal.json     |   13 +
 packages/infra-sqlite/package.json                 |   10 +-
 packages/infra-sqlite/scripts/migrate.mjs          |    9 +
 packages/infra-sqlite/scripts/reset.mjs            |    6 +
 packages/infra-sqlite/scripts/runtime.mjs          |   20 +
 packages/infra-sqlite/scripts/seed.mjs             |   28 +
 packages/infra-sqlite/src/client.test.ts           |   31 +
 packages/infra-sqlite/src/client.ts                |   18 +
 .../src/create-sqlite-adapters.test.ts             |   23 +
 .../infra-sqlite/src/create-sqlite-adapters.ts     |   19 +
 packages/infra-sqlite/src/index.ts                 |    7 +-
 .../infra-sqlite/src/mappers/core-mappers.test.ts  |   26 +
 packages/infra-sqlite/src/mappers/core-mappers.ts  |   60 ++
 packages/infra-sqlite/src/mappers/task-mappers.ts  |   73 ++
 .../src/repositories/core-repositories.test.ts     |  115 +++
 .../src/repositories/core-repositories.ts          |  152 +++
 .../src/repositories/meeting-repository.test.ts    |   53 +
 .../src/repositories/meeting-repository.ts         |  140 +++
 .../src/repositories/task-repositories.test.ts     |  163 +++
 .../src/repositories/task-repositories.ts          |  398 +++++++
 .../infra-sqlite/src/repository-contract.test.ts   |   50 +
 packages/infra-sqlite/src/schema/contributors.ts   |   18 +
 packages/infra-sqlite/src/schema/index.ts          |   12 +
 packages/infra-sqlite/src/schema/local-settings.ts |    6 +
 .../src/schema/meeting-participants.ts             |   16 +
 packages/infra-sqlite/src/schema/meetings.ts       |   22 +
 packages/infra-sqlite/src/schema/organizations.ts  |    7 +
 .../infra-sqlite/src/schema/project-members.ts     |   20 +
 packages/infra-sqlite/src/schema/projects.ts       |   22 +
 packages/infra-sqlite/src/schema/task-events.ts    |   21 +
 packages/infra-sqlite/src/schema/task-opens.ts     |   21 +
 .../infra-sqlite/src/schema/task-participations.ts |   42 +
 packages/infra-sqlite/src/schema/tasks.ts          |   40 +
 packages/infra-sqlite/src/schema/users.ts          |   20 +
 packages/infra-sqlite/src/seed/data.ts             |   95 ++
 packages/infra-sqlite/src/seed/seed.test.ts        |   41 +
 packages/infra-sqlite/src/seed/seed.ts             |  143 +++
 packages/infra-sqlite/src/unit-of-work.test.ts     |   63 ++
 packages/infra-sqlite/src/unit-of-work.ts          |   42 +
 packages/infra-sqlite/tsconfig.json                |    3 +
 scripts/ensure-native.mjs                          |   92 ++
 tooling/native-rebuild-plan.d.mts                  |    6 +
 tooling/native-rebuild-plan.mjs                    |   14 +
 tooling/native-rebuild-plan.test.ts                |   18 +
 53 files changed, 3522 insertions(+), 16 deletions(-)
```

## Pontos de revisão sugeridos

Pedro roda `pnpm db:reset && pnpm db:seed` e confere o banco.

## Notas dos passos (PROGRESS.md)

- [x] M4.1 Cliente e configuração
  - Nota: As quatro dependências do passo não estão instaladas; registradas em `.loop/deps.txt` para retomada pelo laço.
  - Nota: Na retomada, confirmei que os quatro pacotes ainda não resolvem no workspace. Reenviei a solicitação em `.loop/deps.txt`; implementação e `pnpm check` aguardam a instalação automática. Status `NEEDS_DEPS`.
  - Nota: Criados `createSqliteClient` com `journal_mode = WAL` e `foreign_keys = ON`, teste em memória e `drizzle.config.ts` no pacote; em memória o SQLite mantém `journal_mode = memory`.
  - Nota: O pacote SQLite usa `skipLibCheck` para ignorar declarações externas incompatíveis do Drizzle; `pnpm check` passou (633 testes).
- [x] M4.2 Schema: organização, usuários, entidades, projetos, membros
  - Nota: Criados schemas Drizzle para organizações, usuários, entidades, projetos e membros de projeto, com chaves estrangeiras e chave primária composta em membros.
  - Nota: Email de usuário e `name_key` de projeto têm unicidade por organização, conforme o plano; nenhuma unicidade adicional foi definida para entidades.
  - Nota: `pnpm check` passou: formatação, lint, typecheck e 633 testes.
- [x] M4.3 Schema: tarefas, envolvimentos, eventos, aberturas, agenda, `local_settings`; migração inicial
  - Nota: Criados os schemas de tarefas, envolvimentos, eventos, aberturas, agenda e `local_settings`, com CHECKs, chaves e índices definidos na seção 5 do plano.
  - Nota: Gerada a migração inicial pelo script `db:generate`; `createSqliteClient` agora aplica as migrações ao abrir o banco.
  - Nota: Teste confirma as 12 tabelas do schema após migração em memória; `pnpm check` passou (633 testes).
- [x] M4.4 Mappers e repositórios: organização, usuários, entidades, projetos
  - Nota: Implementados mappers de organização, usuário, entidade e projeto, além dos repositórios SQLite de usuários, entidades, projetos e membros.
  - Nota: Testes cobrem persistência, membros, isolamento por organização e nome de projeto repetido entre organizações; `pnpm check` passou (637 testes).
- [x] M4.5 Repositórios: tarefas, envolvimentos, linha do tempo, aberturas
  - Nota: Criados mappers e repositórios SQLite para tarefas, envolvimentos, eventos da linha do tempo e aberturas; tarefas carregam participantes e nome do projeto.
  - Nota: Leituras e gravações validam a organização do registro pai e dos usuários/entidades relacionados; Recentes, Frequentes, busca e linha do tempo seguem a ordenação e o escopo do plano.
  - Nota: Suíte de contrato ampliada para conferir linha do tempo mais recente primeiro; fake alinhado à mesma ordem. Testes SQLite cobrem persistência, isolamento e contagem de aberturas.
  - Nota: `pnpm check` passou (641 testes); nenhuma dependência nova. Status `DONE`.
- [x] M4.6 Repositório de agenda, `SqliteUnitOfWork`, `createSqliteAdapters`
  - Nota: Implementados o repositório SQLite de agenda e `createSqliteAdapters`, que reúne todos os repositórios, `UnitOfWork` e fechamento do banco.
  - Nota: `SqliteUnitOfWork` envolve a operação assíncrona em `BEGIN`/`COMMIT` e desfaz gravações em erro; teste cobre rollback e commit.
  - Nota: Contrato completo executado em SQLite em memória com `foreign_keys` habilitado; ajustes nos fixtures usam IDs e relações válidos para SQL.
  - Nota: `pnpm check` passou: formatação, lint, tipos e 651 testes.
- [x] M4.7 Seed e scripts
  - Nota: Conferidos os dados de demonstração, seed pelos casos de uso, scripts `db:*` e caminho `.data/agilebox.db` ignorado pelo Git; não havia falha anterior.
  - Nota: Teste do seed passou e conferiu 5 usuários, 3 projetos, 2 entidades, 10 tarefas, 3 agendamentos e eventos de linha do tempo, incluindo edição de gestor.
  - Nota: `pnpm check` passou (formatação, lint, tipos e 652 testes); sem dependências novas ou pendências externas deste passo.
- [x] M4.8 ABI do better-sqlite3 (Node × Electron)
  - Nota: Criado `scripts/ensure-native.mjs`; detecta pacote/alvo ausente como no-op, tenta carregar no alvo e reconstrói somente diante de incompatibilidade de ABI.
  - Nota: `native:node` usa `npm rebuild` no workspace SQLite, `native:electron` usa `@electron/rebuild`; o `test` chama a verificação Node antes do Vitest.
  - Nota: Estratégia, custo da alternância do binário hoisted e alternativa de instalações separadas registrados em `docs/decisoes/0002-better-sqlite3-abi.md`.
  - Nota: Testes da decisão de rebuild cobrem os comandos de Node e Electron; a validação no Windows segue como pendência do Pedro.
- [ ] PARADA M4: Pedro roda `pnpm db:reset && pnpm db:seed` e confere o banco.

## Pendências abertas para o Pedro

O Codex acrescenta uma linha por item, no formato `- [ ] <passo> · <TIPO>: <texto>`.
Tipos: `CONFERIR`, `TESTAR-NO-WINDOWS`, `RODAR-E2E`, `DECIDIR`.

- [ ] M1 · CONFERIR: abrir `tooling/layers.js` e confirmar que as fronteiras entre camadas refletem a tabela 3.1 do PLANO.
- [ ] M2.9 · CONFERIR: ler os testes de `access-policy` (matriz de acesso, PLANO 6.1) e confirmar que cada linha reflete a regra desejada.
- [ ] M3.4 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.5) — a agenda aceita participantes usuários conforme o modelo da seção 5; confirmar se entidades sem conta também devem poder participar antes do M8.
- [ ] M3.14 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.4) — a tabela do dashboard inclui o gestor quando ele tiver tarefas; confirmar essa regra antes do M7 (alternativa: exibir somente colaboradores).
- [x] M3.10 · DECIDIR: tarifa inicial de entidade. **Decidido:** valor padrão 0 = "não definido"; criação só com nome (PLANO 6.2).
- [ ] M4.8 · TESTAR-NO-WINDOWS: executar `pnpm native:electron` e depois `pnpm native:node` no Windows; confirmar que ambas as recompilações terminam e que a aplicação/testes carregam o addon no ABI correspondente.

## Como revisar ou desfazer

- Ver tudo: `git diff marco-M3 marco-M4`
- Ver um passo: `git show <commit>`
- Voltar a este marco: `git switch -c revisao-M4 marco-M4`
- Refazer um passo: `git revert <commit>`, desmarque o `[x]` no `PROGRESS.md` e rode o laço
