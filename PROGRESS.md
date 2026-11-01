# Progresso da construção

Lido pelo laço do Codex (`scripts/codex-loop/run.sh`). Regras:

- `- [ ]` pendente · `- [x]` feito (marcado **pelo script** quando as verificações passam) · `- [!]` bloqueado (ver `.loop/blocked.md`).
- O laço executa **o primeiro `- [ ]`** da lista.
- Linhas com **`PARADA`** ou **`[manual]`** param o laço. Para liberar, o Pedro revisa e troca `- [ ]` por `- [x]`.
- Seções do `docs/PLANO.md` são citadas como "PLANO 3.6".

---

## M1 · Esqueleto do monorepo (PLANO 9 · M1, 10)

- [x] M1.1 Raiz do workspace
  - Arquivos: `package.json` (privado, `"type": "module"`, `engines.node >= 22`, scripts `format` e `format:check`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `onlyBuiltDependencies: [better-sqlite3, electron, esbuild]`), `.npmrc` (`node-linker=hoisted`), `.editorconfig`, `.prettierrc` (aspas simples, sem ponto e vírgula, largura 100), `.prettierignore` (`design/`, `node_modules`, `.loop/`, `migrations/`, `pnpm-lock.yaml`), completar `.gitignore`.
  - Deps: `root dev typescript`, `root dev prettier`.
  - Pronto: `pnpm format:check` passa.
  - Notas da rodada: criadas as configurações de raiz do workspace, formatação e editor; `.gitignore` ampliado para cache do TypeScript e empacotamento. Solicitadas as dependências `typescript` e `prettier` via `.loop/deps.txt`. Validações pendentes até a instalação pelo laço; scripts de lint, tipos e testes pertencem aos próximos passos do M1. Checkbox mantido pendente.
  - Notas da retomada: configurações do M1.1 conferidas com PLANO 9 · M1 e 10; `typescript` e `prettier` já instalados. Aplicada a formatação do Prettier aos documentos existentes para atender ao `format:check` da raiz. Validação: `pnpm format:check` passou; verificações de lint, tipos e testes executadas com `--if-present`, pois seus scripts serão criados em M1.2, M1.4 e M1.5. Nenhum pacote adicional necessário; checkbox mantido pendente para o laço.
  - Notas desta conferência: todos os arquivos e subitens do M1.1 já atendem ao passo; nenhuma alteração de configuração ou dependência necessária. Não há `.loop/last-failure.log`. `pnpm format:check` passou; `lint`, `typecheck` e `test` foram invocados com `pnpm run --if-present`, conforme o script do laço, e não executaram verificações porque ainda não existem nesta etapa. Status `DONE`; checkbox preservado para o laço.

- [x] M1.2 TypeScript base e pacotes de domínio
  - Arquivos: `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `verbatimModuleSyntax`, `noEmit`); `packages/{core,contract,application,infra-sqlite}/` com `package.json` (nome `@agilebox/<pasta>`, `"exports": { ".": "./src/index.ts" }`, script `typecheck: tsc -p .`), `tsconfig.json` e `src/index.ts` (só `export {}`). Script de raiz `typecheck: pnpm -r --if-present typecheck`.
  - Dependências internas conforme PLANO 3.1 (ex.: `application` depende de `core` e `contract` com `workspace:*`).
  - Pronto: `pnpm typecheck` passa.
  - Notas da rodada: criado `tsconfig.base.json` com as opções estritas previstas e os quatro pacotes (`core`, `contract`, `application`, `infra-sqlite`), cada um com configuração herdada, exportação pública vazia e script de tipos. Dependências internas declaradas com `workspace:*` conforme PLANO 3.1; adicionado o script recursivo `typecheck` na raiz. Sem lógica de domínio ou aplicação nesta etapa e sem pacote externo novo. Validação: `format:check` e `typecheck` passaram nos quatro pacotes; `lint` e `test` invocados com `--if-present`, pois seus scripts pertencem a M1.5 e M1.4. O pnpm tentou verificar dependências automaticamente e encontrou restrição de escrita; comandos repetidos com essa verificação automática desativada, sem instalação. Checkbox preservado para o laço.

- [x] M1.3 Pacote ui e apps (placeholders)
  - Arquivos: `packages/ui/` (mesmo padrão, `jsx: react-jsx` no tsconfig, sem componentes ainda); `apps/desktop/` com `package.json` (`@agilebox/desktop`) e `src/main/index.ts` vazio (o Electron entra no M5); `apps/server/README.md` explicando o que vai morar ali (PLANO 13) e `package.json` mínimo (`@agilebox/server`, privado, sem scripts).
  - Deps: `@agilebox/ui dev @types/react`, `@agilebox/ui prod react`.
  - Pronto: `pnpm typecheck` passa.
  - Notas da rodada: criados `packages/ui` com exportação vazia, configuração TypeScript com `react-jsx` e dependência interna de `core`; `apps/desktop` com manifesto privado e entrada principal vazia; `apps/server` com manifesto mínimo sem scripts e README sobre API HTTP, Postgres e login no pós-MVP (PLANO 13). Não há `.loop/last-failure.log`. Solicitados `@types/react` e `react` via `.loop/deps.txt`; status `NEEDS_DEPS`. Verificações pendentes para a retomada após a instalação pelo laço; sem alterações em `core` ou `application` e sem checkbox marcado.
  - Notas da retomada: conferidos todos os placeholders com PLANO 3.1, 9 · M1, 10 e 13; React e seus tipos já declarados e instalados, sem necessidade de novos pacotes ou alterações de código. Não há `.loop/last-failure.log`. `format:check` e `typecheck` passaram, incluindo o pacote `ui`; `lint` e `test` foram invocados com `--if-present`, conforme o laço, e encerraram com sucesso sem executar verificações, pois os scripts serão criados em M1.5 e M1.4. Verificação automática de dependências do pnpm desativada para não instalar pacotes. Status `DONE`; checkbox preservado para o laço.

- [x] M1.4 Vitest
  - Arquivos: `vitest.config.ts` na raiz com `test.projects` apontando para cada pacote; ambiente `node` por padrão (jsdom só no `ui`, configurado mas sem testes ainda); `packages/core/src/sanity.test.ts` trivial. Scripts de raiz: `test` (`vitest run`), `test:watch`, `coverage` (provider v8).
  - Deps: `root dev vitest`, `root dev @vitest/coverage-v8`, `root dev jsdom`.
  - Pronto: `pnpm test` passa.
  - Notas da rodada: lidos os subitens do M1.4 e conferidas as referências do PLANO 8, 9 · M1 e 10. Não há `.loop/last-failure.log`. Os pacotes `vitest`, `@vitest/coverage-v8` e `jsdom` não estão declarados nem instalados; solicitados como dependências de desenvolvimento da raiz em `.loop/deps.txt`. Status `NEEDS_DEPS`; configuração, teste trivial e verificações pendentes para a retomada após a instalação pelo laço. Checkbox preservado.
  - Notas da retomada: dependências já declaradas e instaladas; sem `.loop/last-failure.log`. Criado `vitest.config.ts` com um projeto para cada pacote (`core`, `contract`, `application`, `infra-sqlite` e `ui`), ambiente Node por padrão e jsdom apenas no `ui`, ainda sem testes de interface. Adicionado teste trivial em `core` e scripts de raiz `test`, `test:watch` e `coverage`, com provider V8. Validação: `format:check`, `typecheck`, `test` (1 teste) e `coverage` passaram; a cobertura ainda não mede lógica de negócio, pois os cinco arquivos de produção estão vazios. `lint` invocado com `--if-present` encerrou com sucesso sem executar análise, pois o script pertence ao M1.5. Verificação automática de dependências do pnpm desativada; nenhum comando de instalação ou git executado. Status `DONE`; checkbox preservado para o laço.

- [x] M1.5 ESLint com fronteiras entre camadas
  - Arquivos: `eslint.config.js` (flat config, `typescript-eslint` com regras recomendadas e type-checked, `eslint-config-prettier`), e **fronteiras** da tabela PLANO 3.1 com `no-restricted-imports` por pasta (ex.: `apps/desktop/src/renderer/**` não pode importar `@agilebox/application` nem `@agilebox/infra-sqlite`; `packages/core/**` não importa nenhum `@agilebox/*`). `tooling/eslint-boundaries.test.ts`: usa a API do ESLint (`lintText` com `filePath` falso) e prova que **cada** fronteira dispara erro e que um import permitido passa. Incluir `tooling` nos projetos do Vitest. Script `lint`.
  - Deps: `root dev eslint`, `root dev typescript-eslint`, `root dev eslint-config-prettier`, `root dev @eslint/js`, `root dev globals`.
  - Pronto: `pnpm lint` e `pnpm test` passam.
  - Notas da rodada: lido o bloco completo do M1.5 e a tabela de fronteiras do PLANO 3.1. Não há `.loop/last-failure.log`. Os cinco pacotes exigidos (`eslint`, `typescript-eslint`, `eslint-config-prettier`, `@eslint/js` e `globals`) não estão declarados nem instalados; solicitados como dependências de desenvolvimento da raiz em `.loop/deps.txt`. Status `NEEDS_DEPS`; configuração, testes das fronteiras, inclusão de `tooling` no Vitest, script `lint` e verificações pendentes para a retomada após a instalação pelo laço. Checkbox preservado.
  - Notas desta retomada: os cinco pacotes de lint estão instalados e não há `.loop/last-failure.log`. Escritos primeiro os testes em `tooling/eslint-boundaries.test.ts` para todas as linhas da tabela 3.1, incluindo subcaminhos, imports de tipos, reexportações e casos permitidos; projeto `tooling` incluído no Vitest. A execução inicial (`pnpm test --project tooling`, com verificação automática de dependências desativada) falhou ao carregar `typescript-eslint`: a versão 8.72.1 rejeita explicitamente TypeScript 7.0.2 e declara suporte a `>=4.8.4 <6.1.0`. Solicitado `typescript@~6.0.0` na raiz via `.loop/deps.txt` para compatibilizar a ferramenta exigida, sem trocar a stack. Os dois arquivos alterados foram formatados. Status `NEEDS_DEPS`; configuração ESLint, script `lint` e verificações completas pendentes após a instalação pelo laço. Nenhum comando de instalação ou git executado; checkbox preservado.
  - Notas da conclusão: TypeScript 6.0.3 e dependências de lint já instalados; sem `.loop/last-failure.log`. Confirmada a falha inicial dos 180 testes pela ausência da configuração. Criado `eslint.config.js` em flat config com regras recomendadas do JavaScript e do TypeScript com informação de tipos, compatibilidade com Prettier e `no-restricted-imports` nas nove camadas da tabela 3.1; permissões cobrem subcaminhos e bloqueiam também pacotes internos futuros. Adicionado `tsconfig.eslint.json` para analisar pacotes, apps e ferramentas com tipos, além do script `lint` com tolerância zero a avisos. Mantido o projeto `tooling` no Vitest e acrescentado teste que comprova a regra `no-floating-promises` em um caminho real. Validação final: `format:check`, `lint`, `typecheck` e `test` passaram (182 testes no total). Verificação automática de dependências do pnpm desativada; nenhum pacote novo, comando de instalação ou git executado. Status `DONE`; checkbox preservado para o laço.

- [x] M1.6 Script `check` e convenções
  - Arquivos: script de raiz `check` (format:check, lint, typecheck, test em sequência). Em `PROGRESS.md`, nota com a lista de comandos. Remover `sanity.test.ts` se já houver outro teste; senão manter.
  - Pronto: `pnpm check` passa.
  - Comandos disponíveis: `pnpm format` aplica a formatação; `pnpm format:check` confere a formatação; `pnpm lint` verifica código e fronteiras; `pnpm typecheck` confere os tipos dos pacotes; `pnpm test` executa os testes; `pnpm test:watch` acompanha os testes; `pnpm coverage` mede cobertura; `pnpm check` executa `format:check`, `lint`, `typecheck` e `test`, nessa ordem, interrompendo na primeira falha.
  - Notas da rodada: adicionado o script de raiz `check` com as quatro verificações em sequência. Removido `packages/core/src/sanity.test.ts`, pois a suíte de fronteiras já cobre a execução real do Vitest; nenhuma lógica de domínio ou aplicação alterada. Sem `.loop/last-failure.log` e sem necessidade de dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 181 testes). Verificação automática de dependências do pnpm desativada durante a execução, sem comandos de instalação ou git. Convenções do `CLAUDE.md` reservadas à parada manual seguinte. Status `DONE`; checkbox preservado para o laço.

- [x] PARADA M1: revisão do Pedro (estrutura, configs, fronteiras). Preencher "Convenções" do `CLAUDE.md` com os comandos.
  - Revisão: `pnpm check` verde. Fechadas as lacunas das fronteiras (import relativo que sai da camada, `electron`/`better-sqlite3`/`drizzle-orm` e módulos do Node nas camadas puras e no renderer); tabela de camadas única em `tooling/layers.js`, usada pelo ESLint e pelos testes. TypeScript fixado em 6.0 (`docs/decisoes/0003-typescript-6.md`). Convenções do `CLAUDE.md` preenchidas.

---

## M2 · Domínio, `packages/core` (PLANO 4, 6, 9 · M2)

Testes primeiro em todos os passos. Nada de I/O, `Date.now()` ou aleatoriedade.

- [x] M2.1 IDs e erros
  - `shared/ids.ts`: tipos marcados (`OrganizationId`, `UserId`, `ContributorId`, `ProjectId`, `TaskId`, `ParticipationId`, `EventId`, `MeetingId`) e conversores. `shared/errors.ts`: `DomainError` com `code` (`VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`) e subclasses.
  - Pronto: testes de criação e de `code` de cada erro.
  - Notas da rodada: implementados os oito IDs marcados e conversores com validação de ULID, além dos erros tipados com seus quatro códigos. Os testes existentes foram executados antes da implementação e falharam pela ausência dos módulos; corrigido também o tipo auxiliar da tupla de conversores nos testes. Não há falha anterior nem dependência nova. Validação: `pnpm check` passou (formatação, lint, tipos e 372 testes). Checkbox mantido para o laço.

- [x] M2.2 Estado da tarefa
  - `values/task-status.ts`: `TASK_STATUSES` em ordem (`planning`, `todo`, `in_progress`, `review`, `done`), rótulos pt-BR (Planejamento, A fazer, Desenvolvendo, Revisar, Concluído), `isTaskStatus`, `parseTaskStatus`.
  - Pronto: ordem e rótulos testados.
  - Notas da rodada: implementados os cinco estados ordenados, rótulos em pt-BR, tipo `TaskStatus`, validação e conversão com erro `VALIDATION` para valores inválidos. Testes escritos primeiro e executados antes da implementação, falhando pela ausência do módulo. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 384 testes). Checkbox preservado para o laço.

- [x] M2.3 Dinheiro e horas
  - `values/money.ts` (centavos; `parseMoney("45,50")`, aceita `"45"`, `"45.5"`, `"R$ 45,50"`; rejeita negativo e texto inválido; `formatBRL`), `values/hours.ts` (centésimos; `parseHours("1,5") = 150`; formatação `1,5 h`).
  - Pronto: tabelas de casos (vírgula, ponto, vazio, negativo, muitos decimais com arredondamento meio para cima).
  - Notas da rodada: testes escritos e executados antes da implementação, com falha inicial pela ausência dos módulos. Implementados conversão e formatação de dinheiro em centavos e horas em centésimos, arredondamento decimal meio para cima, validação de valores seguros e soma de dinheiro. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 426 testes), após corrigir espaço não separável sinalizado pelo lint. Checkbox preservado para o laço.

- [x] M2.4 Datas
  - `values/date-only.ts`: `DateOnly` (`YYYY-MM-DD`), validação, comparação, `diffInDays(a, b)`, `toDateOnly(date, timeZone)` para obter a data local a partir de um instante.
  - Pronto: viradas de mês/ano, ano bissexto, data inválida rejeitada.
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência do módulo. Implementados validação de datas gregorianas, comparação, diferença em dias de calendário (de `a` até `b`) e conversão de instante no fuso informado; cobertas viradas, anos bissextos e entradas inválidas. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 449 testes). Checkbox preservado para o laço.

- [x] M2.5 Chamado e papéis
  - `values/ticket.ts` (ID numérico positivo obrigatório; `url` opcional, só `http(s)`), `values/role.ts` (`UserRole`: `collaborator` | `manager`; `ParticipationRole`: `responsible` | `support`).
  - Pronto: casos válidos e inválidos.
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência dos módulos. Implementados chamado com ID inteiro positivo seguro e link opcional HTTP(S), além dos tipos e validações dos papéis de usuário e participação. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 475 testes). Checkbox preservado para o laço.

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
