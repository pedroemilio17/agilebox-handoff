# Relatório de auditoria da Onda 1 (Plano 2.0, marcos M0 a M5)

Passo: M5.3 · Auditoria final da Onda 1.
Revisão feita sobre o HEAD `a18d7ad` (commit `feat(m5.2b): interface de impedimentos`). Nenhum código de produção ou teste foi alterado; nenhum commit ou push foi feito.
Fontes: `CLAUDE.md`, `AGENTS.md`, `docs/PLANO-2.0.md`, `docs/laco/orquestracao-2.0.md`, código e testes do repositório.
Log do `pnpm check` desta auditoria: `/tmp/claude-0/pnpm-check-m53.log`.

Convenção de status: **Provado** = há código e teste que cobrem o critério; **Parcial** = provado só em parte ou só com backend simulado; **Não provado** = não há evidência no código ou nos testes; **Não verificado** = não foi possível checar nesta auditoria.

---

> **Atualização após o M5.4 (17/11/2026):** cinco lacunas desta auditoria foram corrigidas depois da sua escrita: (1) o dashboard não calcula nem devolve os insights de fluxo com `flowMetrics` desligado; (2) o check-in respeita o encerramento do módulo e `daily.save` permite editar a daily que já existe; (3) as mudanças de `config` do módulo são auditadas (migração 0017); (4) há teste de persistência real em SQLite de criar, editar, mover, concluir e reabrir tarefa; (5) há teste do encerramento completo de Sprints. O M5.4 também corrigiu um defeito que a auditoria não viu: desligar e reativar um módulo zerava a sua `config`. Continuam abertos, para decisão sua: a "parada" sem módulo, o destino dos itens quando o Backlog é desligado, o tipo `TenantContext` nominal e a conferência visual das telas novas. Testes após o M5.4: 289 arquivos e 2547 testes.

## (a) Resumo executivo

1. A Onda 1 (M0 a M5) está entregue em 26 commits, com 6 migrações novas (0011 a 0016) e `pnpm check` verde: 285 arquivos de teste, 2515 testes, todos passando.
2. M1, M3, M4 e M5 estão provados por testes de domínio, de aplicação e de persistência. M2 está provado em boa parte por testes de interface com backend simulado.
3. M0 está só parcialmente provado. "Criar, editar, mover e reabrir" tem teste de interface com backend simulado; a persistência real é provada para backlog e arquivamento, não para o restante do ciclo da tarefa. "Nenhuma tela estática" não tem verificação geral; só o seletor Equipe foi conferido (M0.2).
4. Dos sete casos da seção "Fase de testes" da camada de ferramentas, cinco têm teste direto. Dois são parciais: "módulo desativado recusado pelo chat ou pelo MCP" é provado no caso de uso, porque chat e MCP ainda não existem no código; e "desativar Sprints com sprint ativa sem órfãos" não tem um teste que cubra o caminho completo.
5. As regras de produto do `CLAUDE.md` (estados, linha do tempo com marca Gestor, permissões, custo, `organization_id`, regras no core e na aplicação, `prefers-reduced-motion`) não foram quebradas pela Onda 1. A exceção é a visibilidade de entidades nas telas novas, que está provada só por construção nas políticas.
6. Há cinco lacunas de risco alto que contrariam o próprio plano: `dashboard.get` devolve insights de fluxo com `flowMetrics` desligado; os sinais de "parada" não são controlados por módulo; o check-in da bandeja não respeita o encerramento; mudanças de configuração de módulo não são auditadas; e desativar o Backlog deixa os itens escondidos sem destino.
7. Há também uma regra de encerramento divergente: `daily.save` recusa editar a daily já existente durante o encerramento, mas o plano diz que o que já existe segue editável.
8. Não foi possível verificar na prática: conferência visual das telas novas, execução do app em janela real, fluxos ponta a ponta e o comportamento no Windows.
9. Há 7 decisões de prioridade alta para o Pedro (seção d), mais uma lista de médias e normais. As cinco lacunas de risco alto devem ser fechadas antes do M6a, porque o M6a reaproveita o guard de módulo e a auditoria.
10. Fora do repositório, o arquivo `/x` (9461 bytes, criado por um agente no M0.3a) continua na raiz do sistema. Não foi removido nesta auditoria; a remoção é manual (`rm /x`).

---

## (b) Marco a marco: critérios "Pronto quando"

### M0 · Estabilizar o MVP

| Critério                                        | Status      | Evidência                                                                                                                                                                                                                                                                                                                             | Não provado ou ressalva                                                                                                                                                            |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar, editar, mover e reabrir tarefa persistem | Parcial     | Interface: `apps/desktop/src/renderer/panel/App.basic-flow.test.tsx:101` (cria, move por todos os estados, reabre a concluída) e `:137` (edita e comenta). Persistência real: `packages/infra-sqlite/src/repositories/backlog-persistence.test.ts:27` (ordem sobrevive a reabrir o banco) e `archive-persistence.test.ts:37` e `:48`. | Os testes de interface usam backend simulado. Não encontrei teste de persistência SQLite específico para criar, editar e mover tarefa nesta auditoria (não verificado por título). |
| Nenhuma tela estática                           | Não provado | Só o seletor Equipe foi conferido (M0.2, `orquestracao-2.0.md` linha 26).                                                                                                                                                                                                                                                             | Não há varredura automatizada de telas estáticas.                                                                                                                                  |

Outros marcos do M0: `M0.3a` tem testes em `packages/application/src/use-cases/tasks/archive.test.ts:226`, `:335` e `:158` (marca Gestor); `M0.4` tem `apps/desktop/src/renderer/panel/board/ProjectDialog.rename.test.tsx` e `packages/application/src/use-cases/projects/projects.test.ts:277`. A semântica de "Minhas tarefas" do M0.1 não foi conferida por título de teste nesta auditoria (não verificado).

### M1 · Motor de capacidades

| Critério                                              | Status  | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Não provado ou ressalva                                         |
| ----------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Testes cobrem dependência                             | Provado | `packages/core/src/modules/resolve.test.ts:31` (ativar puxa dependências, incluindo transitivas em `:46`) e `:77` (desligar bloqueado por dependentes). `packages/core/src/modules/registry.test.ts:74` (dependências do PLANO-2.0).                                                                                                                                                                                                                              | Nenhuma.                                                        |
| Testes cobrem conflito                                | Provado | `resolve.test.ts:138` (horas e pontos exclusivos), `:148` (no mesmo pedido). `packages/core/src/modules/team-tools.test.ts:78`.                                                                                                                                                                                                                                                                                                                                   | Nenhuma.                                                        |
| Testes cobrem ciclo                                   | Provado | `packages/core/src/modules/registry.test.ts:70` (catálogo sem ciclo) e `:104` a `:151` (`findDependencyCycle`, inclusive ciclo por `requiresAnyOf`).                                                                                                                                                                                                                                                                                                              | O teste roda a cada `pnpm test`, que faz parte do `pnpm check`. |
| Testes cobrem desligamento gradual sem perda de dados | Provado | `packages/core/src/modules/team-tools-change.test.ts:116` (desligar entra em `winding_down`; `finalize`; reativar devolve), `:137` e `:146`. `packages/core/src/modules/team-tools.test.ts:341` (encerramento conta como existente). `packages/application/src/use-cases/team-tools/team-tools.test.ts:265` a `:322`. `packages/application/src/module-guard.test.ts:237` a `:340` (encerramento) e `:406` a `:441` (reativar devolve checklist e limite de WIP). | Os testes de aplicação usam repositórios fake.                  |
| Nenhum caso de uso roda sem `TenantContext`           | Provado | `packages/application/src/tenant-boundary.test.ts:110` (todo caso de uso recusa chamada sem contexto), `:134` (tipo recusa `Actor` cru), `:140` (não devolve dados de outra organização). `packages/application/src/tenant-context.ts:11` define o tipo.                                                                                                                                                                                                          | O tipo é estrutural (ver (c) e (d)).                            |

### M2 · Interface adaptativa

| Critério                                               | Status                        | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Não provado ou ressalva                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trocar nível ou preset não perde dados                 | Provado (aplicação e domínio) | `packages/application/src/use-cases/team-tools/team-tools.test.ts:255` (`setLevel` muda o nível), `:379` (aplicar preset mantém o nível). `packages/core/src/modules/team-tools.test.ts:280` (mudança só de nível gera diferença de nível). `packages/core/src/modules/team-tools-change.test.ts:153` (aplicar Scrum liga e encerra, sem apagar).                                                                                                                     | Não verifiquei nesta auditoria o arquivo `App.level-data.test.tsx`, que também cobre o tema.                                                                                                                                             |
| Desativar módulo com sprint ativa não deixa item órfão | Provado no caso de uso        | `packages/application/src/use-cases/sprints/sprints.test.ts:583` (encerrando recusa criar e iniciar, permite encerrar a ativa), `:644` (desativado recusa tudo; reativar devolve). `team-tools-change.test.ts:68` (Backlog com Sprints entram juntos em encerramento).                                                                                                                                                                                                | Os itens órfãos são evitados pela política de encerramento de `sprint-close.test.ts`, mas não encontrei um teste único que desative Sprints com sprint ativa e confira o estado final das tarefas (ver também a tabela de casos abaixo). |
| Time Básico trabalha sem saber Scrum                   | Provado com backend simulado  | `apps/desktop/src/renderer/panel/App.basic-flow.test.tsx:76` (quadro sem termos de Scrum), `:89` (menu do Básico), `:101`, `:137`, `:174` (criar, mover, editar, comentar, arquivar, reabrir), `:193`, `:214`, `:226`. `apps/desktop/src/renderer/panel/App.scrum-basic.test.tsx:66` a `:118`. `apps/desktop/src/renderer/shared/testing/forbidden-terms.test.ts` (auditoria de termos). Versão da bandeja: `apps/desktop/src/renderer/tray/App.basic-flow.test.tsx`. | Não há conferência visual nem execução em janela real.                                                                                                                                                                                   |

### M3 · Backlog e critérios

| Critério                              | Status               | Evidência                                                                                                                                                                                                                                                    | Não provado ou ressalva                                                                                                                           |
| ------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reordenar persiste                    | Provado              | `packages/application/src/use-cases/backlog/backlog.test.ts:264` (reordena e a lista segue a ordem gravada), `:307` (evento na linha do tempo). `packages/infra-sqlite/src/repositories/backlog-persistence.test.ts:27` (ordem sobrevive a reabrir o banco). | Nenhuma.                                                                                                                                          |
| Backlog separado da coluna `planning` | Provado com ressalva | `backlog.test.ts:122` (item novo nasce em Planejamento, fora do quadro), `:147` (item some do quadro, da busca e dos recentes), `:178` (dashboard não conta). `packages/core/src/policies/backlog-policy.test.ts:39`.                                        | A separação é feita por `backlog_rank` (migração 0013), não pela coluna de estado. Item de backlog é tarefa com posição; o plano não define isso. |

### M4 · Sprints

| Critério                                                                       | Status                          | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Não provado ou ressalva                  |
| ------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Backlog → planejamento → início → encerramento → replanejamento, com histórico | Provado (aplicação e interface) | `packages/application/src/use-cases/sprints/sprints.test.ts:178` (fluxo completo com este título), `:298` (devolver ao backlog), `:323` (levar para a próxima), `:377` (encerramento atômico), `:407` (descarte). `apps/desktop/src/renderer/panel/sprints/SprintsView.test.tsx:530` (replanejar cria rascunho com a mesma duração). `packages/core/src/rules/sprint-close.test.ts:64`, `:91` (histórico preservado). Histórico em `packages/infra-sqlite/src/repository-sprints.test.ts` e migração 0015. | Não há teste ponta a ponta com app real. |

### M5 · Check-ins e impedimentos

| Critério                           | Status  | Evidência                                                                                                                                                                                                                                                      | Não provado ou ressalva                                                                         |
| ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Check-in funciona sem sprint       | Provado | `packages/application/src/use-cases/daily/suggest-summary.test.ts:291` ("sem sprints e sem backlog o resumo funciona e nunca toca o repositório de sprints"). `packages/application/src/use-cases/daily/daily.test.ts:149` (salva a daily sem aviso).          | A janela da bandeja não foi conferida (altura do passo 1, ver `orquestracao-2.0.md` linha 124). |
| Impedimento resolvido sai da lista | Provado | `packages/application/src/use-cases/impediments/impediments.test.ts:99` (resolvido sai da lista padrão e aparece com `includeResolved`), `:118` (concluir resolve sem nota). `packages/core/src/rules/impediments.test.ts:253` (desbloquear resolve o aberto). | Nenhuma.                                                                                        |

### Casos da seção "Fase de testes" (camada de ferramentas)

| Caso do plano                                                       | Tem teste? | Onde                                                                                                                                                                                                                                              | Ressalva                                                                                                                             |
| ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Ativar Sprints sem Backlog ativa os dois, com aviso                 | Sim        | `packages/core/src/modules/resolve.test.ts:32`; `team-tools-change.test.ts:43`; `packages/application/src/use-cases/team-tools/team-tools.test.ts:181`                                                                                            | Nenhuma.                                                                                                                             |
| Desativar Backlog com Sprints ativo é recusado e lista quem depende | Sim        | `resolve.test.ts:78`; `team-tools-change.test.ts:56`; `team-tools.test.ts:197`                                                                                                                                                                    | Nenhuma.                                                                                                                             |
| Horas e pontos em conflito                                          | Sim        | `resolve.test.ts:139` e `:148`; `packages/core/src/modules/team-tools.test.ts:78`; `team-tools-change.test.ts:79`; `team-tools.test.ts:215`                                                                                                       | Nenhuma.                                                                                                                             |
| Registro de módulos sem ciclo                                       | Sim        | `packages/core/src/modules/registry.test.ts:70` e `:104` a `:151`                                                                                                                                                                                 | Nenhuma.                                                                                                                             |
| Desativar e reativar devolve os dados                               | Sim        | `team-tools.test.ts:229` (checklist e limite de WIP); `module-guard.test.ts:406`; `resolve.test.ts:178`; `packages/application/src/use-cases/sprints/sprints.test.ts:644` (sprints)                                                               | Para backlog e impedimentos não encontrei teste de reativação com dados por título.                                                  |
| Módulo desativado recusa no backend, mesmo vindo do chat ou do MCP  | Parcial    | `packages/application/src/module-guard.test.ts:219` (um caso de uso representativo por módulo, recusado com `disabled` e executado com `active`); `packages/core/src/modules/team-tools.test.ts:392` (desativado recusa tudo, leitura inclusive). | Chat e MCP não existem no código. A prova cobre o caso de uso, por onde todos os caminhos passam.                                    |
| Desativar Sprints com sprint ativa entra em encerramento sem órfãos | Parcial    | `sprints.test.ts:583` e `:644`; `team-tools-change.test.ts:68`.                                                                                                                                                                                   | Não encontrei teste que cubra o caminho completo (desativar pelo caso de uso de ferramentas com sprint ativa e conferir as tarefas). |

---

## (c) Regressões e lacunas encontradas

Ordenadas por risco. Os itens 1 a 5 são lacunas de risco alto.

1. **Insights de fluxo com o módulo desligado (risco alto).** `packages/application/src/use-cases/dashboard/get-dashboard.ts:44` e `:63` montam `flowWeeks` e `insights` no `dashboard.get`. O mapa `packages/application/src/module-guard.ts:111` e `:112` deixa `dashboard.get` e `dashboard.exportSummary` em `core`. A tela esconde o bloco (`apps/desktop/src/renderer/panel/dashboard/DashboardView.tsx:57`), mas o dado continua saindo. Isso contraria "zero chamada a módulo desativado" (PLANO-2.0, tabela de segurança).

2. **Sinais de "parada" sem controle por módulo (risco alto).** Só o filtro "Paradas" do quadro está atrás de `flowMetrics` (`apps/desktop/src/renderer/panel/board/BoardView.tsx:695`). Estes continuam sem gate:
   - tile "Paradas" do dashboard: `apps/desktop/src/renderer/panel/dashboard/DashboardView.tsx:186` a `:191`, e a contagem por pessoa em `:303` a `:305`;
   - selo "parada Xd" no card do quadro: `BoardView.tsx:806`;
   - alerta "Tarefa parada" no detalhe: `apps/desktop/src/renderer/panel/task-detail/TaskDetailView.tsx:194` a `:197`;
   - bandeja: `apps/desktop/src/renderer/tray/screens/TaskRow.tsx:49` a `:50` e `HomeScreen.tsx:85` e `:130` a `:131`.
     O plano 2.0 não tem módulo de parada, então o sinal aparece para times que desligaram o fluxo.

3. **Check-in da bandeja não respeita o encerramento (risco alto para a experiência).** `apps/desktop/src/renderer/tray/App.tsx:38` só checa `checkins:screen`. O envio em `apps/desktop/src/renderer/tray/screens/DailyScreen.tsx:138` a `:153` não verifica `isWindingDown`. O backend recusa com CONFLITO (`module-guard.ts:14`), mas o usuário vê o erro depois de preencher.

4. **Editar daily existente durante o encerramento (divergência do plano).** `packages/application/src/module-guard.ts:28` a `:29` recusa também a edição da daily de hoje. O plano (`PLANO-2.0.md`, linha 65) diz que o que já existe segue visível e editável. O teste `packages/application/src/module-guard.test.ts:289` cobre só "salvar recusado", não a edição.

5. **Mudança de configuração do módulo não é auditada (risco alto; regra 7 do plano).** `packages/infra-sqlite/migrations/0012_team_tools.sql:36` restringe `team_tools_audit.kind` a `module_state`, `level` e `preset`, sem `config`. O mesmo está em `packages/infra-sqlite/src/schema/team-tools-audit.ts:25`. O limite de sprints ativas (`teamTools.setModuleConfig`) muda sem registro de quem, quando e de quanto para quanto.

6. **Backlog desativado sem destino para os itens (risco alto, decisão de produto).** Com o módulo `disabled`, o guard recusa tudo, inclusive a leitura, então os itens somem (`backlog.test.ts:445`). `packages/application/src/use-cases/team-tools/team-tools.ts:129` só conta os itens de backlog para a prévia; não há passo que os leve para o quadro. O plano (`PLANO-2.0.md`, linha 65) pede que o gestor escolha o destino de cada tipo de item.

7. **Criar item em módulo encerrando (controle de interface parcial).** A maioria das telas já esconde a criação: Backlog (`apps/desktop/src/renderer/panel/backlog/BacklogView.tsx:101`), Sprints (`SprintsView.tsx` e abas), critérios (`CriteriaCard.tsx:58`) e bloqueio (`apps/desktop/src/renderer/panel/task-detail/BlockControl.tsx:57`). Falta o check-in da bandeja (item 3).

8. **Tipo `TenantContext` estrutural (risco médio).** `packages/application/src/tenant-context.ts:11` a `:14` é uma `interface`. Qualquer objeto com `tenantId` e `actor` passa, sem marca nominal. Os casos de uso também continuam exportados e instanciáveis fora da fronteira (`orquestracao-2.0.md`, M1.4). A garantia em runtime vem de `tenant-boundary.test.ts`.

9. **Gravação com id de outra organização tem comportamentos diferentes (risco baixo).** Nos `upsert` de M1.4 é no-op silencioso; em `saveSettings` do M1.5 lança `ValidationError`. Os dois caminhos não são iguais.

10. **Entidades nas telas novas sem teste próprio (risco baixo).** Por construção, `packages/core/src/policies/access-policy.ts:23` e `:104` exigem `participant.kind === 'user'`, e `packages/core/src/rules/impediments.ts:22` a `:25` exige participação do responsável. Há teste de entidade em daily (`daily.test.ts:345`), retro (`retro-actions.test.ts:191`) e participações (`participations.test.ts`), mas não nas telas de backlog, sprints e impedimentos.

11. **Reduced motion nas telas novas.** `ImpedimentsView.module.css:193`, `TeamToolsSection.module.css:273` e `BacklogView.module.css:165` têm `prefers-reduced-motion`. `SprintsView.module.css` não tem transições, então não se aplica. Não verificado visualmente.

---

## Regras de produto do CLAUDE.md

| Regra                                                                                | Situação                     | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                 | Observação                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Estados, nesta ordem: Planejamento, A fazer, Desenvolvendo, Revisar, Concluído       | Preservada                   | `packages/core/src/values/task-status.ts:3` (`planning`, `todo`, `in_progress`, `review`, `done`)                                                                                                                                                                                                                                                                                                                                         | Nenhuma.                                                                                                             |
| Toda edição gera linha do tempo                                                      | Preservada                   | Eventos novos em backlog, critérios, estimativa, impedimentos e sprints (`sprints.ts:137`, `:155`, `:172`; `packages/core/src/rules/sprint-timeline.test.ts:39`)                                                                                                                                                                                                                                                                          | Não verifiquei por título cada evento novo.                                                                          |
| Edição do gestor marcada como Gestor                                                 | Preservada                   | `backlog.test.ts:307` e `:380`; `impediments.test.ts:279`; `estimate.test.ts:47`; `acceptance.test.ts:73`; `archive.test.ts:158`                                                                                                                                                                                                                                                                                                          | A auditoria de ferramentas da equipe não é linha do tempo de tarefa.                                                 |
| Colaborador vê e edita só o que participa; gestor vê dashboard e edita tudo, marcado | Preservada                   | `packages/core/src/policies/backlog-policy.test.ts:39`; `sprint-access.test.ts`; `daily.test.ts:305` (colaborador não lê a daily alheia); `impediments.test.ts:208` (escopo do gestor e do colaborador)                                                                                                                                                                                                                                   | Agendamentos (só o gestor cria e edita): não reverificados nesta auditoria; o M0.2 mexeu só na leitura dos prazos.   |
| Custo = horas × valor/hora por envolvido; o gestor vê tudo, cada um vê o próprio     | Preservada                   | `packages/application/src/use-cases/tasks/estimate.test.ts:96` (Responsável vê o próprio), `:102` (gestor vê), `:110` (apoio vê horas e custo nulo)                                                                                                                                                                                                                                                                                       | `actualHours` e os critérios aparecem no DTO mesmo com o módulo desligado; a interface esconde (orquestração, M3.2). |
| Entidades não dão permissão nem recebem avisos                                       | Preservada por construção    | `access-policy.ts:23`, `:104`; `impediments.ts:22`; `daily.test.ts:345`; `retro-actions.test.ts:191`                                                                                                                                                                                                                                                                                                                                      | Ver item 10 de (c).                                                                                                  |
| `organization_id` em todo dado                                                       | Preservada                   | Migrações 0012 (`team_modules`, `team_preferences`, `team_tools_audit`), 0014 (`task_acceptance_criteria`), 0015 (`sprints`, `sprint_tasks`), 0016 (`task_impediments`) têm a coluna. 0011 e 0013 acrescentam colunas em `tasks` e `projects`, que já a têm. Isolamento testado em `backlog.test.ts:398`, `sprints.test.ts:518`, `impediments.test.ts:307`, `team-tools.test.ts:445`, `daily.test.ts:360`, `suggest-summary.test.ts:277`. | Nenhuma.                                                                                                             |
| Regras de acesso no core e na aplicação, não só na tela                              | Preservada                   | Guard em `packages/application/src/module-guard.ts` dentro de `forTenant`; políticas em `packages/core/src/policies`; testes de mapa em `module-guard.test.ts:464` a `:520`                                                                                                                                                                                                                                                               | Os controles de tela são só complemento.                                                                             |
| `prefers-reduced-motion`                                                             | Preservada onde há movimento | Ver item 11 de (c)                                                                                                                                                                                                                                                                                                                                                                                                                        | Não verificado visualmente.                                                                                          |

---

## (d) Lista priorizada de decisões do Pedro

Cada item traz a decisão que o laço assumiu, as alternativas e o impacto de mudar. A ordem é de prioridade.

### Prioridade alta (riscos das lacunas de (c))

**1. Auditoria da `config` dos módulos (lacuna a).**

- Assumido: a mudança de `config` (hoje, o limite de sprints ativas) não é auditada, porque o CHECK de `team_tools_audit.kind` exigiria recriar a tabela (M4.2).
- Alternativas: (1) migração 0017 que recria `team_tools_audit` com `kind` incluindo `module_config` (conferir as chaves estrangeiras antes); (2) registrar a mudança como `module_state` com campo extra (gambiarra, não recomendo); (3) aceitar e documentar.
- Impacto: a opção 1 é uma migração nova, sem mudança nos casos de uso. Sem ela, a regra 7 do plano não vale para configuração, e o M6a herda a lacuna.

**2. Parada sem módulo (lacuna b).**

- Assumido: o filtro "Paradas" fica atrás de `flowMetrics`; selo, alerta, tile e bandeja ficam sem controle.
- Alternativas: (1) parada é sinal do núcleo: o filtro sai de `flowMetrics` e o sinal fica para todos; (2) parada é métrica de fluxo: selo, alerta, tile e bandeja somem no Kanban simples.
- Impacto: (1) muda o catálogo e faz o Kanban simples mostrar a parada, que é o comportamento de hoje; (2) remove do Básico um sinal que existe hoje.

**3. Insights de fluxo no `dashboard.get` (lacuna c).**

- Assumido: os insights ficam no caso de uso `dashboard.get` em `core`, para não esconder o painel inteiro do gestor.
- Alternativas: (1) separar um caso de uso `dashboard.flowInsights` atrás de `flowMetrics`, consultado pela interface à parte; (2) o caso de uso omite os insights quando o módulo está desligado (exige ler a configuração dentro do caso de uso).
- Impacto: as duas opções mudam o contrato do dashboard e a exportação de resumo (`dashboard.exportSummary`). Enquanto isso, a regra "zero chamada a módulo desativado" não vale para o dashboard.

**4. Backlog desativado (lacuna d).**

- Assumido: com o módulo `disabled`, os itens ficam escondidos e reaparecem na reativação. Não há passo para puxá-los ao quadro.
- Alternativas: (1) no encerramento, o gestor escolhe o destino dos itens (puxar para A fazer ou manter fora do quadro); (2) manter os itens visíveis em leitura durante o encerramento e só esconder quando estiver desligado.
- Impacto: a opção 1 segue o plano (destino por tipo de item) e exige mudar `team-tools.ts` e a tela de ferramentas. A opção 2 muda o guard do backlog.

**5. Check-in e daily durante o encerramento (lacuna e, itens 3 e 4 de (c)).**

- Assumido: a bandeja mostra o envio mesmo com o módulo encerrando; o backend recusa. A edição da daily de hoje também é recusada.
- Alternativas: (1) criar uma capacidade de criação (`checkins:create`) e esconder o botão durante o encerramento; (2) permitir editar a daily existente no encerramento, como o plano descreve.
- Impacto: pequeno na interface da bandeja; a opção 2 altera `module-guard.ts:28` e o teste de daily.

**6. Tipo `TenantContext` e gravação de outra organização (lacuna f e itens 8 e 9 de (c)).**

- Assumido: o tipo é estrutural; a gravação com id de outra organização é no-op silencioso nos `upsert` e erro em `saveSettings`; as classes de caso de uso continuam exportadas.
- Alternativas: (1) tipo nominal (marca `unique symbol`), impedindo objetos literais; (2) recusar com NOT_FOUND ou CONFLICT nos `upsert`, igualando ao `saveSettings`; (3) tornar as classes não exportadas.
- Impacto: (1) e (3) são mudanças pequenas; (2) muda comportamento observável. Todas devem estar prontas antes do M6a, quando o RLS entra.

**7. Decisão provisória 12.3 de Ajustes (lacuna g).**

- Assumido: `docs/PLANO.md:610` previa um placeholder "em breve" em Ajustes. A seção "Ferramentas da equipe" entrou no topo de Ajustes (M2.2), e Ajustes já abria Aparência e Atualizações, então o placeholder perdeu o objeto.
- Alternativas: (1) dar a 12.3 por cumprida e registrar no plano; (2) manter o placeholder em alguma seção vazia.
- Impacto: só documentação.

### Prioridade média (decisões de modelo e de regra)

| Ponto                                                               | Assumido pelo laço                                                                                                             | Alternativas                                   | Impacto de mudar                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------ |
| Padrão das ferramentas (M1.5b)                                      | Scrum completo, nível Avançado; o backfill da 0012 e o seed seguem isso para não esconder WIP, subtarefas, retro e daily.      | Kanban simples, como o plano pede para o seed. | Quem usa hoje perderia recursos; a equipe nova começa mais enxuta. |
| Organização é o mesmo que time (suposição inicial)                  | `organization_id` vira `tenantId`.                                                                                             | Modelo de time separado da organização.        | Mudaria o M6a; o isolamento atual não muda.                        |
| Uma sprint ativa por projeto (ADR-08)                               | Configurável de 1 a 5, padrão 1 (`teamTools.setModuleConfig`).                                                                 | Sem limite no banco; limite fixo.              | Só afeta a validação na aplicação.                                 |
| Política de encerramento: iniciados                                 | Itens já iniciados (Desenvolvendo, Revisar) não voltam ao backlog; ficam no quadro com desfecho `left_on_board` (M4.1 e M4.2). | Voltar ao backlog como os não iniciados.       | Afeta o histórico (`sprint_tasks.outcome`) e a regra do backlog.   |
| Descarte de rascunho                                                | Exclusão lógica (`discarded_at`); o número não se reaproveita (M4.1).                                                          | Apagar a linha.                                | Afeta o número sequencial das sprints.                             |
| Item de backlog adicionado a sprint ativa                           | Puxado para o quadro na hora (M4.1).                                                                                           | Só puxar ao iniciar.                           | Muda o fluxo de planejamento.                                      |
| Iniciar sprint conta como criar para o módulo encerrando            | Recusado durante o encerramento (M4.2).                                                                                        | Permitir iniciar sprint existente.             | Afeta a tela de sprints.                                           |
| Chave de `sprint_tasks` (sprint, tarefa, `added_at` em ms)          | Colisão no mesmo milissegundo é tratada como erro (M4.2).                                                                      | Id ULID próprio.                               | Migração se mudar; risco baixo.                                    |
| Auditoria de sprint iniciada e encerrada                            | Não gravada como evento; o histórico vem de `sprint_tasks` e da linha do tempo das tarefas (M4.2).                             | Evento próprio de sprint.                      | Afeta a auditoria.                                                 |
| Regra de aceite entre membros (ADR-05)                              | Maioria simples, prazo configurável, silêncio não conta (`PLANO-2.0.md`, linha 63).                                            | Outra regra de quórum.                         | Só no M6b; hoje o gestor aplica direto.                            |
| `dependentsOf` não transitivo; sem `autoDisabled` (M1.2)            | A interface chama o resolvedor de novo com os dois módulos em `disable`.                                                       | Resolver as dependências na função.            | Pequeno.                                                           |
| Burndown ativo com horas em encerramento (M1.6b)                    | Fica ativo, porque a alternativa "existe" para o resolvedor.                                                                   | Desligar junto.                                | Afeta a regra de dependência.                                      |
| Encerramento sem detecção automática (M1.6b)                        | O gestor confirma com `completeWindDown` ou antecipa com `finalize`.                                                           | Detectar sozinho quando não há mais itens.     | Afeta a interface de encerramento.                                 |
| `effectiveCapabilities` não resolve dependências (M1.3)             | Quem chama usa `resolveModuleSet` antes.                                                                                       | Resolver dentro.                               | Pequeno.                                                           |
| Nível por equipe, não por pessoa (ADR-06)                           | Capacidades usam o nível da equipe.                                                                                            | Nível por pessoa.                              | Mudaria o modelo de permissão.                                     |
| Definição de pronto aparece no Kanban simples (M2.3, item 6)        | Mostrada, porque é núcleo.                                                                                                     | Esconder atrás de um módulo.                   | Mudança de catálogo.                                               |
| Ajustes do colaborador lista o catálogo inteiro (M2.3, item 3)      | Mostra tudo como "Desativada".                                                                                                 | Mostrar só o que está ativo.                   | Interface.                                                         |
| Agenda no Kanban simples (M2.1)                                     | Aparece, porque o plano põe Agenda no preset.                                                                                  | Tirar do preset.                               | Catálogo.                                                          |
| Motivo do bloqueio no Básico sem "Desbloquear" (M2.1)               | Mostra o motivo; o botão exige `impediments:screen`.                                                                           | Esconder o motivo também.                      | Interface.                                                         |
| Enquanto `teamTools.get` carrega, a tela mostra tudo (M2.1)         | Mostra tudo; o backend segue recusando.                                                                                        | Esconder até carregar.                         | Interface.                                                         |
| Colaborador não vê as próprias tarefas na Equipe (PLANO 6.1 e 2.5)  | Mantido.                                                                                                                       | Mostrar as próprias tarefas.                   | Regra de visão.                                                    |
| WIP no quadro pessoal do gestor conta só as dele (M0, orquestração) | Limite continua da organização.                                                                                                | Contar tudo.                                   | Regra de visão.                                                    |
| Agenda do gestor mostra todos os prazos (M0.2)                      | Restaurado por `listTeamBoard`.                                                                                                | Só os prazos das próprias tarefas.             | Regra de visão.                                                    |
| Semana da agenda começa na segunda (`agendaDays`)                   | Mantido; o PLANO cita domingo em um ponto.                                                                                     | Domingo.                                       | Interface.                                                         |

### Prioridade normal (interface, textos e tela)

| Ponto                                                                                                 | Assumido pelo laço                                                 | Alternativas                          | Impacto de mudar         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- | ------------------------ |
| "Encerrando" com três botões (Reativar, Antecipar, Concluir) (M2.2)                                   | Três botões.                                                       | Interruptor.                          | Interface.               |
| Mudança de nível sem prévia de impacto (M2.2)                                                         | Sem prévia.                                                        | Prévia igual à de ferramentas.        | Interface e caso de uso. |
| Aviso "da equipe" ou "do projeto" (M2.2)                                                              | "da equipe".                                                       | "do projeto", como no plano.          | Texto.                   |
| Descrições dos presets (M2.2)                                                                         | Texto do agente, para revisar.                                     | Texto do Pedro.                       | Texto.                   |
| Lista "Em breve" fixa na interface (M2.2)                                                             | `estimates.points` e `integrations` fixos; o DTO não tem marcador. | Marcador no DTO.                      | Contrato.                |
| Arquivamento: confirmação ao arquivar e desarquivamento direto (M0.3b)                                | Confirma ao arquivar; desarquivar é direto.                        | Confirmar nos dois.                   | Interface.               |
| "Mostrar arquivados" vale na Equipe e no seletor de projetos (M0.3b)                                  | Vale.                                                              | Só no quadro.                         | Interface.               |
| Atalho N com projeto arquivado abre o primeiro ativo (M0.3b)                                          | Assim.                                                             | Mensagem.                             | Interface.               |
| Tarefa em projeto arquivado segue editável; só criar é recusado (M0.3a)                               | Assim.                                                             | Tudo em leitura.                      | Regra de acesso.         |
| Desarquivar leva a tarefa ao topo de "Recentes" (M0.3a)                                               | Assim.                                                             | Manter posição.                       | Interface.               |
| Renomear projeto recusa nome repetido com CONFLITO (M0.4)                                             | Recusa.                                                            | Devolver o existente, como a criação. | Contrato.                |
| Reordenar por arrastar HTML5 no backlog e dnd-kit no quadro (M3.3)                                    | Duas bibliotecas.                                                  | Uma só.                               | Interação.               |
| Seletor de projetos faz uma consulta por projeto (M3.3)                                               | Assim.                                                             | Filtro no backend em `projects.list`. | Desempenho.              |
| "Levar para a próxima" leva também itens já iniciados (M4.3)                                          | Leva.                                                              | Só os não iniciados.                  | Regra de sprint.         |
| Replanejar: mesma duração, começa hoje (M4.3)                                                         | Assim.                                                             | Pedir datas.                          | Interface.               |
| Criar e editar sprint para qualquer membro do projeto (M4.3)                                          | Assim.                                                             | Só o gestor.                          | Regra de acesso.         |
| Mini-quadro de cinco colunas rola na horizontal em tela estreita (M4.3)                               | Assim.                                                             | Empilhar.                             | Layout.                  |
| Título do grupo no check-in: "Tarefas que travaram ou destravaram" (M5.1)                             | Texto que a auditoria aceita.                                      | Outro texto.                          | Texto.                   |
| "Usar sugestão" só preenche o primeiro passo (M5.1)                                                   | Assim.                                                             | Preencher os três.                    | Interface.               |
| Rótulo "Sprint N" opcional no item do check-in (M5.1)                                                 | Não feito.                                                         | Fazer.                                | Interface.               |
| Sugestão de check-in com leitura de timeline por tarefa (N+1) (M5.1)                                  | Assim.                                                             | Consulta agregada.                    | Desempenho.              |
| `nextCandidates` restrito a tarefas com comentário próprio no dia (M5.1)                              | Assim.                                                             | Outra lista.                          | Regra.                   |
| Data futura não é recusada na leitura da sugestão (M5.1)                                              | Assim.                                                             | Recusar.                              | Contrato.                |
| Impedimento: "Meus" é quem resolve (`ownerId`) (M5.2b)                                                | Assim; impedimento sem responsável não aparece no check-in.        | Incluir os sem responsável.           | Interface.               |
| Criador que não participa não aparece em "Quem resolve" (M5.2b)                                       | Assim, porque o DTO não traz `createdBy`.                          | Incluir.                              | Contrato.                |
| Marcador "Bloqueada" no item do backlog (M5.2b)                                                       | Novo.                                                              | Sem marcador.                         | Interface.               |
| Botões "Usar" com o mesmo nome em todas as linhas (M5.2b)                                             | Sem `aria-label`.                                                  | `aria-label` com o texto da linha.    | Acessibilidade.          |
| Painel "Seus impedimentos abertos" depende de `impediments:passive` (M5.2b)                           | Assim.                                                             | `:screen`.                            | Interface.               |
| Atualizações sem otimismo nas telas de impedimentos (M5.2b)                                           | Invalidação.                                                       | Atualização otimista.                 | Desempenho.              |
| "Desbloquear" virou "Resolver impedimento" com nota opcional (M5.2b)                                  | Assim.                                                             | Manter o nome.                        | Texto.                   |
| Bloquear tarefa já bloqueada é no-op (M5.2a)                                                          | Assim, como o código já fazia; o briefing dizia recusado.          | Recusar com CONFLITO.                 | Contrato.                |
| Concluir ou desbloquear resolve o impedimento sem nota (M5.2a)                                        | Assim.                                                             | Exigir nota.                          | Regra.                   |
| Quem sai da tarefa mantém o direito de resolver como responsável (M5.2a)                              | Assim, mas some da lista.                                          | Perder o direito.                     | Regra de acesso.         |
| Membros do projeto que não participam não veem impedimentos (M5.2a)                                   | Assim, pelo escopo da participação.                                | Visão do projeto.                     | Regra de acesso.         |
| `impediments.resolve` aceita responsável sem participação; `tasks.unblock` exige poder editar (M5.2a) | Assim.                                                             | Mesma regra.                          | Regra de acesso.         |
| Backfill do impedimento usa o id da tarefa (M5.2a)                                                    | Assim (ULID válido e único).                                       | Id novo.                              | Dado.                    |
| Motivo de bloqueio com 280 caracteres (migração 0016)                                                 | Limite do banco.                                                   | Outro limite.                         | Contrato.                |

### Qualidade e testes (sem decisão de produto, mas com pendência)

- Persistência de criar, editar e mover tarefa em SQLite não foi provada nesta auditoria por teste específico (ver M0).
- Não há teste ponta a ponta com app real (M10.3 pendente).
- O guard lê a configuração dentro de cada chamada, fora da transação do caso de uso; reavaliar no M6b (`module-guard.ts`, orquestração M1.6a).
- Linha ausente em `team_modules` conta como desligada, mas o padrão em código vale só quando a equipe nunca gravou (M1.5). Confirmar.
- Id da auditoria é autoincrement (M1.5); no M6a/Postgres deve virar outro tipo.
- Mensagem de `conflicting_request` por dependência é genérica (M1.6b).
- Sincronização entre janelas pelo canal de mudanças não foi testada de ponta a ponta (M2.2 e M4.3).
- Arquivo `/x` na raiz do sistema: remover com `rm /x` (fora do repositório).

---

## (e) O que fica para depois

- **Ondas 2 a 5 do plano** (não iniciadas):
  - M6a: Postgres em Docker (ADR-01), login, sessões e e-mail próprios (ADR-10), tabelas `tenants`, `memberships` e `invitations`, RLS, resolvedor de time para conexão.
  - M6b: `apps/server`, eventos por time (LISTEN/NOTIFY e SSE, ADR-09), aceite entre membros das mudanças de ferramentas (ADR-05), cache de leitura em SQLite, migração com dry-run.
  - M7: executor de comandos tipados.
  - M8: servidor MCP interno.
  - M9: IA local (Laya, `TextModel`).
  - M10: fluxo avançado e métricas (WIP com ciclo, subtarefas e dependências, review e retro, burndown, velocity, lead e cycle time).
  - M11: integrações (commits, GLPI, Azure DevOps).
- **Aceite entre pessoas das mudanças de ferramentas (ADR-05, M6b).** Hoje o gestor aplica direto; a regra de aceite está testada só no domínio com votos simulados.
- **Chat e MCP.** Não existem no código, então a recusa de módulo desativado "pelo chat ou pelo MCP" não tem teste de ponta a ponta.
- **Burndown e velocity.** Não têm caso de uso nem tela. Os módulos `estimates.points` e `integrations` existem só no catálogo.
- **Pendências antigas do MVP.** Testes de ponta a ponta (M10.3), validação no Windows, conferência visual geral e o que está em `docs/laco/pendencias-do-pedro.md` (este arquivo não foi lido nesta auditoria).
- **Conferência visual das telas novas.** Nenhuma destas foi aberta em janela real: Ferramentas da equipe, Backlog, Sprints (incluindo o mini-quadro em tela estreita), Impedimentos, sugestão de check-in na bandeja (altura do passo 1) e a sincronização entre janelas.
- **Ambiguidade no catálogo.** Dependências e níveis mínimos por módulo são propostas do agente (M1.1) e precisam de revisão do Pedro.

---

## (f) Métricas

### Commits da onda (`git log --reverse 3d04054^..HEAD`)

Total: **26 commits**, de `3d04054` (primeiro commit da onda) a `a18d7ad` (HEAD), todos em 2026-11-16.

- **M0** (5 commits, mais 1 de registro):
  - `3d04054` fix(m0.1): gestor vê as próprias tarefas em "Minhas tarefas" e todas na Equipe
  - `148724e` docs: registra M0.2 em andamento na orquestração do Plano 2.0 (registro)
  - `f1a3098` feat(m0.2): agenda do gestor mostra todos os prazos da organização
  - `093cbd0` feat(m0.3a): arquivar e desarquivar tarefa e projeto (backend)
  - `d71e649` feat(m0.3b): interface para arquivar e desarquivar tarefa e projeto
  - `993f321` feat(m0.4): renomear projeto
- **M1** (8 commits):
  - `aa186e9` feat(m1.1): registro de módulos, níveis de proficiência e presets
  - `6c60343` feat(m1.2): resolveModuleSet e dependentsOf
  - `1f41522` feat(m1.3): effectiveCapabilities e helpers de capacidade
  - `9554180` feat(m1.4): TenantContext obrigatório nos casos de uso
  - `c506e4b` feat(m1.5): persistência das ferramentas e do nível da equipe
  - `00fc32f` fix(m1.5b): padrão das ferramentas preserva o comportamento atual
  - `9e1151a` feat(m1.6a): guard de módulo no backend
  - `aa2b155` feat(m1.6b): casos de uso das ferramentas da equipe
- **M2** (3 commits):
  - `73771ac` feat(m2.1): interface adaptativa por nível e ferramentas ativas
  - `a15ef85` feat(m2.2): tela Ferramentas da equipe
  - `f50b5b9` test(m2.3): time Básico trabalha sem Scrum; fluxo some do dashboard no Kanban simples
- **M3** (3 commits):
  - `5070614` feat(m3.1): backlog (domínio, persistência, aplicação e contrato)
  - `0ff5b03` feat(m3.2): critérios de aceitação e estimativa em horas
  - `334c1b1` feat(m3.3): telas de backlog, critérios de aceitação e estimativa
- **M4** (3 commits):
  - `477ee95` feat(m4.1): sprint no domínio
  - `1b2b714` feat(m4.2): sprints (persistência, casos de uso e contrato)
  - `e8673fb` feat(m4.3): telas de sprints e marcador Sprint N
- **M5** (3 commits):
  - `79d3fcc` feat(m5.1): check-in com resumo sugerido pela bandeja
  - `1559b3c` feat(m5.2a): impedimento com estado e responsável (backend)
  - `a18d7ad` feat(m5.2b): interface de impedimentos

Este relatório (M5.3) ainda não tem commit.

### Migrações novas

| Migração                             | Cria ou altera                                                         | Observação                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0011 `task_project_archive`          | `archived_at` e `archived_by` em `projects` e `tasks`                  | Só colunas nulas.                                                                                                                               |
| 0012 `team_tools`                    | Tabelas `team_modules`, `team_preferences` e `team_tools_audit`        | Backfill: nível Avançado e todos os módulos ativos, exceto `estimates.points` e `integrations`. CHECK de `kind` sem `config` (ver (c), item 5). |
| 0013 `task_backlog`                  | `tasks.backlog_rank` e índice                                          | Nulo = está no quadro.                                                                                                                          |
| 0014 `acceptance_criteria_estimates` | Tabela `task_acceptance_criteria` e `tasks.estimated_hours_hundredths` | Sem CHECK de faixa na coluna (validado no domínio).                                                                                             |
| 0015 `sprints`                       | Tabelas `sprints` e `sprint_tasks`                                     | Índice único parcial: uma linha aberta por tarefa; número único por projeto.                                                                    |
| 0016 `task_impediments`              | Tabela `task_impediments`                                              | Backfill dos bloqueios atuais; índice único parcial: um aberto por tarefa.                                                                      |

### Testes

- Arquivos de teste: **285** no final (apps/desktop 97, packages/core 59, packages/application 36, packages/ui 36, packages/infra-sqlite 33, packages/contract 22, tooling 2). O número no início da sessão não foi informado com arquivos; o log do M0.1 registra 188 arquivos de teste e os testes em 1575.
- Testes: **1572** no início da sessão (informado) e **2515** no `pnpm check` final, ou seja, +943.
- `pnpm check` desta auditoria: **285 arquivos, 2515 testes, todos passando**; formatação, lint com zero avisos, typecheck e build sem erro. Duração total: 2m44s.

### Mapa de módulos × casos de uso × telas

Contagem a partir do mapa `USE_CASE_MODULES` em `packages/application/src/module-guard.ts`: 95 casos de uso mapeados (o teste de cobertura do mapa passa).

| Módulo                                         | Casos de uso (quantidade e exemplos)                                                                                          | Telas e capacidades encontradas                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `core`                                         | 47: `tasks.archive`, `projects.*`, `users.*`, `contributors.*`, `dashboard.get`, `dashboard.exportSummary`, `teamTools.*` (7) | Quadro, detalhe, dashboard (com ressalva), Ajustes e Ferramentas da equipe |
| `agenda`                                       | 5: `meetings.listRange`, `listUpcoming`, `create`, `update`, `delete`                                                         | `agenda:screen` (4 usos)                                                   |
| `backlog`                                      | 5: `backlog.list`, `add`, `reorder`, `pull`, `sendBack`                                                                       | `backlog:screen` (2), `backlog:passive` (1)                                |
| `sprints`                                      | 9: `sprints.list`, `get`, `create`, `update`, `start`, `close`, `discard`, `addTask`, `removeTask`                            | `sprints:screen` (2), "Sprint N" no card                                   |
| `subtasks`                                     | 5: `tasks.checklist.*`                                                                                                        | `subtasks:screen` (1), `subtasks:passive`                                  |
| `reviewRetro`                                  | 5: `meetings.retroActions.*`                                                                                                  | `reviewRetro:screen` (1)                                                   |
| `impediments`                                  | 5: `tasks.block`, `tasks.unblock`, `impediments.list`, `assign`, `resolve`                                                    | `impediments:screen` (3), `impediments:passive` (12)                       |
| `checkins`                                     | 5: `daily.getToday`, `save`, `listForDate`, `getForUser`, `suggestSummary`                                                    | `checkins:screen` (5), cartão da bandeja                                   |
| `acceptance`                                   | 5: `tasks.criteria.*`                                                                                                         | `acceptance:passive` (1), cartão de critérios                              |
| `wip`                                          | 2: `boardSettings.get`, `setWipLimits`                                                                                        | `wip:screen` (1), `wip:passive`                                            |
| `flowMetrics`                                  | 1: `tasks.getBoardFlow`                                                                                                       | `flowMetrics:screen` (5): filtro Paradas e bloco de fluxo                  |
| `estimates.hours`                              | 1: `tasks.setEstimate`                                                                                                        | `estimates.hours:passive` (2)                                              |
| `burndown`, `estimates.points`, `integrations` | nenhum                                                                                                                        | sem tela; só no catálogo (M10 e fora do MVP)                               |

Ferramentas da equipe: `tools:view` (7 usos) e `tools:manage` (7 usos), sempre no `core`.

---

## (g) Como abrir e ver (roteiro curto)

1. **Preparar a base de demonstração.** Na raiz, rode `pnpm db:reset && pnpm db:seed`.
   **Atenção:** `db:reset` apaga `.data/agilebox.db` (e os arquivos `-shm` e `-wal`). Não rode se quiser manter os dados atuais.
2. **Abrir o app.** Rode `pnpm dev`. O painel abre; a bandeja fica no ícone da barra de tarefas.
3. **Trocar para o gestor.** Clique no botão **Conta** (avatar), escolha **Trocar de perfil** e selecione **Gestor**. Use **Pedro** para ver o que o colaborador vê.
4. **Abrir Ferramentas da equipe.** Vá em **Ajustes** e abra a seção **Ferramentas da equipe** (no topo). A base começa com o padrão de código (Scrum completo, nível Avançado), salvo se o seed mudou.
5. **Aplicar o preset Scrum.** Escolha o preset **Scrum** e confira a prévia de impacto antes de aplicar. Para testar o time Básico, aplique **Kanban simples** e troque o nível para Básico.
6. **Criar item de backlog.** Abra **Backlog** (atalho G B, ou pelo menu) e crie um item rápido. Reordene pela lista (botões Subir e Descer ou arrastar).
7. **Criar e iniciar sprint.** Abra **Sprints**, crie um rascunho e adicione itens do backlog. Clique em **Iniciar sprint**: os itens do backlog vão para A fazer.
8. **Encerrar com cada política.** Em **Encerrar sprint**, escolha:
   - devolver os itens abertos ao backlog (política `return_to_backlog`); ou
   - **Levar para a próxima** (política `carry_over`), que exige um rascunho seguinte.
     Itens já iniciados não voltam ao backlog na primeira política; ficam no quadro.
9. **Desativar com encerramento.** Em **Ferramentas da equipe**, desligue Sprints ou Backlog. O módulo fica em **Encerrando**: o que existe segue visível e editável, e a criação é recusada. Use **Concluir** para desativar de vez, ou **Antecipar** para pular a espera.
10. **Abrir Impedimentos.** Abra **Impedimentos** (atalho G I, ou pelo menu). Atribua responsável, resolva com nota e veja o histórico no detalhe da tarefa.
11. **Usar a sugestão do check-in.** Na bandeja, clique no cartão "Vamos registrar o que foi feito hoje?". No passo 1, clique em **Usar sugestão** para preencher o texto a partir das tarefas movidas. Nada é gravado sem confirmar.

Observação: o passo 9 com check-in ativo mostra o envio na bandeja mesmo em encerramento (ver (c), item 3).

---

## Como esta auditoria foi feita

- Leitura de `CLAUDE.md`, `AGENTS.md`, `docs/PLANO-2.0.md` e `docs/laco/orquestracao-2.0.md`.
- Consulta de commits (`git log`), migrações SQL e lista de arquivos de teste.
- Busca por títulos de teste (`it`/`describe`) e por código (`Grep`/`Read`) nos arquivos citados.
- Uma única execução de `pnpm check`, com o log em `/tmp/claude-0/pnpm-check-m53.log`.
- Nenhum arquivo de produção ou teste foi alterado; nenhuma dependência foi instalada.
