# Progresso da construção

Lido pelo laço do Codex (`scripts/codex-loop/run.sh`). Regras:

- `- [ ]` pendente · `- [x]` feito (marcado **pelo script** quando as verificações passam) · `- [!]` bloqueado (ver `.loop/blocked.md`).
- O laço executa **o primeiro `- [ ]`** da lista.
- Linhas **`PARADA`** são pontos de verificação: no modo contínuo o script roda as verificações e a cobertura do marco, escreve `docs/laco/relatorio-<marco>.md`, marca a linha, comita e cria a tag `marco-<Mx>`, sem parar (`STOP_AT_PARADA=1` para parar). Passos **`[manual]`** sempre param o laço.
- Seções do `docs/PLANO.md` são citadas como "PLANO 3.6".

---

## M1 · Esqueleto do monorepo (PLANO 9 · M1, 10)

- [x] M1.1 Raiz do workspace
  - Arquivos: `package.json` (privado, `"type": "module"`, `engines.node >= 22`, scripts `format` e `format:check`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `allowBuilds` para `better-sqlite3`, `electron` e `esbuild` (pnpm 11+; `onlyBuiltDependencies` é ignorado) e `strictDepBuilds: false`), `.npmrc` (`node-linker=hoisted`), `.editorconfig`, `.prettierrc` (aspas simples, sem ponto e vírgula, largura 100), `.prettierignore` (`design/`, `node_modules`, `.loop/`, `migrations/`, `pnpm-lock.yaml`), completar `.gitignore`.
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

- [x] M2.6 Organização, usuário, entidade, projeto
  - `entities/organization.ts`, `entities/user.ts` (iniciais a partir do nome, valor/hora padrão), `entities/contributor.ts` (stakeholder: nome, origem `manual`|`azure`, valor/hora padrão; **sem** vínculo com usuário, PLANO 2.6), `entities/project.ts` (nome obrigatório, `nameKey` normalizado: sem acentos, minúsculo, espaços colapsados).
  - Pronto: validações e normalização testadas.
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência das entidades. Criadas as quatro entidades com nomes obrigatórios, iniciais do primeiro e último nomes, valor/hora padrão positivo em centavos, validação de papel e origem, e chave de projeto normalizada; stakeholders não têm vínculo com conta. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 490 testes). Checkbox preservado para o laço.

- [x] M2.7 Tarefa e envolvimento
  - `entities/participation.ts`: participante `{ kind: 'user', userId } | { kind: 'contributor', contributorId }`, papel, horas, valor copiado; `responsible` só com usuário. `entities/task.ts`: criação (Responsável = criador, PLANO 2.1), renomear, descrição, estado, prazo, chamado, trocar responsável, adicionar/remover envolvido (sem duplicar; exatamente um responsável; não remove o responsável sem trocar), `searchText`.
  - Pronto: todas as invariantes com teste.
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência dos módulos. Implementadas tarefa e participação imutáveis, responsável inicial criador, troca entre usuários participantes, validação e prevenção de duplicatas, campos editáveis e busca normalizada por título e projeto. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 495 testes). Checkbox preservado para o laço.

- [x] M2.8 Eventos e agendamento
  - `entities/timeline-event.ts`: união discriminada dos tipos da PLANO 6.4 com payloads tipados. `entities/meeting.ts`: título obrigatório, data `DateOnly`, hora `HH:mm`, participantes (usuários).
  - Pronto: construção e validação testadas.
  - Notas da rodada: testes escritos primeiro e executados com falha inicial pela ausência das entidades. Criados os onze tipos de evento com payloads tipados e metadados de autoria, e agendamentos com título obrigatório, data validada, hora local HH:mm e participantes usuários. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 505 testes). Checkbox preservado para o laço.

- [x] M2.9 Ator e política de acesso
  - `policies/actor.ts` (`{ userId, organizationId, role }`), `policies/access-policy.ts`: **toda** a matriz PLANO 6.1 (`participates`, `canViewTask`, `canEditTask`, `isReadOnlyFor`, `canCreateTask`, `canManageMembers`, `canSeeProject`, `canSeeRate`, `canEditRate`, `canSeeTaskTotal`, `canManageMeetings`, `canSeeDashboard`) + `isManagerEdit` (sempre verdadeiro para gestor). Entidades nunca concedem acesso. Organização diferente = sem acesso.
  - Pronto: um teste por linha **e** coluna da matriz (permitido e negado), mais isolamento de organização.
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da política. Implementados ator e políticas puras para participação, tarefas, projetos, valores, agenda e dashboard, com isolamento por organização e entidades sem acesso. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 510 testes). Checkbox preservado para o laço.

- [x] M2.10 Custo e prazo
  - `rules/cost.ts` (subtotal, total; PLANO 6.2), `rules/deadline-label.ts` (frases da PLANO 6.3, recebe `today: DateOnly`).
  - Pronto: tabelas de casos, incluindo "Concluída" com prazo vencido.
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência das regras. Implementados subtotal com arredondamento meio para cima em aritmética inteira, soma dos subtotais e frases de prazo por dias de calendário, priorizando tarefas concluídas. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 523 testes). Checkbox preservado para o laço.

- [x] M2.11 Linha do tempo
  - `rules/timeline.ts`: `diffTask(before, after)` → um evento por campo mudado; eventos de envolvimento; `describeEvent(event, viewer, names)` em pt-BR ("moveu de A fazer para Desenvolvendo"), omitindo R$ quando `canSeeRate` é falso.
  - Pronto: um teste por tipo de evento; teste explícito de que o colaborador não vê o valor de outra pessoa.
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da regra. Implementados diffs dos campos e envolvimentos, incluindo troca de responsável e comparação de chamados por conteúdo, além de descrições em pt-BR com filtro de valores pela política de acesso e organização. Testados os onze tipos e a ocultação de valores de terceiros. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 525 testes). Checkbox preservado para o laço.

- [x] M2.12 Dashboard
  - `rules/dashboard.ts`: % por estado somando 100 (maior resto), estatísticas por colaborador (nº de tarefas de que participa, distribuição, % concluído).
  - Pronto: casos com 0 tarefas, 1 tarefa, arredondamentos difíceis (ex.: 3 tarefas em 3 estados).
  - Notas da rodada: testes escritos primeiro e executados com falha pela ausência da regra. Implementadas distribuições percentuais pelo maior resto, com desempate pela ordem dos estados, e estatísticas por usuário usando a política de participação e isolamento por organização. A decisão sobre incluir gestores na tabela permanece em aberto para a etapa de interface. Sem falha anterior ou dependências novas. Validação: `pnpm check` passou (formatação, lint, tipos e 528 testes). Checkbox preservado para o laço.

- [x] M2.13 Fechamento do core
  - `src/index.ts` exportando a API pública; limite de cobertura ≥ 95% de linhas para `packages/core` no Vitest; remover `sanity.test.ts`.
  - Pronto: `pnpm check` e `pnpm coverage` passam.
  - Notas da rodada: API pública do core exporta valores, entidades, políticas, regras e erros; teste da entrada escrito antes da implementação e confirmado com falha inicial. Configurado limite de 95% de linhas para o core; `sanity.test.ts` já havia sido removido. O teste existente de ESLint precisou de prazo maior para analisar a nova entrada durante a cobertura. Sem falha anterior ou dependência nova. Validação: `pnpm check` e `pnpm coverage` passaram (529 testes; 99,58% de linhas no relatório atual). Checkbox preservado para o laço.

- [x] PARADA M2: Pedro revisa a matriz de acesso nos testes do M2.9 e as frases da linha do tempo.

---

## M3 · Contrato e aplicação (PLANO 3.2, 3.5, 3.6, 7, 8, 9 · M3)

- [x] M3.1 Base do contrato
  - `contract/src/result.ts`, `errors.ts` (`ApiError`, códigos iguais ao `DomainError`), `changes.ts`, `channels.ts`.
  - Deps: `@agilebox/contract prod zod`.
  - Pronto: tipos compilam; testes do envelope de resultado.
  - Nota: Criados o envelope discriminado de resultado, `ApiError`, eventos de mudança e canais da API e da janela; exportados pela entrada do pacote.
  - Nota: `zod` já estava declarado como dependência de produção; sem dependências novas.
  - Nota: Teste do envelope primeiro falhou sem a implementação; `pnpm check` passou após `pnpm format` (531 testes).

- [x] M3.2 Schemas: sessão, usuários, projetos, entidades
  - zod de entrada e saída + tipos inferidos (DTOs). Valores em R$ como `number | null` (null = sem permissão).
  - Pronto: testes de aceitar/rejeitar.
  - Nota: schemas e DTOs inferidos para sessão, usuários, projetos, membros e entidades; setters recebem centavos e DTOs usam valores em R$ ou `null`.
  - Nota: testes de aceitação/rejeição adicionados antes da implementação. `pnpm check` passou (formatação, lint, tipos e 547 testes); sem dependências novas.

- [x] M3.3 Schemas: tarefas, envolvimentos, linha do tempo
  - Inclui `listTeamBoard`, participante discriminado (`kind`), `canEdit`/`readOnly` no detalhe.
  - Pronto: testes de aceitar/rejeitar (vírgula, vazio, IDs inválidos).
  - Nota: Criados schemas de tarefas, filtros de quadros, detalhe com permissões, envolvimentos discriminados e eventos da linha do tempo; exportados pela entrada do contrato.
  - Nota: Testes escritos antes da implementação cobrem IDs inválidos, campos vazios, horas com vírgula, visibilidade de valor/hora e validações de papel. `pnpm check` passou (560 testes), sem dependências novas.

- [x] M3.4 Schemas: dashboard e agenda; `AgileBoxApi` e `DesktopShellApi`
  - `api.ts` com todos os métodos da PLANO 7; `shell-api.ts`.
  - Pronto: `pnpm typecheck`; teste que garante que cada método da API tem canal e schemas.
  - Nota: Schemas de dashboard e agenda e interfaces `AgileBoxApi`/`DesktopShellApi` implementados; registry valida canal e schemas para todos os métodos da seção 7.
  - Nota: Agenda usa IDs de usuários como participantes, seguindo o modelo da seção 5; decisão 12.5 registrada para confirmação antes do M8.
  - Nota: `pnpm check` passou após corrigir um exemplo de teste que somava 100% e, por isso, era válido.

- [x] M3.5 Portas da aplicação
  - `application/src/ports/*` (PLANO 10), todas assíncronas, com `organizationId` como primeiro parâmetro (PLANO 3.6, 3.7). `deps.ts` (`AppDeps`).
  - Pronto: `pnpm typecheck`.
  - Nota: Criadas as portas assíncronas de repositórios, transação, relógio, IDs e notificação; `AppDeps` e exportações públicas adicionados.
  - Nota: Teste de tipos cobre assinaturas assíncronas e `organizationId` em primeiro lugar; aplicado também a `Clock` e `IdGenerator`, conforme texto do passo, embora PLANO 3.6 restrinja a regra explicitamente aos repositórios.
  - Nota: `pnpm check` passou (formatação, lint, tipos e 566 testes); sem dependências novas.

- [x] M3.6 Fakes e builders
  - `testing/fakes/*` (repositórios em memória, `InMemoryUnitOfWork` que desfaz em erro, `FixedClock`, `SequentialIdGenerator`, `RecordingNotifier`), `testing/builders.ts`. Exportar por `@agilebox/application/testing` (entrada `exports` separada).
  - Pronto: testes dos fakes (inclusive rollback).
  - Nota: Fakes em memória para as portas, relógio, IDs sequenciais, notificações gravadas e builders de usuários, projetos, entidades, tarefas, envolvimentos e reuniões; exportação separada `@agilebox/application/testing`.
  - Nota: Testes cobrem relógio, sequência de IDs, notificação, isolamento por organização e rollback do `UnitOfWork`; `pnpm check` passou (571 testes), sem dependências novas.

- [x] M3.7 Suíte de contrato dos repositórios
  - `testing/repository-contract.ts`: `describeRepositoryContract(name, makeAdapters)`, com CRUD, ordenações (Recentes, Frequentes), busca sem acentos, unicidade por organização e **isolamento entre organizações**. Rodar contra os fakes.
  - Pronto: suíte verde nos fakes.
  - Nota: Contrato reutilizável criado e executado nos repositórios em memória; cobre gravação/leitura, remoção, Recentes, Frequentes, busca sem acentos, chave de projeto por organização e isolamento. `pnpm check` passou (576 testes), sem dependências novas.

- [x] M3.8 Mappers
  - `mappers/*`: entidade → DTO, aplicando `canSeeRate` e `canSeeTaskTotal` (R$ = `null`), `canEdit`/`readOnly`.
  - Pronto: testes de que o colaborador nunca recebe R$ de outro nem o total.
  - Nota: Mappers de usuário, entidade, projeto, tarefa, envolvimento, agenda, linha do tempo e dashboard exportados pela aplicação; tarifas e total em reais são filtrados pelas políticas do domínio.
  - Nota: DTO de detalhe inclui `total` em reais ou `null`; cobertura verifica tarifas ocultas para colaborador, total apenas para gestor e detalhe somente leitura para membro.
  - Nota: `pnpm check` passou (579 testes), sem dependências novas.

- [x] M3.9 Casos de uso: sessão, usuários, projetos
  - `session/*`, `users/set-default-rate`, `projects/*` (criar devolve existente pelo `nameKey`; criador vira membro; membros só por criador/gestor).
  - Pronto: para cada um, sucesso, negado, inválido e notificação.
  - Nota: Casos de sessão, tarifa padrão, listagem/criação de projetos e gestão de membros implementados com testes de acesso, validação, notificações e isolamento por organização.
  - Nota: `ActorSession` foi incluída como porta da aplicação; a troca de usuário publica `session`, e mudanças de tarifa e projeto publicam seus respectivos tipos.
  - Nota: `pnpm check` passou (593 testes), sem dependências novas.

- [x] M3.10 Casos de uso: entidades
  - `contributors/*` (criar, listar, valor padrão só pelo gestor).
  - **Decisão do Pedro (desbloqueio, PLANO 6.2):** valor/hora padrão **0 = "não definido"**. A criação continua `create({ name })` (qualquer usuário cria; o contrato não muda), com origem `manual`, `createdBy` = ator e valor padrão 0. Custo é R$ 0 até o gestor definir o valor. O domínio passa a **aceitar 0** no valor padrão (`validateDefaultRate` vale para entidade **e** usuário; continua rejeitando negativo e fracionário). A exigência de **maior que zero** fica só em **definir ou alterar** o valor padrão (`setDefaultRate`, `rateCentsSchema` do contrato e valor digitado na tarefa). Atualizar os testes do `core` que hoje exigem rejeição de 0 na criação, e acrescentar casos: criar com 0 funciona; `setDefaultRate` com 0 continua inválido. O trabalho já feito (listar e alterar valor) está commitado: complete só a criação e esse ajuste.
  - Pronto: idem, mais criação (sucesso, entrada inválida, notificação `contributor`, isolamento por organização).
  - Nota: Listagem por organização e alteração de tarifa restrita ao gestor implementadas, com filtro no mapper, validação e notificação; testes incluídos.
  - Nota: Criação ficou pendente: o contrato recebe só nome, mas o domínio exige tarifa padrão positiva; não há valor inicial definido nos documentos.
  - Nota: `pnpm check` passou (598 testes); retomada depende da decisão registrada em `.loop/blocked.md`.
  - Nota: Criar entidade agora usa tarifa inicial 0, origem `manual`, ator como autor e organização da sessão; qualquer papel pode criar e a mudança é notificada. O zero é aceito como padrão no domínio, mas definir tarifa zero continua inválido para usuários e entidades.
  - Nota: Testes de criação, validação, notificação, isolamento e tarifa padrão passaram; `pnpm check` passou (601 testes), sem dependências novas.

- [x] M3.11 Casos de uso: criar, ver, editar e mover tarefa
  - `create-task` (evento `task_created`; responsável = criador), `get-task-detail` (+ `readOnly`), `update-task` (diff → eventos na mesma transação; `as_manager`), `move-task`.
  - Pronto: eventos verificados; transação desfeita se gravar evento falhar.
  - Nota: Criar, consultar detalhe, editar e mover tarefa foram ligados ao `createUseCases`, com acesso por organização, participação/membresia e tarifa padrão do criador.
  - Nota: Criação e diffs de edição/movimentação gravam tarefa e eventos na mesma transação; marcação `asManager` deriva sempre do papel do ator.
  - Nota: Testes cobrem sucesso, negação, prazo/chamado via mapeamento, notificações, somente leitura e rollback quando a gravação do evento falha.
  - Nota: `pnpm check` passou: 609 testes, sem dependências novas.

- [x] M3.12 Casos de uso: listas de tarefas
  - `list-board` ("Minhas tarefas", filtro por projeto, `forUserId` só gestor), `list-team-board`, `list-recent`, `list-frequent`, `search-tasks`, `record-open`.
  - Pronto: ordenações e filtros de acesso testados.
  - Nota: Casos de uso de listas e registro de abertura ligados ao `createUseCases`; acesso, participação, projeto e busca cobertos por testes.
  - Nota: Fakes ordenam estados na ordem do produto e Frequentes pela última abertura (desempate por contagem); `pnpm check` passou (615 testes).

- [x] M3.13 Casos de uso: envolvimentos
  - `add` (copia o valor padrão, PLANO 2.4), `remove`, `set-hours`, `set-rate` (atualiza o padrão do envolvido; permissão PLANO 2.3). Todos geram eventos.
  - Pronto: idem M3.11.
  - Nota: Os quatro casos foram implementados e ligados a `createUseCases`; testes cobrem cópia de tarifa, permissões por participante, horas, tarifa padrão, marca Gestor e rollback.
  - Nota: `pnpm check` passou (623 testes), sem dependências novas.

- [x] M3.14 Casos de uso: linha do tempo e dashboard
  - `list-timeline` (texto por viewer, mais recente primeiro), `get-dashboard` (só gestor).
  - Pronto: testes de permissão e de texto.
  - Nota: Linha do tempo valida acesso à tarefa, resolve nomes na organização, ordena do evento mais recente e aplica o filtro de tarifa por viewer.
  - Nota: Dashboard aceita somente gestor; distribuição global e estatísticas por participante reaproveitam as regras do core e omitem usuários sem tarefas.
  - Nota: Decisão provisória PLANO 12.4: incluir gestor na tabela quando participar de tarefas; `pnpm check` passou (627 testes).

- [x] M3.15 Casos de uso: agenda
  - `list-month`, `list-upcoming`, `create`, `update`, `delete` (só gestor grava).
  - Pronto: idem.
  - Nota: Os cinco casos foram ligados a `createUseCases`; consultas usam a organização do ator e a data de `Clock`.
  - Nota: Gravações são exclusivas do gestor, usam `UnitOfWork` e publicam mudança de agenda; testes cobrem permissões, ordenação e ausência de registros.
  - Nota: `pnpm check` passou: 631 testes, sem dependências novas.

- [x] M3.16 `createUseCases` e roteiro
  - `create-use-cases.ts` (DI manual), `index.ts`; teste "roteiro" da PLANO 9 · M3 ponta a ponta com fakes; cobertura ≥ 90% em `packages/application`.
  - Pronto: `pnpm check` e `pnpm coverage`.
  - Nota: Adicionado roteiro ponta a ponta com fakes desde a criação do projeto até a edição do gestor e conferência da linha do tempo.
  - Nota: Índice público agora exporta os casos de uso de participações e agenda junto da composição `createUseCases`.
  - Nota: `pnpm check` passou (632 testes); cobertura em `packages/application`: 92,96% statements e 96,51% linhas.

- [x] PARADA M3: Pedro revisa os casos de uso e o roteiro.

---

## M4 · SQLite, `packages/infra-sqlite` (PLANO 3.7, 5, 9 · M4)

- [x] M4.1 Cliente e configuração
  - `client.ts` (abre o arquivo ou `:memory:`, pragmas WAL e `foreign_keys`), `drizzle.config.ts`.
  - Deps: `@agilebox/infra-sqlite prod drizzle-orm`, `@agilebox/infra-sqlite prod better-sqlite3`, `@agilebox/infra-sqlite dev drizzle-kit`, `@agilebox/infra-sqlite dev @types/better-sqlite3`.
  - Pronto: teste abre banco em memória e confere os pragmas.
  - Nota: As quatro dependências do passo não estão instaladas; registradas em `.loop/deps.txt` para retomada pelo laço.
  - Nota: Na retomada, confirmei que os quatro pacotes ainda não resolvem no workspace. Reenviei a solicitação em `.loop/deps.txt`; implementação e `pnpm check` aguardam a instalação automática. Status `NEEDS_DEPS`.
  - Nota: Criados `createSqliteClient` com `journal_mode = WAL` e `foreign_keys = ON`, teste em memória e `drizzle.config.ts` no pacote; em memória o SQLite mantém `journal_mode = memory`.
  - Nota: O pacote SQLite usa `skipLibCheck` para ignorar declarações externas incompatíveis do Drizzle; `pnpm check` passou (633 testes).

- [x] M4.2 Schema: organização, usuários, entidades, projetos, membros
  - Pronto: `pnpm typecheck`.
  - Nota: Criados schemas Drizzle para organizações, usuários, entidades, projetos e membros de projeto, com chaves estrangeiras e chave primária composta em membros.
  - Nota: Email de usuário e `name_key` de projeto têm unicidade por organização, conforme o plano; nenhuma unicidade adicional foi definida para entidades.
  - Nota: `pnpm check` passou: formatação, lint, typecheck e 633 testes.

- [x] M4.3 Schema: tarefas, envolvimentos, eventos, aberturas, agenda, `local_settings`; migração inicial
  - CHECKs e índices da PLANO 5 (inclusive índice parcial de um `responsible`). Gerar `migrations/` com `drizzle-kit generate` (script `db:generate`). Aplicar migrações em `client.ts`.
  - Pronto: teste aplica as migrações num banco vazio e confere as tabelas.
  - Nota: Criados os schemas de tarefas, envolvimentos, eventos, aberturas, agenda e `local_settings`, com CHECKs, chaves e índices definidos na seção 5 do plano.
  - Nota: Gerada a migração inicial pelo script `db:generate`; `createSqliteClient` agora aplica as migrações ao abrir o banco.
  - Nota: Teste confirma as 12 tabelas do schema após migração em memória; `pnpm check` passou (633 testes).

- [x] M4.4 Mappers e repositórios: organização, usuários, entidades, projetos
  - Pronto: a parte correspondente da suíte de contrato passa no SQLite.
  - Nota: Implementados mappers de organização, usuário, entidade e projeto, além dos repositórios SQLite de usuários, entidades, projetos e membros.
  - Nota: Testes cobrem persistência, membros, isolamento por organização e nome de projeto repetido entre organizações; `pnpm check` passou (637 testes).

- [x] M4.5 Repositórios: tarefas, envolvimentos, linha do tempo, aberturas
  - Pronto: idem.
  - Nota: Criados mappers e repositórios SQLite para tarefas, envolvimentos, eventos da linha do tempo e aberturas; tarefas carregam participantes e nome do projeto.
  - Nota: Leituras e gravações validam a organização do registro pai e dos usuários/entidades relacionados; Recentes, Frequentes, busca e linha do tempo seguem a ordenação e o escopo do plano.
  - Nota: Suíte de contrato ampliada para conferir linha do tempo mais recente primeiro; fake alinhado à mesma ordem. Testes SQLite cobrem persistência, isolamento e contagem de aberturas.
  - Nota: `pnpm check` passou (641 testes); nenhuma dependência nova. Status `DONE`.

- [x] M4.6 Repositório de agenda, `SqliteUnitOfWork`, `createSqliteAdapters`
  - Pronto: suíte de contrato **inteira** passa no SQLite em memória; teste de rollback.
  - Nota: Implementados o repositório SQLite de agenda e `createSqliteAdapters`, que reúne todos os repositórios, `UnitOfWork` e fechamento do banco.
  - Nota: `SqliteUnitOfWork` envolve a operação assíncrona em `BEGIN`/`COMMIT` e desfaz gravações em erro; teste cobre rollback e commit.
  - Nota: Contrato completo executado em SQLite em memória com `foreign_keys` habilitado; ajustes nos fixtures usam IDs e relações válidos para SQL.
  - Nota: `pnpm check` passou: formatação, lint, tipos e 651 testes.

- [x] M4.7 Seed e scripts
  - `seed/data.ts` (PLANO 9 · M4; nomes do protótipo), `seed/seed.ts` usando os **casos de uso** (para gerar linha do tempo real), `scripts/` e comandos `db:migrate`, `db:seed`, `db:reset` (banco em `./.data/agilebox.db`, no `.gitignore`).
  - Pronto: teste roda o seed em memória e confere contagens.
  - Nota: Conferidos os dados de demonstração, seed pelos casos de uso, scripts `db:*` e caminho `.data/agilebox.db` ignorado pelo Git; não havia falha anterior.
  - Nota: Teste do seed passou e conferiu 5 usuários, 3 projetos, 2 entidades, 10 tarefas, 3 agendamentos e eventos de linha do tempo, incluindo edição de gestor.
  - Nota: `pnpm check` passou (formatação, lint, tipos e 652 testes); sem dependências novas ou pendências externas deste passo.

- [x] M4.8 ABI do better-sqlite3 (Node × Electron)
  - O módulo nativo é um só em `node_modules` (hoisted): compilado para o Node (Vitest) **ou** para o Electron (app). Escrever `scripts/ensure-native.mjs <node|electron>`: tenta carregar o `better-sqlite3` no alvo (para `electron`, com `ELECTRON_RUN_AS_NODE=1` e o binário do Electron, se instalado); se falhar por `NODE_MODULE_VERSION`, reconstrói (`npm rebuild better-sqlite3` para o Node, `@electron/rebuild` para o Electron) e sai com código ≠ 0 e mensagem clara se não conseguir (sem rede, sem compilador). Se o pacote ou o Electron ainda não estiverem instalados, sai com 0 sem fazer nada.
  - Scripts de raiz: `native:node`, `native:electron`; o `test` passa a chamar `pnpm native:node` antes do Vitest (o pnpm não executa `pretest` sozinho). Os scripts `dev` e `build` do desktop (M5.1) chamarão `native:electron`.
  - Escrever `docs/decisoes/0002-better-sqlite3-abi.md` (PLANO 11 · R2): a estratégia, o custo de alternar o binário e a alternativa de ter dois diretórios de instalação.
  - Testes: a lógica de decisão (qual comando, qual alvo) em função pura com teste; o script em si não é executado nos testes.
  - Deps: `root dev @electron/rebuild`.
  - Pronto: `pnpm check` passa; documento escrito. Pendência `TESTAR-NO-WINDOWS`: rodar `pnpm native:electron` e depois `pnpm native:node` no Windows.
  - Nota: Criado `scripts/ensure-native.mjs`; detecta pacote/alvo ausente como no-op, tenta carregar no alvo e reconstrói somente diante de incompatibilidade de ABI.
  - Nota: `native:node` usa `npm rebuild` no workspace SQLite, `native:electron` usa `@electron/rebuild`; o `test` chama a verificação Node antes do Vitest.
  - Nota: Estratégia, custo da alternância do binário hoisted e alternativa de instalações separadas registrados em `docs/decisoes/0002-better-sqlite3-abi.md`.
  - Nota: Testes da decisão de rebuild cobrem os comandos de Node e Electron; a validação no Windows segue como pendência do Pedro.

- [ ] PARADA M4: Pedro roda `pnpm db:reset && pnpm db:seed` e confere o banco.

---

## M5 · Shell Electron, UI base e IPC (PLANO 3.3, 3.4, 9 · M5, 10; HANDOFF inteiro)

O laço não abre janelas. A verificação de cada passo é `pnpm check`; a partir do M5.11 o `check` inclui o build do Electron. O que exige olhar a tela ou o Windows vai para `docs/laco/pendencias-do-pedro.md`.

- [ ] M5.1 Electron, Vite e ferramentas de teste de interface
  - Arquivos: `apps/desktop/electron.vite.config.ts` (main, preload e renderer com **duas páginas**: `src/renderer/panel/index.html` e `src/renderer/tray/index.html`; pacotes `@agilebox/*` **empacotados**, não externalizados), `apps/desktop/tsconfig.json` + script `typecheck`, `apps/desktop/src/{main,preload,renderer}/` com entradas mínimas, `vite-env.d.ts` (`vite/client`) em `apps/desktop` e `packages/ui`. Scripts do desktop: `dev`, `build`, `preview`; de raiz: `dev`, `build`. Raiz: `typecheck` passa a incluir também `tooling/` e `apps/` (`pnpm -r --if-present typecheck && tsc -p tsconfig.eslint.json`).
  - Testes de interface: `packages/ui/vitest.setup.ts` (jest-dom), projetos do Vitest `desktop-main` (node: `src/main`, `src/preload`) e `desktop-renderer` (jsdom: `src/renderer`), `setupFiles` onde precisar.
  - Deps: `root dev @types/node`, `root dev @testing-library/react`, `root dev @testing-library/user-event`, `root dev @testing-library/jest-dom`, `@agilebox/desktop dev electron`, `@agilebox/desktop dev electron-vite`, `@agilebox/desktop dev vite`, `@agilebox/desktop dev @vitejs/plugin-react`, `@agilebox/desktop prod react`, `@agilebox/desktop prod react-dom`, `@agilebox/desktop dev @types/react-dom`, `@agilebox/ui dev @types/react-dom`, `@agilebox/ui prod react-dom`. Dependências internas do desktop conforme PLANO 3.1.
  - Atenção: a API do `electron-vite` muda entre versões; confira a versão instalada em `node_modules/electron-vite` antes de escrever a configuração.
  - Pronto: `pnpm check` e `pnpm --filter @agilebox/desktop build` passam.

- [ ] M5.2 Tokens, estilos base e fonte
  - `packages/ui/src/styles/tokens.css` (**todos** os tokens da tabela "Design Tokens Used" do HANDOFF, como variáveis CSS: cores, vidros, raios, espaços, tipografia, `--ease-ios`), `base.css` (reset, fonte, foco visível 2 px `#64A8FF` offset 2, barra de rolagem de 3 px), `motion.css` (animações nomeadas do HANDOFF e `prefers-reduced-motion`), `fallback.css` (`@supports not (backdrop-filter)` → fundo sólido `rgba(30,33,42,.92)`). Fonte Inter local por pacote npm. Hooks `useReducedMotion`, `useFocusTrap`, `useRestoreFocus`.
  - Deps: `@agilebox/ui prod @fontsource-variable/inter`.
  - Pronto: testes dos hooks; teste que lê `tokens.css` via `?raw` e confere que cada token do HANDOFF existe.

- [ ] M5.3 Componentes de base I
  - `GlassSurface` (variantes janela, grupo, controle, popover; fallback), `Button` (primário/secundário, hover/active/disabled, alvo ≥ 44 px), `IconButton` (exige `aria-label`), `Avatar` (iniciais), `StatusChip` (5 estados, rótulo de texto sempre), `Skeleton`, `ReadOnlyBadge` ("Somente leitura"), `EmptyState`. Cada um com `.module.css` e `.test.tsx` (papéis, estados, `aria-*`).
  - Pronto: `pnpm check`.

- [ ] M5.4 Componentes de base II
  - `SegmentedControl` (2 ou 3 opções, polegar deslizante `aria-hidden`, `aria-pressed`), `GroupedList`/`FieldRow` (linhas de 48 px), `TextField`, `TextArea`, `DateField`, `NumberField` (aceita vírgula decimal), todos com `<label>` ou `aria-label`.
  - Pronto: testes de teclado e rótulos.

- [ ] M5.5 Componentes de base III
  - `StatusMenu` (`role="menu"` + `menuitemradio`, 224 px, itens de 44 px, check no atual, fecha com Esc, devolve o foco), `Modal` (`role="dialog"`, `aria-modal`, prende o foco, fecha com Esc e clique no fundo, devolve o foco ao botão que abriu), `Toast` + `useToast` (`role="status"`, some em ~2,6 s), `Tooltip` (só quando recolhida/solicitada), `WindowControls` (minimizar, expandir/recolher, fechar; 40×44 px).
  - Pronto: testes de foco, Esc, retorno de foco e `role`.

- [ ] M5.6 Galeria de componentes (só desenvolvimento)
  - `apps/desktop/src/renderer/panel/dev/Gallery.tsx` mostrando todos os componentes e estados; entrada pelo parâmetro `?gallery` do painel (inativa no build de produção). `index.ts` do `ui` exportando tudo.
  - Pronto: teste de renderização da galeria sem erros; pendência `CONFERIR` ao Pedro: abrir a galeria e comparar com o protótipo.

- [ ] M5.7 Main: composition root, sessão e notificador de mudanças
  - `main/paths.ts`, `main/composition-root.ts` (**único** lugar que liga portas às implementações: SQLite, relógio, IDs, notificador → `createUseCases`; devolve `{ useCases, close }`), `main/actor-session.ts` (ator atual em memória, persistido em `local_settings`; padrão: o usuário "Pedro" do seed; `switchUser`), `main/ipc/change-broadcaster.ts` (implementa `ChangeNotifier`, envia para as janelas por uma interface mínima). Se o banco estiver vazio, roda o seed (apenas fora de produção).
  - Pronto: testes com SQLite em memória (ator padrão, troca de usuário persiste, notificação chega ao broadcaster).

- [ ] M5.8 Main: IPC com validação
  - `main/ipc/handle.ts` (valida a entrada com zod do `contract`, injeta o ator **da sessão**, converte erros para o envelope `Result`), `main/ipc/register-handlers.ts` (um handler por canal de `channels.ts`, ligado a um caso de uso).
  - Pronto: testes com casos de uso falsos: entrada inválida, `FORBIDDEN`, `NOT_FOUND`, ator nunca vindo do renderer, e um teste que garante **todo canal registrado**.

- [ ] M5.9 Preload e camada de dados do renderer
  - `preload/index.ts` (`contextBridge` expondo `window.agilebox`: `invoke`, `onChanges`, `shell`), `renderer/shared/api/ipc-client.ts` (implementa `AgileBoxApi`; desembrulha `Result`, lança `ApiError`), `ApiProvider.tsx`, `query/QueryProvider.tsx`, `keys.ts`, `sync-changes.ts` (`onChanges` → invalida queries), `session/useActor.ts` (ator e capacidades), `lib/format-date.ts` ("Qui, 05 nov", "há 12 min"; `date-fns` pt-BR), `testing/fake-api.ts`. Hooks por recurso só nos passos das telas que os usam.
  - Deps: `@agilebox/desktop prod @tanstack/react-query`, `@agilebox/desktop prod date-fns`.
  - Pronto: testes do client com `invoke` falso, da invalidação e do `format-date`.

- [ ] M5.10 Janelas, vidro e ciclo de vida
  - `main/windows/glass.ts` (**pura**: `resolveGlassMode(platform, env)` → `'css'` por padrão; `'native'` quando `AGILEBOX_GLASS=native` no Windows 11), `window-manager.ts`, `panel-window.ts` (sem moldura, 1280×780, mín. 900 de largura), `tray-window.ts` (360 px, sem moldura, sempre no topo, sem item na barra de tarefas, ancorada no canto inferior direito da área útil), `main/index.ts` (instância única, `whenReady` → composition root → handlers → janelas). Código que toca a API do Electron fica nestes arquivos finos; a lógica (modo de vidro, posição ancorada) em funções puras com teste.
  - Escrever `docs/decisoes/0001-vidro.md` como **provisório**: padrão CSS (janela transparente, vidro por `backdrop-filter`) com alternativa nativa (`backgroundMaterial: 'acrylic'`) por variável de ambiente; explicar o risco R1 do PLANO.
  - Pendência `TESTAR-NO-WINDOWS`: comparar `AGILEBOX_GLASS=css` e `native` na bandeja e no painel; registrar a escolha em `0001-vidro.md`.
  - Pronto: `pnpm check` e build do desktop.

- [ ] M5.11 Painel esqueleto ponta a ponta
  - `renderer/panel/{main.tsx,App.tsx,copy.ts}` com providers e uma tela temporária que lista as tarefas de `tasks.listBoard` (título, `StatusChip`, projeto); `renderer/tray/{main.tsx,App.tsx}` com casca mínima. Acrescentar o build do desktop ao script `check` da raiz.
  - Pronto: teste do `App` com `fake-api`; `pnpm check` (agora com build) passa. Pendência `CONFERIR`: `pnpm dev` abre o painel com as tarefas do seed; editar na bandeja atualiza o painel.

- [ ] PARADA M5: Pedro roda `pnpm dev` (no Windows e no Linux), confere a galeria e o painel esqueleto, e decide o vidro (0001-vidro.md).

---

## M6 · Painel: kanban e detalhe da tarefa (HANDOFF "Painel principal", "Detalhe da tarefa"; PLANO 9 · M6)

Todos os passos usam `fake-api` nos testes de componente. Hooks de dados nascem junto da tela que os usa.

- [ ] M6.1 Casca do painel
  - `layout/PanelShell`, `Rail`/`RailItem` (52 px recolhida, 204 px expandida, transição de largura; tooltip só recolhida; Dashboard só para gestor; Projetos; Agenda; Plug-ins "em breve"; Ajustes com `EmptyState` "em breve", PLANO 12.3; Conta na base), `TitleBar` (64 px: nome, segmentado "Minhas tarefas | Equipe · somente leitura" **estático**, botão "Nova tarefa", `WindowControls`), navegação entre visões em estado simples (animação `sobe 10 px + fade`).
  - Pronto: testes de navegação, de Dashboard oculto para colaborador e de `aria`.

- [ ] M6.2 Projetos
  - `board/ProjectTitle` (seta que gira) e `ProjectDialog` (lista com check no atual, **"Todos os projetos"** como primeira opção, "Novo projeto" que vira campo + "Criar"; nome repetido seleciona o existente). Hooks `useProjects`, `useCreateProject`.
  - Pronto: testes do fluxo (criar, repetir, trocar, Esc, foco).

- [ ] M6.3 Quadro kanban (somente leitura de layout)
  - `board/BoardView`, `KanbanColumn` (5 colunas iguais, gap 12 px, "Sem tarefas"), `TaskCard` (botão que abre o detalhe; título, prazo, iniciais do responsável). Dados de `tasks.listBoard` com filtro por projeto ("Todos os projetos" por padrão, PLANO 1). Estados de carregando (esqueleto), vazio e erro curto (PLANO 12.6; registrar `DECISÃO PROVISÓRIA`).
  - Pronto: testes de agrupamento por estado, filtro e estados vazios.

- [ ] M6.4 Arrastar e soltar
  - `dnd-kit` no `KanbanColumn`/`TaskCard`: coluna de destino azulada, ao soltar chama `tasks.move`; **alternativa por teclado** (sensor de teclado e/ou menu de estado no card); ordem dentro da coluna por `updated_at` (PLANO 12.2, `DECISÃO PROVISÓRIA`).
  - Deps: `@agilebox/desktop prod @dnd-kit/core`, `@agilebox/desktop prod @dnd-kit/sortable`.
  - Pronto: testes de que soltar chama `move` com o estado certo e de que o teclado faz o mesmo.

- [ ] M6.5 Nova tarefa
  - Botão "Nova tarefa" da `TitleBar`: escolhe projeto (padrão: o selecionado), título, cria com `tasks.create` e **abre o detalhe**. Colaborador só vê projetos de que é membro.
  - Pronto: teste do fluxo e do estado desabilitado sem título.

- [ ] M6.6 Detalhe da tarefa: estrutura e card Detalhes
  - `task-detail/TaskDetailView` (cabeçalho: voltar + título editável; colunas 1,15 × 1; gap 16 px), `DetailsCard` (descrição, estado via `StatusMenu`, responsável, chamado: ID + link opcional), `useBlurSave` (**grava ao sair do campo**, um `update` por blur, só se mudou), `recordOpen` ao abrir. Campos desabilitados + `ReadOnlyBadge` quando `readOnly`.
  - Pronto: testes de blur (uma gravação), de não gravar sem mudança e do modo somente leitura.

- [ ] M6.7 Card Prazo
  - `DeadlineCard`: `DateField` + texto auxiliar de `deadlineLabel` ("Em N dias", "Vence hoje", "Vence amanhã", "Venceu há N dias", "Concluída", "Sem prazo definido"); "hoje" vem do relógio injetado.
  - Pronto: testes de cada frase.

- [ ] M6.8 Cards Custo e Envolvidos
  - `ParticipantsCard` (lista de envolvidos; adicionar usuário ou entidade, papel Responsável/Apoio, remover), `ContributorPicker` e `CreateContributor` (botão "Criar entidade"), `CostCard` (horas e valor/hora por linha, subtotal e total recalculando na hora; vírgula decimal; valor/hora de envolvido novo vem do padrão dele; editar atualiza o padrão). Nesta etapa o card mostra R$ **conforme o DTO** (`null` → não renderiza valores).
  - Pronto: testes de cálculo, vírgula, remoção, e de ocultar R$ quando o DTO vem com `null`.

- [ ] M6.9 Card Linha do tempo
  - `TimelineCard`: entradas com data e hora, quem, o quê (texto do `timeline.list`), mais recente no topo, rolável; marca "Gestor" com as cores `manager` do HANDOFF; "Sem atualizações ainda." quando vazia.
  - Pronto: testes de ordem, marca Gestor e estado vazio.

- [ ] M6.10 Acabamento do painel
  - Passada de revisão: animações do HANDOFF (cards sobem 8 px / hover 2 px, troca de visão, modal), `prefers-reduced-motion`, ordem de foco (barra lateral → título → conteúdo), `aria-label` de botões só com ícone. Atualizar a galeria. `pnpm check` limpo.
  - Pendência `CONFERIR`: percorrer o painel com o protótipo ao lado.

- [ ] PARADA M6: Pedro usa o painel como colaborador (criar, mover, editar, fechar e reabrir; dados persistem) e compara com o protótipo.

---

## M7 · Permissões e gestor (HANDOFF "Dashboard", "Regras de negócio"; PLANO 6.1, 9 · M7)

- [ ] M7.1 Conta e capacidades
  - `layout/AccountMenu` (troca de perfil **de demonstração**: lista de usuários, chama `session.switchUser`, invalida tudo), `useActor` com `canSeeDashboard`, `canSeeRates` etc. vindos do servidor/DTO.
  - Pronto: testes de troca de perfil e de item Dashboard aparecendo só para gestor.

- [ ] M7.2 Permissões na tela
  - Colaborador: nenhum R$ de outras pessoas nem o total; campos desabilitados + `ReadOnlyBadge` quando `readOnly`; erros `FORBIDDEN` viram toast curto. Gestor: edita tudo, e a linha do tempo mostra "Gestor".
  - Pronto: testes com `fake-api` nos dois perfis.

- [ ] M7.3 Dashboard
  - `dashboard/DashboardView`, `StackedBar` (largura anima 0,5 s), `StatCard` (5 estados, porcentagem grande + contagem), `CollaboratorTable` (nº de itens, barra de estados, % concluído, botão "Abrir projetos"). Estados vazio e carregando.
  - Pronto: testes de porcentagens e de acessibilidade (estados nunca só por cor).

- [ ] M7.4 Abrir projetos de um colaborador
  - "Abrir projetos" abre o quadro com `listBoard({ forUserId })`; `board/ManagerBanner` ("Tarefas de X · editando como Gestor" + "Voltar às minhas"). Edições nesse quadro são marcadas Gestor.
  - Pronto: testes do fluxo e do botão voltar.

- [ ] M7.5 Membros do projeto
  - `board/ProjectMembersDialog` (PLANO 12.1, `DECISÃO PROVISÓRIA`): botão "Membros" no `ProjectDialog` visível só para quem criou o projeto e para o gestor; listar, adicionar e remover.
  - Pronto: testes de visibilidade do botão e das ações.

- [ ] PARADA M7: Pedro troca de perfil e confere: colaborador não vê R$ nem Dashboard; gestor edita e a linha do tempo marca "Gestor".

---

## M8 · Agenda (HANDOFF "Agenda", "Calendário"; PLANO 9 · M8)

- [ ] M8.1 Grade do calendário
  - `renderer/shared/lib/calendar-grid.ts` (6 semanas × 7 dias, começa no domingo, dias de fora do mês, hoje).
  - Pronto: testes de viradas de ano e meses de 28 a 31 dias.

- [ ] M8.2 Calendário
  - `agenda/Calendar` e `DayCell` (normal, hoje com círculo azul, selecionado, fora do mês; até 2 eventos + "+N mais"; texto com reticências, a célula nunca cresce); mês anterior/próximo com `aria-label`; clicar no dia seleciona e define a data do formulário sem abri-lo.
  - Pronto: testes de seleção, "+N mais" e teclado.

- [ ] M8.3 Lista e formulário
  - `agenda/UpcomingList` ("Próximos agendamentos", "Nada marcado."), `MeetingForm` (expande no lugar `0fr→1fr`; criar, editar, excluir; participantes são usuários, PLANO 12.5 `DECISÃO PROVISÓRIA`), `AgendaView` (painel direito de 20%, mín. 260 px). Colaborador: botões desabilitados + "Só o gestor cria e edita agendamentos."
  - Pronto: testes do fluxo completo e das permissões.

- [ ] PARADA M8: Pedro cria, edita e exclui agendamentos como gestor e confere o aviso como colaborador.

---

## M9 · Bandeja (HANDOFF "Bandeja"; PLANO 6.6, 9 · M9)

- [ ] M9.1 Lógica pura da bandeja
  - `tray/auto-height.ts` (fórmula: Início `246 + max(min(n, 2), 1) × 64`; Atualizar/detalhes 560; Nova 316; mín. 260 e máx. 600 manual), `tray/tray-machine.ts` (telas início → atualizar, início → nova → atualizar; direção da animação).
  - Pronto: testes da fórmula e da máquina.

- [ ] M9.2 Tela inicial
  - `tray/screens/HomeScreen`, `SearchField` (filtra por título e projeto, sem acentos; "Nenhuma tarefa encontrada."), segmentado Recentes | Frequentes ("Nenhuma tarefa aberta ainda."), `TaskList`/`TaskRow` (64 px; título, chip, projeto, "há quanto tempo"; no máximo 2 linhas visíveis, barra de 3 px), botão "Nova tarefa".
  - Pronto: testes de busca, ordem de Recentes/Frequentes e vazios.

- [ ] M9.3 Atualizar tarefa
  - `UpdateTaskScreen`: título e projeto, "O que será feito", grupo Status (menu), Prazo, Responsável, Envolvidos, Chamado; "Salvar" volta à lista com toast "Atualização salva" e a tarefa sobe para o topo de Recentes. `recordOpen` ao abrir.
  - Pronto: testes de salvar e de somente leitura.

- [ ] M9.4 Nova tarefa
  - `NewTaskScreen`: título, projeto (segmentado de 3), "Criar tarefa" cria e **abre o detalhe**; salvar ou voltar leva à lista com "Tarefa criada" e linha destacada.
  - Pronto: testes do fluxo.

- [ ] M9.5 Janela e redimensionar
  - `ResizeHandle` (arrastar; setas em passos de 24 px; Home e duplo clique voltam ao automático; sem transição durante o arraste), altura via `shell.setTrayHeight`, controles (minimizar recolhe para o cabeçalho de 52 px; expandir abre o painel; fechar anima e deixa o botão redondo de 52 px), `ClosedTrayButton`. Animações de entrada/saída do HANDOFF.
  - Pronto: testes do `ResizeHandle` (teclado) e dos controles com `shell` falso. Pendência `CONFERIR`/`TESTAR-NO-WINDOWS`: altura animada sem tremer (risco R1).

- [ ] PARADA M9: Pedro usa a bandeja: criar, atualizar, buscar, redimensionar; confere a sincronização com o painel aberto.

---

## M10 · Empacotamento e ícone de bandeja (PLANO 9 · M10)

- [ ] M10.1 Ícone de bandeja e ciclo de vida
  - `main/tray/tray-icon.ts` (clique abre/fecha a bandeja; menu "Abrir painel" e "Sair"), instância única, janelas reabrem pela bandeja, painel recolhe para a bandeja. Lógica de posição em função pura (barra de tarefas em qualquer borda, vários monitores). Item PLANO 12.7 (iniciar com o Windows): **não** iniciar sozinho; registrar `DECISÃO PROVISÓRIA`.
  - Pronto: testes das funções puras; `pnpm check`.

- [ ] M10.2 Instalador
  - `apps/desktop/electron-builder.yml` (NSIS para Windows; alvo Linux AppImage como bônus), `resources/` com ícones gerados por script (`scripts/make-icons.mjs`, sem dependência nova), scripts `pack` e `dist`, `better-sqlite3` reconstruído para o Electron (`scripts/ensure-native.mjs`, M4.8), banco em `%APPDATA%/AgileBox` (Windows) ou o diretório de dados do usuário (Linux), migrações ao iniciar.
  - Deps: `root dev electron-builder`, `root dev @electron/rebuild`.
  - Pronto: `pnpm check`. Pendência `TESTAR-NO-WINDOWS`: gerar o instalador (`pnpm dist`) e instalar.

- [ ] M10.3 Testes de ponta a ponta e checklist
  - `apps/desktop/e2e/` (Playwright `_electron` com banco temporário): criar tarefa → mover → editar → fechar e reabrir (persiste); troca de perfil (colaborador sem R$); criar pela bandeja e ver no painel. Script `test:e2e` **fora** do `check`. `docs/checklist-windows.md` (instalar, vidro, bandeja, reiniciar o Windows e ver os dados).
  - Deps: `root dev @playwright/test`.
  - Pronto: `pnpm check`. Pendências `RODAR-E2E` e `TESTAR-NO-WINDOWS` registradas.

- [ ] PARADA M10: fim do MVP. Pedro percorre `docs/checklist-windows.md` e `docs/laco/pendencias-do-pedro.md`.
