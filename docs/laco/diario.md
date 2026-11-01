# Diário do laço

Uma entrada por passo concluído, escrita pelo script do laço.

## 2026-10-31 22:51 · M3.1 Base do contrato

- Alterações: 9 files changed, 117 insertions(+), 3 deletions(-)
- Rodadas do Codex neste passo: 2
- Arquivos:
  - `PROGRESS.md`
  - `packages/contract/package.json`
  - `packages/contract/src/changes.ts`
  - `packages/contract/src/channels.ts`
  - `packages/contract/src/errors.ts`
  - `packages/contract/src/index.ts`
  - `packages/contract/src/result.test.ts`
  - `packages/contract/src/result.ts`
  - `pnpm-lock.yaml`

**Resumo do Codex:**

> M3.1 concluído. Criei e exportei o envelope de resultado, `ApiError`, tipos de eventos de mudança e canais da API e da janela. `zod` já estava declarado no pacote; não foi necessária dependência nova.
>
> O teste do envelope foi escrito antes da implementação. Depois de ajustar a formatação, `pnpm check` passou: 531 testes.
>
> Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:136) e o status da rodada como `DONE`.

## 2026-10-31 22:53 · M3.2 Schemas: sessão, usuários, projetos, entidades

- Alterações: 11 files changed, 286 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/contract/src/contributors.test.ts`
  - `packages/contract/src/contributors.ts`
  - `packages/contract/src/index.ts`
  - `packages/contract/src/projects.test.ts`
  - `packages/contract/src/projects.ts`
  - `packages/contract/src/session.test.ts`
  - `packages/contract/src/session.ts`
  - `packages/contract/src/shared-schemas.ts`
  - `packages/contract/src/users.test.ts`
  - `packages/contract/src/users.ts`

**Resumo do Codex:**

> M3.2 concluído. Adicionei schemas de entrada e saída e DTOs inferidos para sessão, usuários, projetos, membros e entidades. Os campos de valor/hora aceitam `number | null`; entradas dos setters usam centavos.
>
> `pnpm check` passou: formatação, lint, tipos e 547 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e o status `DONE` em `.loop/status`.

## 2026-10-31 22:55 · M3.3 Schemas: tarefas, envolvimentos, linha do tempo

- Alterações: 8 files changed, 417 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/contract/src/index.ts`
  - `packages/contract/src/participations.test.ts`
  - `packages/contract/src/participations.ts`
  - `packages/contract/src/tasks.test.ts`
  - `packages/contract/src/tasks.ts`
  - `packages/contract/src/timeline.test.ts`
  - `packages/contract/src/timeline.ts`

**Resumo do Codex:**

> M3.3 concluído. Adicionei e exportei schemas para tarefas, envolvimentos e linha do tempo, com testes de aceitação e rejeição escritos primeiro.
>
> `pnpm check` passou: formatação, lint, tipos e 560 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:150) e o status está como `DONE`.

## 2026-10-31 22:58 · M3.4 Schemas: dashboard e agenda; `AgileBoxApi` e `DesktopShellApi`

- Alterações: 8 files changed, 429 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/contract/src/api.test.ts`
  - `packages/contract/src/api.ts`
  - `packages/contract/src/dashboard-meetings.test.ts`
  - `packages/contract/src/dashboard.ts`
  - `packages/contract/src/index.ts`
  - `packages/contract/src/meetings.ts`
  - `packages/contract/src/shell-api.ts`

**Resumo do Codex:**

> M3.4 concluído. Implementei os schemas de dashboard e agenda, as interfaces `AgileBoxApi` e `DesktopShellApi` e testes para conferir os canais e schemas. Registrei a decisão provisória sobre participantes da agenda em aberto.
>
> `pnpm check` passou: 28 arquivos de teste e 565 testes. Status registrado como `DONE`.
>
> Arquivos principais: [api.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/contract/src/api.ts), [dashboard.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/contract/src/dashboard.ts), [meetings.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/contract/src/meetings.ts) e [pendencias-do-pedro.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/docs/laco/pendencias-do-pedro.md).

## 2026-10-31 23:01 · M3.5 Portas da aplicação

- Alterações: 17 files changed, 223 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/deps.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/ports/change-notifier.ts`
  - `packages/application/src/ports/clock.ts`
  - `packages/application/src/ports/contributor-repository.ts`
  - `packages/application/src/ports/id-generator.ts`
  - `packages/application/src/ports/index.ts`
  - `packages/application/src/ports/meeting-repository.ts`
  - `packages/application/src/ports/participation-repository.ts`
  - `packages/application/src/ports/ports.test.ts`
  - `packages/application/src/ports/project-repository.ts`
  - `packages/application/src/ports/task-open-repository.ts`
  - `packages/application/src/ports/task-repository.ts`
  - `packages/application/src/ports/timeline-repository.ts`
  - `packages/application/src/ports/unit-of-work.ts`
  - `packages/application/src/ports/user-repository.ts`

**Resumo do Codex:**

> M3.5 concluído. As portas e `AppDeps` foram criados e exportados; um teste de tipos cobre as assinaturas assíncronas e a organização como primeiro argumento.
>
> Registrei no `PROGRESS.md` que essa regra também foi aplicada a `Clock` e `IdGenerator`, seguindo o texto do passo, embora o PLANO 3.6 a especifique para repositórios.
>
> `pnpm check` passou: 566 testes. Status definido como `DONE`.

## 2026-10-31 23:05 · M3.6 Fakes e builders

- Alterações: 10 files changed, 628 insertions(+), 2 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/package.json`
  - `packages/application/src/testing/builders.ts`
  - `packages/application/src/testing/fakes/fakes.test.ts`
  - `packages/application/src/testing/fakes/fixed-clock.ts`
  - `packages/application/src/testing/fakes/in-memory-repositories.ts`
  - `packages/application/src/testing/fakes/in-memory-unit-of-work.ts`
  - `packages/application/src/testing/fakes/recording-notifier.ts`
  - `packages/application/src/testing/fakes/sequential-id-generator.ts`
  - `packages/application/src/testing/index.ts`

**Resumo do Codex:**

> M3.6 concluído. Implementei os fakes das portas, o `InMemoryUnitOfWork` com rollback, os builders e a exportação `@agilebox/application/testing`.
>
> `pnpm check` passou: 30 arquivos de teste e 571 testes. Registrei o resultado em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e marquei `.loop/status` como `DONE`.

## 2026-10-31 23:08 · M3.7 Suíte de contrato dos repositórios

- Alterações: 4 files changed, 211 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/testing/index.ts`
  - `packages/application/src/testing/repository-contract.test.ts`
  - `packages/application/src/testing/repository-contract.ts`

**Resumo do Codex:**

> Passo M3.7 concluído. Criei a suíte reutilizável de contrato e rodei-a contra os fakes em memória, cobrindo gravação e leitura, remoção, ordenação, busca sem acentos e isolamento por organização.
>
> `pnpm check` passou: 576 testes. Registrei a nota em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:176) e gravei `DONE` em `.loop/status`.

## 2026-10-31 23:11 · M3.8 Mappers

- Alterações: 6 files changed, 260 insertions(+), 2 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/index.ts`
  - `packages/application/src/mappers/index.ts`
  - `packages/application/src/mappers/mappers.test.ts`
  - `packages/contract/src/tasks.test.ts`
  - `packages/contract/src/tasks.ts`

**Resumo do Codex:**

> M3.8 concluído. Criei os mappers de entidades para DTOs, com filtros de valor/hora, total da tarefa e permissões de edição/leitura. O DTO de detalhe agora inclui `total` em reais ou `null`.
>
> Registrei as notas no [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:181) e o status está `DONE`.
>
> Verificação: `pnpm check` passou — 579 testes. Sem dependências novas.

## 2026-10-31 23:15 · M3.9 Casos de uso: sessão, usuários, projetos

- Alterações: 19 files changed, 591 insertions(+), 2 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/deps.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/ports/actor-session.ts`
  - `packages/application/src/ports/index.ts`
  - `packages/application/src/use-cases/projects/create-project.ts`
  - `packages/application/src/use-cases/projects/list-projects.ts`
  - `packages/application/src/use-cases/projects/project-members.ts`
  - `packages/application/src/use-cases/projects/projects.test.ts`
  - `packages/application/src/use-cases/session/get-current-actor.ts`
  - `packages/application/src/use-cases/session/list-users.ts`
  - `packages/application/src/use-cases/session/session.test.ts`
  - `packages/application/src/use-cases/session/switch-user.ts`
  - `packages/application/src/use-cases/users/set-default-rate.test.ts`
  - `packages/application/src/use-cases/users/set-default-rate.ts`
  - `packages/contract/src/changes.ts`
  - `packages/contract/src/index.ts`
  - `packages/contract/src/projects.ts`

**Resumo do Codex:**

> M3.9 concluído. Implementei os casos de uso de sessão, valor/hora padrão, projetos e membros, com testes de acesso, validação e notificações. Registrei as notas no [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:188).
>
> `pnpm check` passou: 593 testes. Status: `DONE`.

## 2026-10-31 23:31 · M3.10 Casos de uso: entidades

- Alterações: 9 files changed, 96 insertions(+), 4 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/use-cases/contributors/contributors.test.ts`
  - `packages/application/src/use-cases/contributors/create-contributor.ts`
  - `packages/application/src/use-cases/contributors/set-default-rate.ts`
  - `packages/application/src/use-cases/users/set-default-rate.ts`
  - `packages/core/src/entities/entities.test.ts`
  - `packages/core/src/entities/validation.ts`

**Resumo do Codex:**

> M3.10 concluído. Criação, listagem e alteração de tarifa de entidades estão implementadas; tarifa padrão zero é aceita na criação, mas continua inválida ao definir ou alterar o valor. A criação grava na organização do ator e notifica a mudança.
>
> `pnpm check` passou: 36 arquivos de teste e 601 testes. Registrei as notas em `PROGRESS.md` e escrevi `DONE` em `.loop/status`.
>
> Arquivos principais: [create-contributor.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/application/src/use-cases/contributors/create-contributor.ts), [validation.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/core/src/entities/validation.ts).

## 2026-10-31 23:34 · M3.11 Casos de uso: criar, ver, editar e mover tarefa

- Alterações: 5 files changed, 432 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/use-cases/tasks/tasks.test.ts`
  - `packages/application/src/use-cases/tasks/tasks.ts`

**Resumo do Codex:**

> M3.11 concluído. Implementei criar, consultar detalhe, editar e mover tarefas, com controle de acesso, eventos na mesma transação e rollback em caso de falha ao gravar eventos.
>
> `pnpm check` passou: 609 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e o status está `DONE`.

## 2026-10-31 23:38 · M3.12 Casos de uso: listas de tarefas

- Alterações: 6 files changed, 372 insertions(+), 6 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/testing/fakes/in-memory-repositories.ts`
  - `packages/application/src/use-cases/tasks/list-tasks.ts`
  - `packages/application/src/use-cases/tasks/task-lists.test.ts`

**Resumo do Codex:**

> M3.12 concluído. Implementei e conectei os casos de uso das listas de tarefas e do registro de abertura. Os testes cobrem filtros de acesso, ordenação e isolamento por organização.
>
> `pnpm check` passou: 615 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e o status ficou `DONE`.

## 2026-10-31 23:43 · M3.13 Casos de uso: envolvimentos

- Alterações: 4 files changed, 576 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/use-cases/participations/participations.test.ts`
  - `packages/application/src/use-cases/participations/participations.ts`

**Resumo do Codex:**

> M3.13 concluído. Implementei e conectei os casos `add`, `remove`, `set-hours` e `set-rate`, com eventos na linha do tempo, regras de acesso e atualização do valor padrão do envolvido na mesma transação.
>
> Os testes cobrem cópia de tarifa, permissões, marcação de edições do gestor e rollback. `pnpm check` passou com 623 testes; `pnpm format:check` também passou após a documentação. Não foram necessárias dependências novas.
>
> Atualizei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e o status está `DONE`.

## 2026-10-31 23:47 · M3.14 Casos de uso: linha do tempo e dashboard

- Alterações: 6 files changed, 259 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/index.ts`
  - `packages/application/src/use-cases/dashboard/get-dashboard.ts`
  - `packages/application/src/use-cases/timeline-dashboard.test.ts`
  - `packages/application/src/use-cases/timeline/list-timeline.ts`

**Resumo do Codex:**

> M3.14 concluído. Implementei `list-timeline` com controle de acesso, texto por viewer e ordem do mais recente ao mais antigo; e `get-dashboard`, restrito ao gestor, com estatísticas calculadas pelas regras do core. Liguei ambos ao `createUseCases`.
>
> `pnpm check` passou: **627 testes**. Também registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:225), a decisão provisória sobre o gestor no dashboard em [pendencias-do-pedro.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/docs/laco/pendencias-do-pedro.md) e o status `DONE` em `.loop/status`.

## 2026-10-31 23:51 · M3.15 Casos de uso: agenda

- Alterações: 4 files changed, 295 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.ts`
  - `packages/application/src/use-cases/meetings/meetings.test.ts`
  - `packages/application/src/use-cases/meetings/meetings.ts`

**Resumo do Codex:**

> Passo **M3.15 concluído**. Implementei os cinco casos de uso da agenda e os conectei a `createUseCases`. Os testes cobrem consultas, permissões de gestor, gravações e notificações.
>
> `pnpm check` passou: **631 testes**. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e marquei `.loop/status` como `DONE`.

## 2026-10-31 23:55 · M3.16 `createUseCases` e roteiro

- Alterações: 3 files changed, 92 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/create-use-cases.test.ts`
  - `packages/application/src/index.ts`

**Resumo do Codex:**

> M3.16 concluído. O roteiro com fakes cobre o fluxo até a edição do gestor e verifica a linha do tempo. Também completei os exports públicos dos casos de uso de participações e agenda em [index.ts](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/packages/application/src/index.ts).
>
> `pnpm check` passou com 632 testes; `pnpm coverage` passou. Em `packages/application`, a cobertura ficou em 92,96% de statements e 96,51% de linhas. Registrei as notas no `PROGRESS.md` e marquei `.loop/status` como `DONE`.

## 2026-11-01 00:19 · M4.1 Cliente e configuração

- Alterações: 8 files changed, 165 insertions(+), 3 deletions(-)
- Rodadas do Codex neste passo: 2
- Arquivos:
  - `PROGRESS.md`
  - `packages/infra-sqlite/drizzle.config.ts`
  - `packages/infra-sqlite/package.json`
  - `packages/infra-sqlite/src/client.test.ts`
  - `packages/infra-sqlite/src/client.ts`
  - `packages/infra-sqlite/src/index.ts`
  - `packages/infra-sqlite/tsconfig.json`
  - `pnpm-lock.yaml`

**Resumo do Codex:**

> M4.1 concluído. O cliente SQLite configura WAL e chaves estrangeiras; em memória, o modo efetivo aparece como `memory`. A configuração do Drizzle ficou dentro do pacote SQLite.
>
> `pnpm check` passou: 633 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:252) e escrevi `DONE` em `.loop/status`.

## 2026-11-01 00:22 · M4.2 Schema: organização, usuários, entidades, projetos, membros

- Alterações: 7 files changed, 96 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/infra-sqlite/src/schema/contributors.ts`
  - `packages/infra-sqlite/src/schema/index.ts`
  - `packages/infra-sqlite/src/schema/organizations.ts`
  - `packages/infra-sqlite/src/schema/project-members.ts`
  - `packages/infra-sqlite/src/schema/projects.ts`
  - `packages/infra-sqlite/src/schema/users.ts`

**Resumo do Codex:**

> M4.2 concluído. Criei os schemas Drizzle de organizações, usuários, entidades, projetos e membros de projeto, incluindo chaves estrangeiras e as unicidades por organização definidas no plano.
>
> `pnpm check` passou: formatação, lint, typecheck e 633 testes. Registrei as notas no `PROGRESS.md` e o status da rodada é `DONE`.

## 2026-11-01 00:25 · M4.3 Schema: tarefas, envolvimentos, eventos, aberturas, agenda, `local_settings`; migração inicial

- Alterações: 15 files changed, 1462 insertions(+), 7 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/infra-sqlite/migrations/0000_harsh_miek.sql`
  - `packages/infra-sqlite/migrations/meta/0000_snapshot.json`
  - `packages/infra-sqlite/migrations/meta/_journal.json`
  - `packages/infra-sqlite/package.json`
  - `packages/infra-sqlite/src/client.test.ts`
  - `packages/infra-sqlite/src/client.ts`
  - `packages/infra-sqlite/src/schema/index.ts`
  - `packages/infra-sqlite/src/schema/local-settings.ts`
  - `packages/infra-sqlite/src/schema/meeting-participants.ts`
  - `packages/infra-sqlite/src/schema/meetings.ts`
  - `packages/infra-sqlite/src/schema/task-events.ts`
  - `packages/infra-sqlite/src/schema/task-opens.ts`
  - `packages/infra-sqlite/src/schema/task-participations.ts`
  - `packages/infra-sqlite/src/schema/tasks.ts`

**Resumo do Codex:**

> M4.3 concluído. Foram adicionados os schemas e a migração inicial; `createSqliteClient` aplica migrações ao abrir o banco. O teste confirma as 12 tabelas após migrar um banco em memória.
>
> `pnpm check` passou: 43 arquivos de teste, 633 testes. Registrei as notas no `PROGRESS.md` e escrevi `DONE` em `.loop/status`.

## 2026-11-01 00:29 · M4.4 Mappers e repositórios: organização, usuários, entidades, projetos

- Alterações: 6 files changed, 357 insertions(+), 1 deletion(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/infra-sqlite/src/index.ts`
  - `packages/infra-sqlite/src/mappers/core-mappers.test.ts`
  - `packages/infra-sqlite/src/mappers/core-mappers.ts`
  - `packages/infra-sqlite/src/repositories/core-repositories.test.ts`
  - `packages/infra-sqlite/src/repositories/core-repositories.ts`

**Resumo do Codex:**

> M4.4 concluído. Implementei os mappers de organização, usuário, entidade e projeto, além dos repositórios SQLite de usuários, entidades, projetos e membros. Como o plano não define uma porta de repositório para organizações, implementei apenas o mapper dessa tabela.
>
> `pnpm check` passou: 637 testes. Registrei as notas no [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md) e marquei `.loop/status` como `DONE`.

## 2026-11-01 00:37 · M4.5 Repositórios: tarefas, envolvimentos, linha do tempo, aberturas

- Alterações: 8 files changed, 649 insertions(+), 4 deletions(-)
- Rodadas do Codex neste passo: 1
- Arquivos:
  - `PROGRESS.md`
  - `packages/application/src/testing/fakes/in-memory-repositories.ts`
  - `packages/application/src/testing/repository-contract.ts`
  - `packages/application/src/use-cases/tasks/tasks.test.ts`
  - `packages/infra-sqlite/src/index.ts`
  - `packages/infra-sqlite/src/mappers/task-mappers.ts`
  - `packages/infra-sqlite/src/repositories/task-repositories.test.ts`
  - `packages/infra-sqlite/src/repositories/task-repositories.ts`

**Resumo do Codex:**

> M4.5 concluído. Implementei os repositórios SQLite de tarefas, envolvimentos, linha do tempo e aberturas, com isolamento por organização. Também alinhei o fake e o contrato para ordenar eventos do mais recente ao mais antigo.
>
> `pnpm check` passou: 641 testes. Registrei as notas em [PROGRESS.md](/home/peeddrroolg/Área%20de%20trabalho/Projetos/agilebox-handoff/PROGRESS.md:279) e marquei `.loop/status` como `DONE`.
