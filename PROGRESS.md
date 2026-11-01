# Progresso da construção

Lido pelo laço do Codex (`scripts/codex-loop/run.sh`). Regras:
- `- [ ]` pendente · `- [x]` feito (marcado **pelo script** quando as verificações passam) · `- [!]` bloqueado (ver `.loop/blocked.md`).
- O laço executa **o primeiro `- [ ]`** da lista.
- Linhas com **`PARADA`** ou **`[manual]`** param o laço. Para liberar, o Pedro revisa e troca `- [ ]` por `- [x]`.
- Seções do `docs/PLANO.md` são citadas como "PLANO 3.6".

---

## M1 · Esqueleto do monorepo (PLANO 9 · M1, 10)

- [ ] M1.1 Raiz do workspace
  - Arquivos: `package.json` (privado, `"type": "module"`, `engines.node >= 22`, scripts `format` e `format:check`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `onlyBuiltDependencies: [better-sqlite3, electron, esbuild]`), `.npmrc` (`node-linker=hoisted`), `.editorconfig`, `.prettierrc` (aspas simples, sem ponto e vírgula, largura 100), `.prettierignore` (`design/`, `node_modules`, `.loop/`, `migrations/`, `pnpm-lock.yaml`), completar `.gitignore`.
  - Deps: `root dev typescript`, `root dev prettier`.
  - Pronto: `pnpm format:check` passa.

- [ ] M1.2 TypeScript base e pacotes de domínio
  - Arquivos: `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `verbatimModuleSyntax`, `noEmit`); `packages/{core,contract,application,infra-sqlite}/` com `package.json` (nome `@agilebox/<pasta>`, `"exports": { ".": "./src/index.ts" }`, script `typecheck: tsc -p .`), `tsconfig.json` e `src/index.ts` (só `export {}`). Script de raiz `typecheck: pnpm -r --if-present typecheck`.
  - Dependências internas conforme PLANO 3.1 (ex.: `application` depende de `core` e `contract` com `workspace:*`).
  - Pronto: `pnpm typecheck` passa.

- [ ] M1.3 Pacote ui e apps (placeholders)
  - Arquivos: `packages/ui/` (mesmo padrão, `jsx: react-jsx` no tsconfig, sem componentes ainda); `apps/desktop/` com `package.json` (`@agilebox/desktop`) e `src/main/index.ts` vazio (o Electron entra no M5); `apps/server/README.md` explicando o que vai morar ali (PLANO 13) e `package.json` mínimo (`@agilebox/server`, privado, sem scripts).
  - Deps: `@agilebox/ui dev @types/react`, `@agilebox/ui prod react`.
  - Pronto: `pnpm typecheck` passa.

- [ ] M1.4 Vitest
  - Arquivos: `vitest.config.ts` na raiz com `test.projects` apontando para cada pacote; ambiente `node` por padrão (jsdom só no `ui`, configurado mas sem testes ainda); `packages/core/src/sanity.test.ts` trivial. Scripts de raiz: `test` (`vitest run`), `test:watch`, `coverage` (provider v8).
  - Deps: `root dev vitest`, `root dev @vitest/coverage-v8`, `root dev jsdom`.
  - Pronto: `pnpm test` passa.

- [ ] M1.5 ESLint com fronteiras entre camadas
  - Arquivos: `eslint.config.js` (flat config, `typescript-eslint` com regras recomendadas e type-checked, `eslint-config-prettier`), e **fronteiras** da tabela PLANO 3.1 com `no-restricted-imports` por pasta (ex.: `apps/desktop/src/renderer/**` não pode importar `@agilebox/application` nem `@agilebox/infra-sqlite`; `packages/core/**` não importa nenhum `@agilebox/*`). `tooling/eslint-boundaries.test.ts`: usa a API do ESLint (`lintText` com `filePath` falso) e prova que **cada** fronteira dispara erro e que um import permitido passa. Incluir `tooling` nos projetos do Vitest. Script `lint`.
  - Deps: `root dev eslint`, `root dev typescript-eslint`, `root dev eslint-config-prettier`, `root dev @eslint/js`, `root dev globals`.
  - Pronto: `pnpm lint` e `pnpm test` passam.

- [ ] M1.6 Script `check` e convenções
  - Arquivos: script de raiz `check` (format:check, lint, typecheck, test em sequência). Em `PROGRESS.md`, nota com a lista de comandos. Remover `sanity.test.ts` se já houver outro teste; senão manter.
  - Pronto: `pnpm check` passa.

- [ ] PARADA M1: revisão do Pedro (estrutura, configs, fronteiras). Preencher "Convenções" do `CLAUDE.md` com os comandos.

---

## M2 · Domínio, `packages/core` (PLANO 4, 6, 9 · M2)

Testes primeiro em todos os passos. Nada de I/O, `Date.now()` ou aleatoriedade.

- [ ] M2.1 IDs e erros
  - `shared/ids.ts`: tipos marcados (`OrganizationId`, `UserId`, `ContributorId`, `ProjectId`, `TaskId`, `ParticipationId`, `EventId`, `MeetingId`) e conversores. `shared/errors.ts`: `DomainError` com `code` (`VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`) e subclasses.
  - Pronto: testes de criação e de `code` de cada erro.

- [ ] M2.2 Estado da tarefa
  - `values/task-status.ts`: `TASK_STATUSES` em ordem (`planning`, `todo`, `in_progress`, `review`, `done`), rótulos pt-BR (Planejamento, A fazer, Desenvolvendo, Revisar, Concluído), `isTaskStatus`, `parseTaskStatus`.
  - Pronto: ordem e rótulos testados.

- [ ] M2.3 Dinheiro e horas
  - `values/money.ts` (centavos; `parseMoney("45,50")`, aceita `"45"`, `"45.5"`, `"R$ 45,50"`; rejeita negativo e texto inválido; `formatBRL`), `values/hours.ts` (centésimos; `parseHours("1,5") = 150`; formatação `1,5 h`).
  - Pronto: tabelas de casos (vírgula, ponto, vazio, negativo, muitos decimais com arredondamento meio para cima).

- [ ] M2.4 Datas
  - `values/date-only.ts`: `DateOnly` (`YYYY-MM-DD`), validação, comparação, `diffInDays(a, b)`, `toDateOnly(date, timeZone)` para obter a data local a partir de um instante.
  - Pronto: viradas de mês/ano, ano bissexto, data inválida rejeitada.

- [ ] M2.5 Chamado e papéis
  - `values/ticket.ts` (ID numérico positivo obrigatório; `url` opcional, só `http(s)`), `values/role.ts` (`UserRole`: `collaborator` | `manager`; `ParticipationRole`: `responsible` | `support`).
  - Pronto: casos válidos e inválidos.

- [ ] M2.6 Organização, usuário, entidade, projeto
  - `entities/organization.ts`, `entities/user.ts` (iniciais a partir do nome, valor/hora padrão), `entities/contributor.ts` (stakeholder: nome, origem `manual`|`azure`, valor/hora padrão; **sem** vínculo com usuário, PLANO 2.6), `entities/project.ts` (nome obrigatório, `nameKey` normalizado: sem acentos, minúsculo, espaços colapsados).
  - Pronto: validações e normalização testadas.

- [ ] M2.7 Tarefa e envolvimento
  - `entities/participation.ts`: participante `{ kind: 'user', userId } | { kind: 'contributor', contributorId }`, papel, horas, valor copiado; `responsible` só com usuário. `entities/task.ts`: criação (Responsável = criador, PLANO 2.1), renomear, descrição, estado, prazo, chamado, trocar responsável, adicionar/remover envolvido (sem duplicar; exatamente um responsável; não remove o responsável sem trocar), `searchText`.
  - Pronto: todas as invariantes com teste.

- [ ] M2.8 Eventos e agendamento
  - `entities/timeline-event.ts`: união discriminada dos tipos da PLANO 6.4 com payloads tipados. `entities/meeting.ts`: título obrigatório, data `DateOnly`, hora `HH:mm`, participantes (usuários).
  - Pronto: construção e validação testadas.

- [ ] M2.9 Ator e política de acesso
  - `policies/actor.ts` (`{ userId, organizationId, role }`), `policies/access-policy.ts`: **toda** a matriz PLANO 6.1 (`participates`, `canViewTask`, `canEditTask`, `isReadOnlyFor`, `canCreateTask`, `canManageMembers`, `canSeeProject`, `canSeeRate`, `canEditRate`, `canSeeTaskTotal`, `canManageMeetings`, `canSeeDashboard`) + `isManagerEdit` (sempre verdadeiro para gestor). Entidades nunca concedem acesso. Organização diferente = sem acesso.
  - Pronto: um teste por linha **e** coluna da matriz (permitido e negado), mais isolamento de organização.

- [ ] M2.10 Custo e prazo
  - `rules/cost.ts` (subtotal, total; PLANO 6.2), `rules/deadline-label.ts` (frases da PLANO 6.3, recebe `today: DateOnly`).
  - Pronto: tabelas de casos, incluindo "Concluída" com prazo vencido.

- [ ] M2.11 Linha do tempo
  - `rules/timeline.ts`: `diffTask(before, after)` → um evento por campo mudado; eventos de envolvimento; `describeEvent(event, viewer, names)` em pt-BR ("moveu de A fazer para Desenvolvendo"), omitindo R$ quando `canSeeRate` é falso.
  - Pronto: um teste por tipo de evento; teste explícito de que o colaborador não vê o valor de outra pessoa.

- [ ] M2.12 Dashboard
  - `rules/dashboard.ts`: % por estado somando 100 (maior resto), estatísticas por colaborador (nº de tarefas de que participa, distribuição, % concluído).
  - Pronto: casos com 0 tarefas, 1 tarefa, arredondamentos difíceis (ex.: 3 tarefas em 3 estados).

- [ ] M2.13 Fechamento do core
  - `src/index.ts` exportando a API pública; limite de cobertura ≥ 95% de linhas para `packages/core` no Vitest; remover `sanity.test.ts`.
  - Pronto: `pnpm check` e `pnpm coverage` passam.

- [ ] PARADA M2: Pedro revisa a matriz de acesso nos testes do M2.9 e as frases da linha do tempo.

---

## M3 · Contrato e aplicação (PLANO 3.2, 3.5, 3.6, 7, 8, 9 · M3)

- [ ] M3.1 Base do contrato
  - `contract/src/result.ts`, `errors.ts` (`ApiError`, códigos iguais ao `DomainError`), `changes.ts`, `channels.ts`.
  - Deps: `@agilebox/contract prod zod`.
  - Pronto: tipos compilam; testes do envelope de resultado.

- [ ] M3.2 Schemas: sessão, usuários, projetos, entidades
  - zod de entrada e saída + tipos inferidos (DTOs). Valores em R$ como `number | null` (null = sem permissão).
  - Pronto: testes de aceitar/rejeitar.

- [ ] M3.3 Schemas: tarefas, envolvimentos, linha do tempo
  - Inclui `listTeamBoard`, participante discriminado (`kind`), `canEdit`/`readOnly` no detalhe.
  - Pronto: testes de aceitar/rejeitar (vírgula, vazio, IDs inválidos).

- [ ] M3.4 Schemas: dashboard e agenda; `AgileBoxApi` e `DesktopShellApi`
  - `api.ts` com todos os métodos da PLANO 7; `shell-api.ts`.
  - Pronto: `pnpm typecheck`; teste que garante que cada método da API tem canal e schemas.

- [ ] M3.5 Portas da aplicação
  - `application/src/ports/*` (PLANO 10), todas assíncronas, com `organizationId` como primeiro parâmetro (PLANO 3.6, 3.7). `deps.ts` (`AppDeps`).
  - Pronto: `pnpm typecheck`.

- [ ] M3.6 Fakes e builders
  - `testing/fakes/*` (repositórios em memória, `InMemoryUnitOfWork` que desfaz em erro, `FixedClock`, `SequentialIdGenerator`, `RecordingNotifier`), `testing/builders.ts`. Exportar por `@agilebox/application/testing` (entrada `exports` separada).
  - Pronto: testes dos fakes (inclusive rollback).

- [ ] M3.7 Suíte de contrato dos repositórios
  - `testing/repository-contract.ts`: `describeRepositoryContract(name, makeAdapters)`, com CRUD, ordenações (Recentes, Frequentes), busca sem acentos, unicidade por organização e **isolamento entre organizações**. Rodar contra os fakes.
  - Pronto: suíte verde nos fakes.

- [ ] M3.8 Mappers
  - `mappers/*`: entidade → DTO, aplicando `canSeeRate` e `canSeeTaskTotal` (R$ = `null`), `canEdit`/`readOnly`.
  - Pronto: testes de que o colaborador nunca recebe R$ de outro nem o total.

- [ ] M3.9 Casos de uso: sessão, usuários, projetos
  - `session/*`, `users/set-default-rate`, `projects/*` (criar devolve existente pelo `nameKey`; criador vira membro; membros só por criador/gestor).
  - Pronto: para cada um, sucesso, negado, inválido e notificação.

- [ ] M3.10 Casos de uso: entidades
  - `contributors/*` (criar, listar, valor padrão só pelo gestor).
  - Pronto: idem.

- [ ] M3.11 Casos de uso: criar, ver, editar e mover tarefa
  - `create-task` (evento `task_created`; responsável = criador), `get-task-detail` (+ `readOnly`), `update-task` (diff → eventos na mesma transação; `as_manager`), `move-task`.
  - Pronto: eventos verificados; transação desfeita se gravar evento falhar.

- [ ] M3.12 Casos de uso: listas de tarefas
  - `list-board` ("Minhas tarefas", filtro por projeto, `forUserId` só gestor), `list-team-board`, `list-recent`, `list-frequent`, `search-tasks`, `record-open`.
  - Pronto: ordenações e filtros de acesso testados.

- [ ] M3.13 Casos de uso: envolvimentos
  - `add` (copia o valor padrão, PLANO 2.4), `remove`, `set-hours`, `set-rate` (atualiza o padrão do envolvido; permissão PLANO 2.3). Todos geram eventos.
  - Pronto: idem M3.11.

- [ ] M3.14 Casos de uso: linha do tempo e dashboard
  - `list-timeline` (texto por viewer, mais recente primeiro), `get-dashboard` (só gestor).
  - Pronto: testes de permissão e de texto.

- [ ] M3.15 Casos de uso: agenda
  - `list-month`, `list-upcoming`, `create`, `update`, `delete` (só gestor grava).
  - Pronto: idem.

- [ ] M3.16 `createUseCases` e roteiro
  - `create-use-cases.ts` (DI manual), `index.ts`; teste "roteiro" da PLANO 9 · M3 ponta a ponta com fakes; cobertura ≥ 90% em `packages/application`.
  - Pronto: `pnpm check` e `pnpm coverage`.

- [ ] PARADA M3: Pedro revisa os casos de uso e o roteiro.

---

## M4 · SQLite, `packages/infra-sqlite` (PLANO 3.7, 5, 9 · M4)

- [ ] M4.1 Cliente e configuração
  - `client.ts` (abre o arquivo ou `:memory:`, pragmas WAL e `foreign_keys`), `drizzle.config.ts`.
  - Deps: `@agilebox/infra-sqlite prod drizzle-orm`, `@agilebox/infra-sqlite prod better-sqlite3`, `@agilebox/infra-sqlite dev drizzle-kit`, `@agilebox/infra-sqlite dev @types/better-sqlite3`.
  - Pronto: teste abre banco em memória e confere os pragmas.

- [ ] M4.2 Schema: organização, usuários, entidades, projetos, membros
  - Pronto: `pnpm typecheck`.

- [ ] M4.3 Schema: tarefas, envolvimentos, eventos, aberturas, agenda, `local_settings`; migração inicial
  - CHECKs e índices da PLANO 5 (inclusive índice parcial de um `responsible`). Gerar `migrations/` com `drizzle-kit generate` (script `db:generate`). Aplicar migrações em `client.ts`.
  - Pronto: teste aplica as migrações num banco vazio e confere as tabelas.

- [ ] M4.4 Mappers e repositórios: organização, usuários, entidades, projetos
  - Pronto: a parte correspondente da suíte de contrato passa no SQLite.

- [ ] M4.5 Repositórios: tarefas, envolvimentos, linha do tempo, aberturas
  - Pronto: idem.

- [ ] M4.6 Repositório de agenda, `SqliteUnitOfWork`, `createSqliteAdapters`
  - Pronto: suíte de contrato **inteira** passa no SQLite em memória; teste de rollback.

- [ ] M4.7 Seed e scripts
  - `seed/data.ts` (PLANO 9 · M4; nomes do protótipo), `seed/seed.ts` usando os **casos de uso** (para gerar linha do tempo real), `scripts/` e comandos `db:migrate`, `db:seed`, `db:reset` (banco em `./.data/agilebox.db`, no `.gitignore`).
  - Pronto: teste roda o seed em memória e confere contagens.

- [ ] M4.8 Nota sobre ABI do better-sqlite3
  - Escrever `docs/decisoes/0002-better-sqlite3-abi.md` com a estratégia para Node (testes) × Electron (app) (PLANO 11 · R2), sem rodar Electron.
  - Pronto: documento escrito; `pnpm check` passa.

- [ ] PARADA M4: Pedro roda `pnpm db:reset && pnpm db:seed` e confere o banco.

---

## M5 a M10 · a detalhar depois da revisão do M4

Os passos destes marcos serão escritos depois do M4, com o Pedro. Eles dependem do spike de vidro no Windows e de revisão visual. Referência: PLANO 9.

- [ ] PARADA M5: detalhar passos (shell Electron, IPC, UI base). [manual] spike de vidro no Windows 11.
- [ ] PARADA M6: detalhar passos (painel: kanban e detalhe).
- [ ] PARADA M7: detalhar passos (permissões e gestor).
- [ ] PARADA M8: detalhar passos (agenda).
- [ ] PARADA M9: detalhar passos (bandeja).
- [ ] PARADA M10: [manual] empacotamento e checklist no Windows 11.
