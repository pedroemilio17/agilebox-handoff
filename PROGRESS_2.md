# Progresso

Plano: `docs/AgileBox 2.0 — Plano de entregas por camadas e marcos.md` (linha M0). Regras do laço: ver prompt do orquestrador.

## M0 · Estabilizar o MVP

Pronto quando: criar, editar, mover e reabrir persistem; nenhuma tela estática.

- [x] M0.1 Definir a semântica de "Minhas tarefas" do gestor (decisão aberta; registrar em `docs/decisoes/`) — teste: nenhum, só o ADR — decidido: opção A (ADR 0004)
- [x] M0.2 Caso de uso `listTasks` com escopo `mine|team` respeitando a regra de acesso — teste: `task-lists.test.ts` (colaborador em `team` só vê as suas; gestor vê todas) — sonnet
- [x] M0.3 Contrato Zod do escopo `mine|team` em `packages/contract/src/tasks.ts` — teste: `tasks.test.ts` — haiku
- [x] M0.4 Conectar o seletor "Minhas tarefas | Equipe" no painel ao escopo — teste: Testing Library, trocar o seletor refaz a listagem — haiku
- [x] M0.5 Campo `archivedAt` em tarefa e projeto (core + migração + mapper) — teste: `repository-contract.test.ts` — sonnet
- [x] M0.6 Casos de uso `archiveTask`/`unarchiveTask` com entrada na linha do tempo (marca Gestor) — teste: `tasks.test.ts` — sonnet
- [x] M0.7 Casos de uso `archiveProject`/`unarchiveProject`; listas ocultam arquivados por padrão — teste: `projects.test.ts` — sonnet
- [x] M0.8 Caso de uso `renameProject` com permissão e linha do tempo — teste: `projects.test.ts` — sonnet
- [x] M0.9a Ponte IPC (canais, contrato Zod, handlers, cliente) para archiveTask/unarchiveTask/archiveProject/unarchiveProject/renameProject — teste: contrato + handlers — haiku
- [ ] M0.9b Botões Arquivar/Renomear na UI do painel, com ação desfazer — teste: Testing Library — haiku
- [x] M0.10 Teste de persistência: criar, editar, mover e reabrir tarefa após reiniciar o banco — teste: `create-sqlite-adapters.test.ts` — haiku
- [ ] M0.11 Varredura: nenhuma tela/controle estático no painel (lista de pendências) — teste: `pnpm check` verde — sonnet

Notas do M0.7 (sessão Claude):

- Concluído e commitado em `d975152` (M0.6 e M0.7 juntos): `ArchiveProject`/`UnarchiveProject` (`use-cases/projects/archive-project.ts`), `ListProjects` com `includeArchived` (padrão oculta arquivados), ligados em `create-use-cases.ts`. `pnpm check` verde antes dos arquivos de M0.8 aparecerem na árvore.
- Decisão a confirmar pelo Pedro: a permissão de arquivar/desarquivar projeto reutiliza `canManageMembers` (criador ou gestor). O `docs/MVP.md` não define essa regra. Não há linha do tempo para projeto (não estava no escopo do M0.7).
- Não toquei em M0.8: há trabalho não commitado de outra sessão em `rename-project.ts` e `create-sqlite-adapters.test.ts`. Combinar antes de continuar.

Notas desta sessão (M0.9):

- Feito: nada de código. M0.9 não foi iniciado.
- Falta: M0.8 (renomear, outra sessão), depois M0.9, depois M0.11.
- Próximo item independente: nenhum. M0.9 depende de M0.8 (botão Renomear chama `renameProject`). M0.11 é a varredura final e depende de M0.8 e M0.9. M0.10 já está concluído.
- `pnpm check` falhou na primeira rodada: `format:check` (formatação deste arquivo, corrigida com Prettier) e um teste de `apps/desktop/src/renderer/panel/App.manager.test.tsx` por timeout de `findByRole` sob carga. Passou sozinho e na segunda rodada completa (950/950). Teste instável, não tocado.

Notas desta sessão (M0.9a, 2026-11-02):

- Feito: ponte IPC. O trabalho não commitado de contrato (`packages/contract`), canais, `register-handlers.ts` e `ipc-client.ts` já estava na árvore e foi concluído. `projects.list` agora aceita `{ includeArchived }` opcional. Cobertura: `projects.test.ts` e `tasks.test.ts` (contrato) e `ipc-client.test.ts` (canais enviados). O teste de handlers `register-handlers.test.ts` já confere que cada canal de `API_CHANNELS` tem handler.
- Correções para o `pnpm check` ficar verde: `ipc-client.test.ts` sem parâmetros não usados (lint) e mock tipado de forma compatível (typecheck); `ListProjects.execute` aceita `includeArchived: boolean | undefined` (exactOptionalPropertyTypes, sem mudar comportamento).
- `pnpm check` verde na última rodada: 119 arquivos, 955 testes, build ok. Nenhum commit feito.
- Falta: M0.9b (botões Arquivar/Renomear no painel com ação desfazer). Não iniciado: precisa combinar antes com o Pedro, como pede o CLAUDE.md (onde ficam os botões, como funciona o desfazer). Depois M0.11.
- Não toquei em M0.8 nem em `rename-project.ts` / `create-sqlite-adapters.test.ts`.
- Teste instável `App.manager.test.tsx` não foi tocado; passou nesta rodada.

BLOQUEIO: M0.9b aguarda combinação com o Pedro sobre a UI (posição dos botões e desfazer). M0.8 concluído em `e9748ab`.

Pendências para o Pedro:

- Permissão de arquivar/renomear projeto reutiliza `canManageMembers` (criador ou gestor); `docs/MVP.md` não define essa regra.
- Projetos não têm linha do tempo (só tarefas); M0.8 entregou só permissão e nome.
- `createProject` reaproveita projeto arquivado com o mesmo nome, sem avisar. Decisão do Pedro: não reaproveitar; criar projeto novo. Regra na aplicação feita (ver notas abaixo). Bloqueio aberto: o índice único do SQLite (ver notas abaixo).

Notas desta sessão (2026-11-02, decisão do Pedro sobre `createProject`):

- Decisão: `createProject` não reaproveita projeto arquivado com o mesmo nome (`nameKey`); cria um projeto novo. Reaproveita só projeto ativo.
- Feito: `packages/application/src/use-cases/projects/create-project.ts` ignora `existing` e `raced` quando `archivedAt !== null`. Teste novo em `projects.test.ts`: "não reaproveita projeto arquivado com o mesmo nome e cria um projeto novo". Testes de projetos: 13/13.
- (Resolvido: opção A, ver abaixo) Antes: o índice `projects_organization_name_key_unique` (migração `0000_harsh_miek.sql`, mantida em `0001_archived_at.sql`) é único e não parcial. Confirmado com `better-sqlite3`: depois das migrações, o índice está `ON projects (organization_id, name_key)`. Com a regra nova, criar projeto com o nome de um arquivado cai em erro de UNIQUE no SQLite. O fake em memória não aplica essa restrição, então os testes não pegam o problema.
- Opções: (A) recomendada: nova migração que troca o índice por um parcial `WHERE archived_at IS NULL`; é um índice por organização e nome só entre projetos ativos. (B) manter o índice e tratar o erro com mensagem clara ("já existe um projeto arquivado com este nome"); contraria a decisão. Escolher antes de fechar esta decisão. Não criei migração sem o aval.
- DECISÃO A TOMADA (2026-11-02, Pedro delegou a escolha ao Claude): migração aditiva `packages/infra-sqlite/migrations/0002_projects_active_name_unique.sql` troca `projects_organization_name_key_unique` por índice único parcial `(organization_id, name_key) WHERE archived_at IS NULL`. Schema Drizzle (`src/schema/projects.ts`), snapshot `0002_snapshot.json` e journal gerados pelo `pnpm db:generate --name projects_active_name_unique`. Migrações 0000 e 0001 não foram alteradas.
- Teste novo em `packages/infra-sqlite/src/client.test.ts`: dois ativos com o mesmo nome falham (UNIQUE); após arquivar, um novo com o mesmo nome entra; um segundo ativo com esse nome continua falhando.
- `pnpm check` com saída 0 (119 arquivos e 957 testes passando). Nada commitado.
- Não toquei em M0.9b, M0.11 nem em M1. Próximo item de M0 sem decisão pendente: nenhum (M0.9b e M0.11 dependem da UI). M1 é um marco grande, não um item pequeno, então não iniciei.

## Proposta M1 para o Pedro

Escopo (plano 2.0, marco M1): motor de capacidades dentro de um time, só domínio, aplicação e persistência. Nenhum item abaixo mexe em tela; a apresentação (menu por nível, tela Ferramentas da equipe, prévia visível) é do M2.

Achados da leitura do código que mudam a proposta:

- Não existe `team_preferences` nem `team_modules` no repositório. O plano diz que `tenant_settings` "estende" `team_preferences`, mas essa tabela não existe. M1 cria as tabelas do zero.
- `organizationId` já é o primeiro parâmetro de todas as portas de repositório (`ports/*.ts`) e de `Actor`. Então "tenantId nos repositórios" é mais renomear e exigir do que filtrar do zero.
- Nos `packages/application/src/use-cases`, 17 arquivos e 107 chamadas `execute(actor, …)`: o `TenantContext` na assinatura é uma mudança mecânica grande. Por isso o item M1.10 vai em quatro commits, um por pasta.
- Há dois "M1" no repositório: o `PROGRESS.md` (esqueleto do MVP, já feito) e este arquivo (M1 da 2.0). O laço do Codex (`scripts/codex-loop/run.sh`) lê só `PROGRESS.md`. Hoje, este arquivo não é lido pelo laço (ver D10).
- O título do catálogo no plano diz "14 módulos", mas a lista tem 15 ids (`core` a `burndown`). Vale conferir ao fazer M1.1 (ver D8).

Sequência (cada linha é uma tarefa de ~1 commit; `pnpm check` verde antes de cada commit):

| Item   | Tarefa                                                                                                                                                    | Decisão de UI/design?    | Arquivos prováveis                                                                                                                                                  | Testes                                                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1   | Registro de módulos: `ModuleId`, `ModuleDefinition` e os 15 módulos com `requires`, `requiresAnyOf`, `conflicts`, `minLevel` e `core`                     | Não                      | `packages/core/src/modules/registry.ts`, `modules/types.ts`, `modules/index.ts`, `core/src/index.ts`                                                                | `modules/registry.test.ts`: referências existem, sem ciclo, conflitos simétricos, `core` marcado                                                               |
| M1.2   | `resolveModuleSet(current, change)`: ativar puxa dependências, desativar recusa com lista de dependentes, conflito recusado                               | Não                      | `modules/resolve-module-set.ts` e teste                                                                                                                             | Cenários do plano: Sprints puxa Backlog; desligar Backlog com Sprints recusado; horas × pontos em conflito; Burndown exige horas OU pontos; `core` não desliga |
| M1.3   | Estado do módulo (`active`, `winding_down`, `disabled`) e transições puras: iniciar encerramento, concluir, reativar; `canAcceptNewItems`                 | Não                      | `modules/module-state.ts` e teste                                                                                                                                   | Transição inválida recusada; `winding_down` aceita só o que já existe; reativar não altera dados (função não toca em entidades)                                |
| M1.4   | `ExperienceLevel` (`basic`, `intermediate`, `advanced`) e `effectiveCapabilities({ modules, level, role })`; tela só se módulo ativo e nível ≥ `minLevel` | Não (depende de D5)      | `modules/capabilities.ts`, `modules/experience-level.ts` e testes                                                                                                   | Módulo desativado some em qualquer nível; nível alto não ativa nada; efeito passivo fica visível                                                               |
| M1.5a  | Porta `TeamModuleRepository` e `TeamSettingsRepository` (estado por time e nível) com fake em memória e contrato                                          | Não (depende de D2)      | `application/src/ports/team-module-repository.ts`, `ports/index.ts`, `deps.ts`, `testing/fakes/*`, `testing/repository-contract.ts`                                 | `repository-contract.test.ts` roda nos dois adaptadores                                                                                                        |
| M1.5b  | Migração `0003` aditiva com `team_modules` (time, módulo, estado, configuração, alterado por e em) e `team_settings`; adaptador SQLite e mapper           | Não                      | `infra-sqlite/migrations/0003_*.sql`, `src/schema/team-modules.ts`, `src/schema/team-settings.ts`, `schema/index.ts`, `repositories/`, `mappers/`, `client.test.ts` | Migração aplica sobre 0000–0002; persiste e relê; chave única por time e módulo                                                                                |
| M1.6   | Casos de uso `GetTeamModules` e `ChangeTeamModules` (aplicam direto pelo gestor, sem aceite), gravando histórico da mudança                               | Não (depende de D7)      | `application/src/use-cases/team-modules/*.ts`, `create-use-cases.ts`, teste                                                                                         | Colaborador recusado; gestor aplica; mudança inválida recusada sem gravar; histórico criado com quem, quando e o quê                                           |
| M1.7   | Prévia de impacto `previewModuleChange`: contagens por módulo de tarefas, projetos e participações que dependem dele                                      | Não (depende de D4)      | `modules/impact-preview.ts`, use case e teste                                                                                                                       | Contagens corretas; módulo sem itens dá zero; desligar nunca apaga contagem                                                                                    |
| M1.8   | Guard de módulo (`requireModuleEnabled`) aplicado à Agenda (listar, criar, editar, excluir)                                                               | Não (depende de D3)      | `packages/application/src/use-cases/meetings/meetings.ts`, `modules/guard.ts`, testes                                                                               | Agenda desligada recusa até para gestor; `winding_down` deixa editar e excluir, não criar                                                                      |
| M1.9   | Tipo `TenantContext` derivado do `Actor` e função `createTenantContext(actor)`                                                                            | Não (depende de D1 e D9) | `packages/core/src/policies/tenant.ts` (ou application), teste                                                                                                      | Contexto sem `organizationId` não é criado                                                                                                                     |
| M1.10a | `TenantContext` nos casos de uso de projetos                                                                                                              | Não                      | `use-cases/projects/*.ts`, `create-use-cases.ts` e testes                                                                                                           | `pnpm typecheck` e testes de projetos verdes                                                                                                                   |
| M1.10b | Idem para tarefas e participações                                                                                                                         | Não                      | `use-cases/tasks/*.ts`, `use-cases/participations/*.ts`                                                                                                             | Idem                                                                                                                                                           |
| M1.10c | Idem para contribuintes, usuários e sessão                                                                                                                | Não                      | `use-cases/contributors/*.ts`, `users/*.ts`, `session/*.ts`                                                                                                         | Idem                                                                                                                                                           |
| M1.10d | Idem para agenda, linha do tempo e dashboard; ajuste em `apps/desktop/src/main/composition-root.ts` e `ipc/register-handlers.ts`                          | Não                      | `use-cases/meetings`, `timeline`, `dashboard`, `apps/desktop/src/main/*`                                                                                            | Idem; testes de handlers                                                                                                                                       |
| M1.10e | Idem para ferramentas do time (`team-modules`, decisão D9 de consistência, fora da lista original)                                                        | Não                      | `use-cases/team-modules/*.ts`                                                                                                                                       | Idem; isolamento entre organizações                                                                                                                            |
| M1.11  | Teste de isolamento: repositório do time A não devolve linha do time B (SQLite) e teste de tipo que exige o contexto em todo caso de uso                  | Não                      | `repository-contract.ts`, `create-use-cases.test.ts`, `expectTypeOf`                                                                                                | Cross-tenant vazio em todas as portas; `expectTypeOf` falha se um caso de uso aceitar sem contexto                                                             |
| M1.12  | Fechamento do marco: cobertura das regras de dependência e conflito em 100%, lint de fronteiras e notas no `PROGRESS_2.md`                                | Não                      | `pnpm coverage` e notas                                                                                                                                             | Pronto quando: `pnpm check` verde e `pnpm coverage` mostra 100% em `modules/`                                                                                  |

### Primeira fatia sem decisão pendente

**M1.1 e M1.2** (só `packages/core`, sem tela, sem banco). Não dependem de nenhuma resposta: o catálogo é o do plano e mudar uma seta é mudar uma linha. Se o Pedro quiser ajustar o catálogo (D8), o ajuste é de dados e não muda a função. Sugestão: começar por M1.1 (ciclo e referências) e fechar M1.2 no mesmo dia.

### Decisões que travam o resto (A/B)

- **D1. Organização é o time?** A: sim; `tenantId` é o `organizationId` que já existe e o `TenantContext` só o embrulha. Não há migração de nome. B: criar `tenants` agora. Recomendo A (o plano pede `tenants` no M6a, e o M1 não precisa dela). Trava: M1.9 a M1.11.
- **D2. Onde guardar módulos e nível no M1?** A: tabelas novas `team_modules` e `team_settings` (migração `0003`, aditiva). B: reaproveitar `local_settings` (chave-valor do computador, sem migração). Recomendo A: `local_settings` é da máquina e o plano pede dado por time. Trava: M1.5b.
- **D3. Quais casos de uso ganham guard já no M1?** A: só a Agenda, que é o único módulo com caso de uso hoje. B: nenhum; o guard só é testado com módulo de teste. Recomendo A: testa a regra com dado real. Trava: M1.8.
- **D4. Prévia de impacto no M1?** A: só contagens do que existe (tarefas, projetos, participações); backlog e sprints entram quando chegarem. B: adiar a prévia para o M2, junto com a tela. Recomendo A, porque a lista de entregas do M1 já a inclui. Trava: M1.7.
- **D5. Formato de `effectiveCapabilities`.** A: lista de módulos efetivos mais nível e papel; a permissão continua em `access-policy.ts`. B: capacidades finas `{ módulo, ação }`. Recomendo A: é o mínimo que o M2 precisa e não duplica a permissão. Trava: M1.4 (não bloqueia M1.1 a M1.3).
- **D6. Quem é gestor no M1?** A: o `role` global atual (`manager`); `memberships` com papel fica para o M6a. B: esperar o M6a para decidir. Recomendo A. Não trava nada técnico agora, mas define quem aplica mudanças em M1.6.
- **D7. Histórico das mudanças de ferramentas (auditoria).** A: tabela própria `team_module_events` (quem, quando, o quê), gravada no mesmo commit da mudança. B: só `alterado_por` e `alterado_em` na linha, sem histórico. Recomendo A: o plano pede auditoria de toda mudança. Trava: M1.6.
- **D8. Catálogo: 14 ou 15 módulos?** A: manter os 15 ids da lista do plano e corrigir o título. B: remover ou juntar algum (por exemplo `estimates.points`, que o ADR-07 deixa como módulo futuro). Recomendo A, e tratar `estimates.points` só como conflito de teste. Não trava M1.1 (é só dado).
- **D9. Forma do `TenantContext` na assinatura.** A: parâmetro obrigatório `ctx: TenantContext` em cada caso de uso (diff grande, mas o tipo garante a regra "sem contexto não compila"). B: o `Actor` já carrega o time e o contexto é só um tipo derivado (diff pequeno, a garantia fica no teste de tipo do M1.11). Recomendo A, feito em quatro commits (M1.10a a d). Trava: M1.10.
- **D10. Onde registrar o M1 da 2.0?** A: criar `PROGRESS-2.md` lido pelo laço (ajustar `run.sh` para aceitar o arquivo). B: continuar aqui e cada passo é feito manualmente, sem o Codex. Recomendo A se o laço for usado no M1; B se for feito por sessões Claude. Não trava o código, trava a automação.

Pendências de confirmação que não travam nada agora: ADR-08 e ADR-09 (são de M4 e M6b), aceite por maioria (M6b) e quem troca de modelo (M9).

Checagem desta proposta: nenhum código foi alterado; só este arquivo.

## Decisões tomadas (recomendadas)

O Pedro mandou seguir a opção recomendada de D1 a D10 (2026-11-02). Cada linha vale como decisão. O que muda na execução está nas notas do M1.

- **D1. Organização é o time.** `tenantId` é o `organizationId` que já existe; `TenantContext` só o embrulha. Sem migração de nome e sem tabela `tenants` no M1.
- **D2. Módulos e nível em tabelas novas** `team_modules` e `team_settings` (migração `0003`, aditiva). `local_settings` fica para dado da máquina.
- **D3. Guard de módulo no M1 só na Agenda**, o único caso de uso de módulo que existe hoje.
- **D4. Prévia de impacto no M1 com contagens do que existe** (tarefas, projetos, participações). Backlog e sprints entram quando chegarem.
- **D5. `effectiveCapabilities` devolve módulos efetivos, nível e papel.** A permissão continua em `access-policy.ts`.
- **D6. Gestor é o `role` global `manager`** no M1. Papel por `memberships` fica para o M6a.
- **D7. Histórico em tabela própria `team_module_events`** (quem, quando, o quê), gravado na mesma transação da mudança.
- **D8. Catálogo com os 15 ids do plano.** O título do catálogo passou de "14" para "15" no plano. `estimates.points` fica no registro só como par de conflito de teste, sem entrar em preset. A UI do M2 deve escondê-lo até o ADR-07 mudar.
- **D9. `ctx: TenantContext` obrigatório em cada caso de uso**, em quatro commits (M1.10a a d).
- **D10. O M1 da 2.0 é lido pelo laço**, com arquivo próprio e ajuste em `run.sh`. Ainda não aplicado (ver pendências).

## M1 · Notas de execução

Sessão Claude, 2026-11-02. M1.1 e M1.2 concluídos, sem commit. Não toquei em tela, banco nem em M1.3 em diante.

- **M1.1 (registro):** `packages/core/src/modules/`
  - `experience-level.ts`: `ExperienceLevel` (`basic`, `intermediate`, `advanced`), necessário para `minLevel`. M1.4 acrescenta a comparação.
  - `types.ts`: `MODULE_IDS` (15 ids), `ModuleId`, `ModuleDefinition`, `ModuleChange`, `ModuleResolution`.
  - `registry.ts`: `MODULE_REGISTRY`, `dependenciesOf` e `findDependencyCycle` (DFS que devolve o ciclo, se houver).
- **M1.2 (`resolveModuleSet`):**
  - Ativar puxa as dependências `requires`, que vão para `autoEnabled`.
  - Desativar é recusado em cascata: `blockedBy` lista quem cairia, na ordem do catálogo.
  - `requiresAnyOf` não é puxado. Se nenhuma alternativa estiver ativa, a mudança é recusada.
  - Conflitos são checados no conjunto final. Um conflito que já existia deixa de bloquear quando a mudança resolve o par.
  - `core` está sempre ativo e não pode ser desligado.
  - Id desconhecido, e ativar e desativar o mesmo módulo na mesma mudança, lançam `ValidationError`.
- **Correção durante a implementação:** `requiresAnyOf` do burndown é um único grupo `[estimates.hours, estimates.points]`. Dois grupos exigiriam horas E pontos. Semântica: cada grupo exige ao menos um ativo, e todos os grupos precisam valer.
- **Arestas inferidas** (o diagrama do catálogo é imagem e não aparece no texto do plano): `checkins → sprints`, `impediments → sprints`, `acceptance → backlog`, `reviewRetro → sprints`. O `minLevel` de `integrations` (Avançado) também é chute. O texto garante só `sprints → backlog`, burndown exige sprints e horas OU pontos, e os níveis dos presets. Conferir com o diagrama antes do M2.
- **Verificação:** `pnpm check` com saída 0 (121 arquivos, 989 testes; formatação, lint com zero avisos, tipos e build). `pnpm coverage` roda e `modules/` fica com 100% de statements, branches e funções.

### Pendências para o Pedro

- Confirmar as arestas inferidas acima com o diagrama do catálogo.
- D10 não foi aplicado nesta rodada: falta criar o arquivo lido pelo laço e ajustar `scripts/codex-loop/run.sh`. O pedido citou `PROGRESS_2.md` e a sessão ficou restrita a M1.1 e M1.2. Quer que eu faça na próxima?
- Ainda abertos da seção anterior: M0.8 e M0.9b e M0.11 (UI), e o teste instável de `App.manager.test.tsx`.

## M1.3 · Estado do módulo (sessão Claude, 2026-11-02)

Sem commit. Só `packages/core`, sem tela, banco nem caso de uso.

- `packages/core/src/modules/module-state.ts`: `MODULE_STATES` (`active`, `winding_down`, `disabled`), `ModuleState`, `ModuleStateEvent` (`startWindingDown`, `finishWindingDown`, `reactivate`), `transitionModuleState` (função pura, lança `ValidationError` em transição inválida), `canAcceptNewItems` (só `active`) e `canUseExistingItems` (tudo menos `disabled`; base do guard do M1.8).
- Transições: `active` → `winding_down`; `winding_down` → `disabled` (concluir) ou `active` (reativar, cancela a saída); `disabled` → `active`. Qualquer outro par é recusado.
- Decisão de execução (não estava explícita no plano): reativar a partir de `winding_down` volta a `active`, para que cancelar o encerramento seja possível. Se o Pedro preferir proibir, é uma linha na tabela `TRANSITIONS`.
- Testes: `module-state.test.ts` (transições válidas, todas as inválidas recusadas, predicados, reativar não toca em dados).
- Exportado por `modules/index.ts`.
- `pnpm check` com saída 0: 122 arquivos, 997 testes, lint com zero avisos, build ok.

## M1.4 · effectiveCapabilities (sessão Claude, 2026-11-02)

Sem commit. Só `packages/core`, sem tela, banco nem caso de uso. D5 aplicada como decidida.

- `packages/core/src/modules/experience-level.ts`: `isAtLeastLevel(level, minimum)`, comparação pela ordem de `EXPERIENCE_LEVELS`.
- `packages/core/src/modules/capabilities.ts`: `effectiveCapabilities({ modules, level, role })` devolve `{ role, level, modules, screens }`.
  - `modules`: módulos recebidos, sem repetir, na ordem do catálogo. Efeitos passivos aparecem para estes em qualquer nível.
  - `screens`: subconjunto de `modules` cujo `minLevel` o nível alcança. Tela só aparece com módulo ativo e nível suficiente.
  - Id desconhecido lança `ValidationError`.
  - Desvio do esboço do plano: o plano dizia `Capability[]`, mas D5 pede módulos efetivos, nível e papel. Não existe tipo `Capability` no código e não foi criado.
  - A permissão continua em `policies/access-policy.ts`. O `role` só é devolvido junto e não altera módulos nem telas. Teste confirma que gestor e colaborador veem o mesmo conjunto.
- `modules/index.ts` reexporta `capabilities`.
- Testes: `capabilities.test.ts` cobre módulo desativado em todos os níveis, nível alto sem ativar nada, efeito passivo no básico, telas a partir do `minLevel`, ordem e deduplicação, papel, id desconhecido, e a comparação de níveis.
- Decisão de execução: a função recebe os módulos já resolvidos e não distingue `winding_down` de `active`. Quem chama decide o que passar. O guard do M1.8 usa `canUseExistingItems` e `canAcceptNewItems`, não esta função.
- `pnpm check` com saída 0: 123 arquivos, 1005 testes, lint com zero avisos, build ok. Cobertura de `modules/` (com `capabilities.ts`): 100% de statements, branches, funções e linhas.

## M1.5a · Portas de módulos e nível (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (portas, fake e contrato), sem SQLite, tela nem caso de uso. M1.5b (migração `0003`) não foi iniciado.

- `ports/team-module-repository.ts`: `TeamModule` (`moduleId`, `state`, `config`, `changedBy`, `changedAt`) e `TeamModuleRepository` (`list`, `save`). `list` devolve na ordem do catálogo (`MODULE_IDS`), e módulo nunca gravado não aparece.
- `ports/team-settings-repository.ts`: `TeamSettings` (`level`, `changedBy`, `changedAt`) e `TeamSettingsRepository` (`find` devolve `null` sem preferências gravadas, `save`). Um registro por time (time = organização, D1).
- Decisão de execução (não estava explícita): `config` é um objeto de valores simples (`string | number | boolean | null`), para caber em JSON na `team_modules` do M1.5b. O plano não define o conteúdo de `config`; nenhum módulo usa ainda.
- Desvio da lista de arquivos do M1.5a: as portas NÃO entraram em `AppDeps` (`deps.ts`) nem em `UnitOfWorkRepositories`. Motivo: torná-las obrigatórias quebraria `apps/desktop/src/main/composition-root.ts`, `create-use-cases.test.ts`, `set-default-rate.test.ts` e o `SqliteUnitOfWork`, e a fiação real só faz sentido com o adaptador SQLite (M1.5b) e os casos de uso (M1.6). Entram lá nesses marcos.
- Fakes: `InMemoryTeamModuleRepository` e `InMemoryTeamSettingsRepository` em `testing/fakes/in-memory-repositories.ts`, com estado novo (`teamModules`, `teamSettings`) copiado no rollback do `InMemoryUnitOfWork`.
- Contrato: `describeTeamRepositoryContract` em `testing/repository-contract.ts`, separado do `describeRepositoryContract` para não quebrar o contrato SQLite atual. Roda só no fake por enquanto. Cobre: gravar e listar na ordem do catálogo, substituir o mesmo módulo, isolar por organização, gravar/reler/substituir preferências, `null` sem preferências. No M1.5b, o adaptador SQLite passa a rodar esse mesmo contrato.
- `ports/ports.test.ts`: asserções de tipo para o primeiro parâmetro (`OrganizationId`) das quatro operações novas.
- `pnpm check` com saída 0: 123 arquivos, 1008 testes, lint com zero avisos, build ok. `pnpm format` rodou sobre o repositório; nenhum outro arquivo mudou além dos listados abaixo.
- Arquivos: `packages/application/src/ports/{index,ports.test,team-module-repository,team-settings-repository}.ts`, `packages/application/src/testing/{repository-contract,repository-contract.test}.ts`, `packages/application/src/testing/fakes/{in-memory-repositories,in-memory-unit-of-work}.ts`.

## M1.5b · Tabelas de módulos e nível (sessão Claude, 2026-11-02)

Sem commit. Só `packages/infra-sqlite` (schema, migração, mapper, adaptador) e testes. Sem tela, sem caso de uso, sem mudança no composition-root.

- Migração `0003_team_modules_settings.sql` gerada por `pnpm db:generate` (snapshot `meta/0003_snapshot.json`). Só `CREATE TABLE`, aditiva. Antes de gerar, o `db:generate` confirmou que o snapshot 0002 estava em dia.
- `schema/team-modules.ts`: `team_modules` com `organization_id`, `module_id`, `state`, `config` (JSON, via `mode: 'json'`), `changed_by` (FK em `users`) e `changed_at`. Chave primária composta `(organization_id, module_id)`.
- `schema/team-settings.ts`: `team_settings` com `organization_id` como chave primária (um registro por time, D1), `level`, `changed_by` (FK em `users`) e `changed_at`.
- `mappers/team-mappers.ts` e `repositories/team-repositories.ts`: `createSqliteTeamRepositories(database)` devolve `{ teamModules, teamSettings }`. `save` usa upsert pela chave. `list` ordena pelo catálogo (`MODULE_IDS`).
- `create-sqlite-adapters.ts`: os dois repositórios saem em `createSqliteAdaptersForDatabase`, fora de `UnitOfWorkRepositories`.
- `composition-root.ts`: sem alteração. As portas chegam ao composition-root pelo spread de `createSqliteAdapters`, mas nenhum caso de uso as usa ainda. Para a fiação entrar em `AppDeps` e na unidade de trabalho, ver M1.6 (o histórico `team_module_events` precisa entrar na mesma transação).
- Testes:
  - `describeTeamRepositoryContract` roda agora no SQLite (`repository-contract.test.ts`) e continua no fake.
  - `client.test.ts` lista as tabelas novas.
  - `repositories/team-repositories.test.ts`: chave única por time e módulo (mesmo módulo em outro time é aceito) e substituição sem duplicar linha.
- Decisão de execução: `config` como JSON de valores simples (`string | number | boolean | null`), conforme pedido. Nenhum módulo grava config ainda.
- `pnpm check` com saída 0: 124 arquivos, 1013 testes, lint com zero avisos, build ok.

## M1.6 · Ferramentas do time, casos de uso e histórico (sessão Claude, 2026-11-02)

Sem commit. Marco feito inteiro (não foi preciso dividir). Sem tela, sem IPC, sem prévia (M1.7) e sem guard (M1.8).

- **Regra de acesso:** `canManageTeamModules(actor)` em `packages/core/src/policies/access-policy.ts` (só `manager`, D6).
- **Histórico (D7):** migração `0004_team_module_events.sql` (aditiva, gerada por `pnpm db:generate`), tabela `team_module_events`, schema `schema/team-module-events.ts`, mapper e repositório em `repositories/team-repositories.ts`. Porta `TeamModuleEventRepository` em `application/src/ports/team-module-event-repository.ts`, com `append` e `list` (ordem por data e id).
- **Unidade de trabalho:** `UnitOfWorkRepositories` ganhou `teamModules` e `teamModuleEvents`, nos dois adaptadores (fake e SQLite). Assim a mudança e o histórico gravam na mesma transação. `AppDeps` ficou igual: os casos de uso leem e gravam pela unidade de trabalho. O comentário "fora da unidade de trabalho até o M1.6" saiu de `create-sqlite-adapters.ts`.
- **Casos de uso** em `application/src/use-cases/team-modules/team-modules.ts`, registrados em `create-use-cases.ts` como `teamModules.get` e `teamModules.change`:
  - `GetTeamModules`: qualquer membro lê os 15 módulos com estado efetivo.
  - `ChangeTeamModules`: só gestor (`PermissionDeniedError` para colaborador, nada gravado). Usa `resolveModuleSet`. Recusa mudança inválida com `ValidationError` antes de gravar. Grava uma linha por módulo que mudou, com `fromState`, `toState`, `changedBy` e `changedAt`.
- **Decisões de execução (não estavam explícitas no plano):**
  - Módulo nunca gravado usa o preset "Kanban simples" (núcleo e agenda ativos; o resto desativado). Sem isso, a agenda, que já existe, sumiria para times antigos.
  - Desativar vai direto a `disabled`, não a `winding_down`. O plano põe o encerramento gradual no M2, então o M1.6 não produz `winding_down`. Dependências contam módulos `active` e `winding_down`, porque ambos ainda têm itens em uso.
  - Reativar usa o mesmo caminho: `disabled` ou `winding_down` vão para `active`, e os dados e a configuração permanecem.
  - Mensagens de recusa citam os ids dos módulos (ex.: `sprints`), sem rótulos em pt-BR, porque o catálogo de rótulos é da UI do M2.
- **Testes:**
  - `use-cases/team-modules/team-modules.test.ts`: time nunca configurado; colaborador recusado sem gravar; gestor ativa com dependência puxada e histórico; desativar backlog com sprints recusado sem gravar; conflito horas × pontos; id desconhecido e núcleo; desativar e reativar preservando configuração; nenhuma mudança não gera evento.
  - Contrato `describeTeamRepositoryContract` ganhou o teste de histórico, rodado no fake e no SQLite.
  - `unit-of-work.test.ts` (SQLite) ganhou o teste de desfazer módulo e histórico juntos quando a operação falha.
  - `client.test.ts` lista a tabela nova.
- **Verificação:** `pnpm check` com saída 0: 125 arquivos de teste, 1024 testes, lint com zero avisos, build ok. `pnpm coverage` não foi rodado nesta rodada.
- **Fora deste marco:** IPC e contrato Zod de `teamModules`, tela (M2), prévia de impacto (M1.7), guard da agenda (M1.8), conclusão do encerramento (`finishWindingDown` como caso de uso).
- **Pendências:** D10 continua aberto (arquivo lido pelo laço). Não há pendência nova do Pedro; a confirmação das arestas inferidas do catálogo (M1.2) segue valendo.

## M1.7 · Prévia de impacto (sessão Claude, 2026-11-02)

Sem commit. Sem tela (a prévia visível é do M2). D4 aplicada como decidida: contagens do que existe, backlog e sprints entram quando chegarem.

- **Núcleo (puro):** `packages/core/src/modules/impact-preview.ts`.
  - `ITEM_KIND_MODULE`: tarefas, projetos e participações são do `core`; reuniões são da `agenda`.
  - `dependentsOf(moduleId)`: o próprio módulo mais quem depende dele, direta ou indiretamente (`requires` e `requiresAnyOf`), na ordem do catálogo. Desligar um módulo afeta esses itens.
  - `previewModuleImpact(moduleId, available)`: devolve as contagens só dos tipos cujo módulo está em `dependentsOf`. Não lê nem muda estado, e não depende de o módulo estar ativo.
- **Portas:** `count(organizationId)` em `TaskRepository`, `ParticipationRepository` e `MeetingRepository`. Projetos usam `list().length`, que já existe.
  - Fake e SQLite contam as mesmas linhas: a participação de responsável que cada tarefa traz também conta, como em `task_participations`.
  - Teste de contrato `conta tarefas, participações e reuniões por organização` roda nos dois adaptadores.
- **Caso de uso:** `PreviewTeamModuleImpact` em `use-cases/team-modules/team-modules.ts`, registrado como `teamModules.previewImpact`. Recebe `{ disable }` e devolve um `ModuleImpact` por módulo pedido, na ordem do catálogo.
  - Só gestor (`canManageTeamModules`), como a mudança. Id desconhecido recusa com `ValidationError`.
- **Decisões de execução (não estavam explícitas):**
  - Reuniões entraram na prévia além das três contagens citadas em D4. Sem elas, desligar a agenda mostraria zero, o que estaria errado. Se o Pedro preferir só as três, é remover a linha `meetings` de `ITEM_KIND_MODULE` e de `ITEM_KINDS`.
  - Dependentes usam `dependenciesOf`, que inclui as alternativas de `requiresAnyOf`. Desligar horas aparece em `burndown` mesmo quando pontos cobriria a exigência. A prévia é conservadora: mostra o que pode ser afetado.
  - A prévia lista só os módulos pedidos em `disable`. Ativar só acrescenta, então não tem impacto a mostrar.
- **Testes:**
  - `impact-preview.test.ts`: dependentes (inclusive indiretos e `requiresAnyOf`), contagens corretas, módulo sem itens dá zero, entrada não alterada.
  - `team-modules.test.ts`: colaborador recusado, lista vazia sem pedido, organização vazia dá zero, contagens com dados, desligar não apaga contagem nem muda estado, id desconhecido recusado.
  - Contrato de repositórios: contagem por organização, nos dois adaptadores.
- **Verificação:** `pnpm check` com saída 0: 126 arquivos de teste, 1040 testes, lint com zero avisos, tipos e build ok.
- **Fora deste marco:** IPC e contrato Zod da prévia, tela (M2), guard da agenda (M1.8).

## M1.8 · Guard de módulo na agenda (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (guard, agenda e teste). Sem tela, banco novo nem mudança em `packages/core`. D3 aplicada como decidida: só a Agenda.

- `packages/application/src/modules/guard.ts`:
  - `requireModuleAccess(deps, organizationId, moduleId, access)`: lê o estado do módulo no time e recusa com `ValidationError`. `access: 'new'` usa `canAcceptNewItems` (só `active`); `access: 'existing'` usa `canUseExistingItems` (tudo menos `disabled`).
  - `effectiveModuleStates(stored)`: estado efetivo de cada módulo. Saiu de `team-modules.ts` para ser compartilhado. Sem registro, o preset "Kanban simples" vale (núcleo e agenda ativos).
- `use-cases/meetings/meetings.ts`: listar (mês e próximos) usa `existing`; criar usa `new`; editar e excluir usam `existing`. Em criar, editar e excluir, `requireManager` roda antes do guard, então colaborador continua recebendo `PermissionDeniedError`.
- `use-cases/team-modules/team-modules.ts`: troca a função local pela compartilhada. Comportamento igual.
- Testes em `meetings.test.ts` (bloco "guard de módulo na agenda (M1.8)"): agenda desligada recusa listar, criar, editar e excluir até para o gestor, sem gravar nada; agenda encerrando lista, edita e exclui, mas não cria; agenda ativa segue o fluxo normal; organização sem registro usa o preset e a agenda funciona.
- Decisões de execução (não estavam explícitas):
  - Recusa de módulo usa `ValidationError` com o id do módulo na mensagem (`O módulo agenda está desativado neste time`), no mesmo critério do M1.6. Rótulo em pt-BR fica para o M2.
  - Listagens também passam pelo guard, porque o plano diz "listar, criar, editar, excluir". Com agenda desligada, a listagem falha em vez de devolver vazio.
- **Verificação:** `pnpm check` com saída 0: 126 arquivos de teste, 1044 testes, lint com zero avisos, tipos e build ok.
- **Fora deste marco:** guard nos demais casos de uso (só a Agenda existe hoje), IPC e tela (M2), e `finishWindingDown` como caso de uso.
- **Pendências:** nenhuma nova. D10 segue aberto (arquivo lido pelo laço).

## M1.9 · TenantContext (sessão Claude, 2026-11-02)

Sem commit. Só `packages/core` (tipo, função e teste). Sem caso de uso, porta, banco nem tela. D1 e D9 aplicadas como decididas: o contexto só embrulha o `organizationId` do ator, e a assinatura dos casos de uso fica para o M1.10.

- `packages/core/src/policies/tenant.ts`:
  - `TenantContext` = `{ organizationId }`, derivado do `Actor`.
  - `createTenantContext(actor)`: devolve o contexto; lança `ValidationError` ("Contexto de time ausente") se o `organizationId` faltar, for vazio ou não for texto. O tipo já exige o campo; a checagem em tempo de execução cobre entrada vinda de fora do tipo (IPC).
  - Localização escolhida: `core/policies` (é regra de acesso, não de caso de uso), exportado por `core/src/index.ts`.
- Teste `policies/tenant.test.ts`: embrulha só o time, gestor e colaborador geram o mesmo contexto, e recusa sem time, vazio e não texto.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1049 testes, formatação, lint com zero avisos, tipos e build ok).
- Fora deste marco: `ctx` obrigatório nos casos de uso (M1.10a a d) e teste de tipo do M1.11.

## M1.10a · TenantContext nos casos de uso de projetos (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (projetos e helper), IPC em `apps/desktop/src/main` e seed. Sem tela, banco novo nem mudança de comportamento. D9 aplicada como decidida: `ctx: TenantContext` é o primeiro parâmetro obrigatório.

- Assinatura nova: `execute(ctx, actor, input)` em `ListProjects`, `CreateProject`, `ListProjectMembers`, `AddProjectMember`, `RemoveProjectMember`, `ArchiveProject`, `UnarchiveProject` e `RenameProject`. O `actor` continua, porque a permissão (`canManageMembers`, `canSeeProject`) usa papel e usuário.
- `packages/application/src/use-cases/tenant-scope.ts`: `assertTenant(ctx, actor)` recusa (`FORBIDDEN`, "Contexto de time não confere com o ator") quando o `ctx` é de outro time que o ator, antes de qualquer leitura ou escrita, e devolve o `organizationId` usado em todas as consultas. Essa checagem não estava no plano; foi necessária porque, com `ctx` e `actor` separados, um contexto de um time com um ator de outro poderia escrever no time errado.
- Chamadores atualizados com `createTenantContext(actor)`: `register-handlers.ts` (canais `projects.*`, os demais seguem como estão até M1.10b-d), `seed.ts`, `create-use-cases.test.ts` e `projects.test.ts`.
- Testes novos (bloco "isolamento entre organizações (M1.10a)" em `projects.test.ts`): lista de outro time vazia; projeto alheio dá `NOT_FOUND` em todos os casos de uso e fica intacto; nome igual em outro time gera projeto próprio; contexto de um time com ator de outro dá `FORBIDDEN` e não grava nada.
- Limite: o isolamento foi testado no repositório em memória (`fakes`). O SQLite entra no teste de contrato do M1.11.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1053 testes, formatação, lint com zero avisos, tipos e build ok).
- Fora deste marco: `ctx` nos casos de uso de tarefas, participações, contribuintes, usuários, sessão, agenda, linha do tempo e dashboard (M1.10b a d), teste de tipo do M1.11.

## M1.10b · TenantContext nos casos de uso de tarefas e participações (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (tarefas, participações e testes), chamadores em `apps/desktop/src/main/ipc/register-handlers.ts` e `create-use-cases.test.ts`. Sem tela, banco novo nem mudança de comportamento. D9 aplicada como decidida, no mesmo padrão de M1.10a.

- Assinatura nova: `execute(ctx, actor, input)` em todos os casos de uso de `use-cases/tasks/tasks.ts` (criar, detalhar, atualizar, mover, arquivar, desarquivar), `use-cases/tasks/list-tasks.ts` (quadro, fluxo, quadro da equipe, recentes, frequentes, busca, registro de abertura) e `use-cases/participations/participations.ts` (adicionar, remover, horas, valor/hora).
- Cada caso de uso chama `assertTenant(ctx, actor)` antes de qualquer leitura ou escrita e usa o `organizationId` devolvido. Os métodos auxiliares (`ChangeTask.change`, `findEditableTask`, `recordChange`, `mapParticipation` e `scopedBoard`) recebem `ctx` e refazem a checagem, para que nenhum caminho use `actor.organizationId` direto.
- Os casos de uso que só repassam para `change` (atualizar, mover, arquivar e desarquivar) passam `ctx` adiante, sem checagem própria.
- Chamadores atualizados com `createTenantContext(actor)`: canais `tasks.*` e `participations.*` em `register-handlers.ts`, `seed.ts` do `infra-sqlite`, e os usos em `create-use-cases.test.ts` e nos testes de tarefas e participações.
- Testes novos (bloco "isolamento entre organizações (M1.10b)" em `tasks.test.ts` e `participations.test.ts`): listagens e busca de outro time vazias, inclusive para gestor com filtro por usuário; tarefa alheia dá `NOT_FOUND` em leitura, escrita, arquivar, desarquivar e registro de abertura, e fica intacta; envolvimentos de tarefa alheia (adicionar, remover, horas, valor/hora) dão `NOT_FOUND`; criar tarefa em projeto alheio dá `NOT_FOUND` e não grava; contexto de um time com ator de outro dá `FORBIDDEN` e não grava nada.
- Os timelines e o dashboard (`use-cases/timeline`, `use-cases/dashboard`) ficam para M1.10d; `list-timeline` ainda recebe `actor` sem `ctx`, por isso `create-use-cases.test.ts` mantém essa chamada como está.
- Limite: o isolamento foi testado no repositório em memória (`fakes`). O SQLite entra no teste de contrato do M1.11.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1059 testes, formatação, lint com zero avisos, tipos e build ok). Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m110b-check-3.log`.
- Fora deste marco: `ctx` nos casos de uso de contribuintes, usuários, sessão, agenda, linha do tempo e dashboard (M1.10c e d), teste de tipo do M1.11.

## M1.10c · TenantContext nos casos de uso de contribuintes, usuários e sessão (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (contribuintes, usuários, sessão e testes), chamadores em `apps/desktop/src/main/ipc/register-handlers.ts`, `apps/desktop/src/main/composition-root.test.ts` e `packages/infra-sqlite/src/seed/seed.ts`. Sem tela, banco novo nem mudança de comportamento. D9 aplicada como decidida, no mesmo padrão de M1.10a e M1.10b.

- Escopo seguiu a linha do M1.10c da tabela (`contributors/*.ts`, `users/*.ts`, `session/*.ts`). A agenda (`meetings`) continua na linha do M1.10d, como está no plano; não foi movida para este commit.
- Assinaturas novas, com `ctx` antes do ator e `assertTenant(ctx, actor)` antes de qualquer leitura ou escrita:
  - `contributors`: `list(ctx, actor)`, `create(ctx, actor, input)`, `setDefaultRate(ctx, actor, input)`.
  - `users`: `setDefaultRate(ctx, actor, input)`.
  - `session`: `listUsers(ctx, actor)`. `getCurrentActor(ctx)` e `switchUser(ctx, input)` não recebem ator no parâmetro: o ator vem da sessão, então o `assertTenant` compara o `ctx` com o ator da sessão. `getCurrentActor` continua síncrono.
- Chamadores atualizados com `createTenantContext(actor)`: canais `session.*`, `users.*` e `contributors.*` em `register-handlers.ts`; `seed.ts` (criação das entidades de demonstração); `composition-root.test.ts` (usa `root.actorSession.get()` para montar o contexto); e os testes de contribuintes, usuários e sessão.
- Testes novos (bloco "isolamento entre organizações (M1.10c)" em `contributors.test.ts`, `users/set-default-rate.test.ts` e `session.test.ts`, 9 casos): lista de outro time vazia para colaborador e devolve só a entidade alheia para o gestor de lá; entidade alheia dá `NOT_FOUND` no valor padrão e fica intacta; criar com ator de outro time grava no time do ator; usuário alheio dá `NOT_FOUND` no valor padrão e na troca de sessão, e a sessão não muda; listagem de usuários só traz o time do ator; contexto de um time com ator de outro dá `FORBIDDEN` e não grava nada nem notifica.
- Limite: o isolamento foi testado no repositório em memória (`fakes`). O SQLite entra no teste de contrato do M1.11.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1068 testes, formatação, lint com zero avisos, tipos e build ok). Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m110c-check.log`.
- Fora deste marco: `ctx` nos casos de uso de agenda, linha do tempo e dashboard (M1.10d) e teste de tipo do M1.11.

## M1.10d · TenantContext nos casos de uso de agenda, linha do tempo e dashboard (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (agenda, linha do tempo, dashboard e testes), chamadores em `apps/desktop/src/main/ipc/register-handlers.ts`, `packages/infra-sqlite/src/seed/seed.ts` e `create-use-cases.test.ts`. Sem tela, banco novo nem mudança de comportamento. D9 aplicada como decidida, no mesmo padrão de M1.10a a c. Com isso, os casos de uso das linhas M1.10a a d recebem `ctx`. Os casos de uso de módulos da equipe (`use-cases/team-modules/team-modules.ts`) não estão em nenhuma linha do M1.10 e ainda recebem só `actor`; ficam como pendência para decidir (ver abaixo).

- Assinaturas novas, com `ctx` antes do ator e `assertTenant(ctx, actor)` como primeira linha de cada caso de uso, antes de qualquer leitura, escrita ou checagem de papel:
  - `meetings`: `listMonth(ctx, actor, input)`, `listUpcoming(ctx, actor)`, `create(ctx, actor, input)`, `update(ctx, actor, input)`, `delete(ctx, actor, input)`.
  - `timeline`: `list(ctx, actor, input)`.
  - `dashboard`: `get(ctx, actor)`.
- O guard de módulo da agenda (M1.8) continua igual; só recebe o `organizationId` vindo de `assertTenant` em vez de `actor.organizationId`. A ordem entre papel e módulo também não mudou.
- `composition-root.ts` não precisou de mudança: a linha do plano previa ajuste lá, mas ele só monta as dependências e não chama casos de uso. O ajuste foi só no `register-handlers.ts`.
- Chamadores atualizados com `createTenantContext(actor)`: canais `timeline.list`, `dashboard.get` e `meetings.*` em `register-handlers.ts`; `seed.ts` (agendamentos de demonstração); `create-use-cases.test.ts` (chamada de `timeline.list`); e `meetings.test.ts` e `timeline-dashboard.test.ts`. `register-handlers.test.ts` não precisou de mudança.
- Testes novos (bloco "isolamento entre organizações (M1.10d)" em `meetings/meetings.test.ts`, 4 casos, e em `timeline-dashboard.test.ts`, 2 casos): agenda de outro time não aparece nas listagens; gestor de outro time não edita nem exclui agendamento daqui (`NOT_FOUND`, dado intacto); criar com ator de outro time grava no time do ator; contexto de um time com ator de outro dá `FORBIDDEN` e não grava nem exclui nada. Linha do tempo de tarefa alheia dá `NOT_FOUND`, e contexto trocado dá `FORBIDDEN`. Dashboard de outro time não traz pessoas, tarefas nem mudanças daqui, e contexto trocado dá `FORBIDDEN`.
- Limite: o isolamento foi testado no repositório em memória (`fakes`). O SQLite entra no teste de contrato do M1.11.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1074 testes, formatação, lint com zero avisos, tipos e build ok). `pnpm format` foi rodado antes do check para corrigir a formatação dos três arquivos alterados. Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m110d-check.log`.
- Pendência: `team-modules` (`list`, `change`, e o caso de uso de linha 146) ainda não usa `ctx`. Não estava no plano do M1.10; precisa de decisão antes do M1.11 (incluir no M1.10 ou tratar no teste de tipo). Resolvida no M1.10e.
- Fora deste marco: teste de tipo do M1.11 (que confirma que `ctx` é obrigatório em tempo de compilação) e o teste de contrato com SQLite.

## M1.10e · TenantContext nos casos de uso de ferramentas do time (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (`use-cases/team-modules/team-modules.ts` e `team-modules.test.ts`). Sem tela, IPC, banco novo nem mudança de comportamento. D9 aplicada aos três casos de uso de módulos da equipe, como decidido em D9 (recomendação de consistência): fecha a pendência do M1.10d.

- Assinaturas novas, com `ctx` antes do ator e `assertTenant(ctx, actor)` como primeira linha, antes da checagem de papel (`canManageTeamModules`) e de qualquer leitura ou escrita:
  - `teamModules.get(ctx, actor)`, `teamModules.change(ctx, actor, input)`, `teamModules.previewImpact(ctx, actor, input)`.
- Comportamento igual: os mesmos erros, as mesmas gravações e o mesmo histórico. Só o `organizationId` passou a vir de `assertTenant`.
- Chamadores: nenhum fora de `create-use-cases.ts` (que só monta os casos de uso) e do próprio teste. Não há canal IPC de `teamModules` ainda, então `register-handlers.ts` e `composition-root.ts` não mudaram.
- Testes: `team-modules.test.ts` passou a criar `collaboratorCtx` e `managerCtx` com `createTenantContext`. Bloco novo "isolamento entre organizações (M1.10e)", 4 casos: ferramentas de outro time não aparecem na leitura; gestor de outro time não altera as ferramentas daqui, e a mudança vai para o time dele (sem evento no time original); prévia de outro time não conta itens daqui (zero); contexto de um time com ator de outro dá `FORBIDDEN` nos três casos de uso e não grava nada nos dois times.
- Limite: testado no repositório em memória (`fakes`). O SQLite entra no teste de contrato do M1.11.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1078 testes, formatação, lint com zero avisos, tipos e build ok). `pnpm format` rodado antes do check. Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m110e-check.log`.
- Fora deste marco: teste de tipo do M1.11 (que confirma que `ctx` é obrigatório em tempo de compilação) e o teste de contrato com SQLite.

## M1.11 · Teste de isolamento entre organizações (sessão Claude, 2026-11-02)

Sem commit. Só `packages/application` (contrato de repositórios e teste de tipo). Sem tela, banco novo nem mudança de código de produção.

- `testing/repository-contract.ts`: caso novo "nenhuma leitura de porta devolve dado de outra organização (M1.11)", dentro de `describeRepositoryContract`. Grava registros na organização A em users, projects (com membro), contributors, tasks, participations, meetings, timeline e taskOpens; confere antes que A enxerga os dados (controle positivo, para o vazio não ser acidente); depois lê com a organização B em todas as portas de leitura (`findById`, `list`, `findByNameKey`, `listMembers`, `listByProject`, `listBoard` com e sem filtro, `listRecent`, `listFrequent`, `search`, `findByProjectNameKey`, `listByTask`, `listByMonth`, `listUpcoming`, e `count` de tarefas, participações e reuniões). Tudo volta vazio ou `null`.
- O mesmo contrato roda nos dois adaptadores: em memória (`repository-contract.test.ts`) e SQLite (`infra-sqlite/src/repository-contract.test.ts`). Os repositórios de módulos e preferências do time já tinham isolamento no contrato de time (`describeTeamRepositoryContract`), sem mudança.
- `create-use-cases.test.ts`: bloco "contexto de time no tipo (M1.11)" com `expectTypeOf`. Exige que todo caso de uso exposto em `createUseCases` tenha `execute` e que o primeiro parâmetro seja `TenantContext`. É checagem de tipo: o `it` não tem efeito em tempo de execução, quem falha é o `tsc` (`pnpm typecheck`).
- Verificação negativa: trocando o tipo esperado por `Actor` no teste de tipo, o `tsc` falhou (TS2344). O arquivo foi restaurado.
- Limite: o contrato cobre leituras, contagens e a não exibição de dados alheios. Escritas com identificador de outra organização (um `save` em B com id já existente em A) não estão cobertas; os ids são ULID, então a colisão é improvável, mas vale decidir se entra no M1.12.
- Verificação: `pnpm check` com saída 0 (127 arquivos de teste, 1081 testes, formatação, lint com zero avisos, tipos e build ok). Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m111-check.log`.
- Fora deste marco: M1.12 (fechamento, cobertura de `modules/` em 100% e notas finais) e D10 (laço lendo este arquivo).

## M1.12 · Fechamento do M1 (sessão Claude, 2026-11-02)

**M1 concluído** (M1.1 a M1.12). Sem commit desta etapa: M1.12 fica para o Pedro revisar e commitar.

Lacuna do M1.11 (escrita com id de outra organização) decidida: entra no contrato, com correção nos adaptadores. Não havia opção recomendada escrita para ela; a escolha foi fechar o buraco, porque o contrato de isolamento precisa cobrir escrita e não só leitura.

- **Achado real (SQLite):** o `save` de usuário, contribuinte, projeto, tarefa e agendamento fazia `ON CONFLICT (id) DO UPDATE` sem checar a organização da linha existente. Um `save` em B com id de A trocava a organização da linha de A para B (mover, não só copiar). No caso de tarefa, também apagava as participações de A antes de a troca ser recusada. A aplicação não chega a esse caminho hoje (as leituras já filtram por organização), então é defesa em profundidade.
- **Correção no SQLite:** `setWhere` com a organização da linha existente em `users`, `contributors`, `projects`, `meetings`, `tasks` e `task_participations` (subconsulta de tarefas da organização). Em `tasks`, checagem de dono antes do `delete` das participações. Escrita com id alheio vira no-op, como já era o padrão do adaptador para tarefa sem projeto da organização.
- **Espelho nos fakes:** `ownedByOtherOrganization` em `in-memory-repositories.ts` ignora a escrita com id já existente em outra organização; participação só entra se a tarefa for da organização. Assim o contrato roda igual nos dois adaptadores.
- **Teste:** `escrita com identificador de outra organização não altera nem move o registro (M1.12)` em `repository-contract.ts`. Antes da correção, falhou no SQLite (usuário de A foi para B) e no fake (cópia em B).
- **Cobertura de `modules/`:** o único ramo sem teste era o fallback `?? 'disabled'` do guard de módulo, inalcançável por tipo. Novo `packages/application/src/modules/guard.test.ts` cobre id fora do catálogo (tratado como desativado). Resultado: `packages/core/src/modules/*` e `packages/application/src/modules/guard.ts` em 100% de statements, branches e funções.
- **Limite restante:** timeline e `taskOpens` também checam dono no SQLite, mas não entraram no teste de escrita; o fake não espelha essa checagem ainda. Fica para o M6a, quando entra RLS.
- **D10 (laço lendo `PROGRESS_2.md`): não aplicada.** A Proposta M1 não a colocou no M1.12 (só consta em "Decisões tomadas"), então não entrou neste marco. Não mexi em `scripts/codex-loop/`. Pendente de confirmação do Pedro sobre onde ela entra.
- **Verificação:** `pnpm check` com saída 0 (128 arquivos de teste, 1084 testes, formatação, lint com zero avisos, tipos e build ok). Log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m112-check.log`. Cobertura: `vitest run --coverage` (mesma config de `pnpm coverage`) com saída 0 após a última mudança; resumo por arquivo em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/cov/coverage-summary.json`.

### O que o M2 exige do Pedro antes de começar

M2 é a primeira etapa com tela. Antes de escrever código de interface, precisa de:

1. **Arestas inferidas do catálogo**, a confirmar com o diagrama: `checkins → sprints`, `impediments → sprints`, `acceptance → backlog`, `reviewRetro → sprints`. Também o `minLevel` de `integrations` (Avançado). Afetam o que a tela de Ferramentas oferece.
2. **Desenho da tela Ferramentas da equipe.** Não há protótipo dela em `design/` (só Bandeja e Painel). Preciso de referência visual ou da aprovação de um layout antes de codar.
3. **Conteúdo do menu por nível.** O plano diz "menu por nível" e "campos avançados ocultos por padrão", mas não lista quais telas e campos são Básico, Intermediário ou Avançado. Sem isso, não há o que esconder.
4. **Presets.** Confirmar a composição e o nível sugerido de cada um. "Kanban com fluxo" e "Scrum completo" citam módulos que só existem a partir de M10 (WIP, subtarefas, métricas, review, burndown). Decidir se o preset os mostra desativados ou se o preset fica só com o que já existe.
5. **Encerramento gradual.** O plano prevê que o gestor escolha o destino de cada tipo de item ao desligar um módulo (por exemplo, tarefas da sprint voltando ao Kanban). Confirmar se isso entra no M2 ou fica para depois. O mínimo do M2 é o estado `encerrando` com a prévia.
6. **Redação do aviso de nível.** O plano escreve "Subir o nível do projeto?", mas o nível é por equipe (ADR-06). Confirmar a redação ("time" ou "projeto") antes de ir para a tela.

Pendências herdadas do M0 e do M1, não bloqueiam o M2: M0.8, M0.9b e M0.11 (UI de arquivar e renomear, e varredura de telas estáticas); teste instável de `App.manager.test.tsx`; D10.

## M2 · Decisões do Pedro (HANDOFF_M2.md)

Sessão Claude, 2026-11-02. Sem commit e sem código: só este arquivo. O handoff foi lido pelo texto (`docs/HANDOFF_M2.md`); os quadros 06 e 07 não foram abertos, então as decisões 2 e 3 valem só pelo que o texto diz.

### Conferência do registro contra as decisões 1, 3 e 4

Decisões 1, 3 e 4 registradas como tomadas. Onde o registro atual diverge, o handoff vence (é a decisão mais nova) e a correção está na tarefa indicada.

- **D1, arestas (confirmadas):** `checkins → sprints`, `impediments → sprints`, `reviewRetro → sprints` e `acceptance → backlog` batem com `registry.ts`. Agenda e Integrações sem dependência, bate. Integrações fora de todo preset, então começa desligada. As arestas deixam de ser "inferidas": tirar o aviso dos comentários (M2.1). Isso fecha a pendência 1 do M1.12.
- **D3, `minLevel` de `impediments`:** registro `intermediate`, handoff põe Impedimentos no menu Avançado. **Divergência.** Vai para `advanced` (M2.1). Consequência: o preset Scrum do plano sugere Intermediário e inclui Impedimentos, então um time Intermediário com Scrum não tem a tela de impedimentos. Registrado aqui como efeito da decisão.
- **D3, `minLevel` de `acceptance`:** registro `intermediate`; handoff põe "critérios de aceite" como campo Avançado. **Divergência.** Vai para `advanced` (M2.1). Mesma consequência para o preset Scrum.
- **D3, `minLevel` de `integrations`:** `advanced` confirmado.
- **D3, `estimates.hours`:** `intermediate` bate com "estimativa" no Padrão.
- **D3, `reviewRetro`:** o handoff não fala de nível; o registro `advanced` (chute antigo) fica.
- **D3, `checkins`:** o handoff não diz o nível dos check-ins; o registro `intermediate` fica.
- **D3, nomes de nível:** Essencial, Padrão e Avançado (provisórios) correspondem a `basic`, `intermediate` e `advanced`. Só troca de nome na interface.
- **D3, itens sem módulo:** Dashboard (Padrão), linha do tempo (Padrão), custo por hora e etiquetas (Avançado) não são módulos do catálogo. Ficam como campo ou tela por nível, sem id. Dashboard é ponto a confirmar, não bloqueia o M2.1.
- **D4, presets (confirmados com o handoff):**
  - Quadro simples = Backlog + Quadro. O plano diz Kanban simples = Núcleo + Agenda. **Divergência:** entra Backlog. A Agenda não aparece na lista do handoff. Ponto a confirmar: registro implementa Núcleo + Agenda + Backlog, porque o plano manda manter a Agenda e o M1.6 já usa esse padrão para times sem registro.
  - Scrum do time = Quadro simples + Sprints, check-ins, impedimentos e retro. O plano diz Scrum = Kanban simples + Backlog, Sprints, Check-ins, Impedimentos, **Estimativas e Critérios de aceitação**, sem retro. **Divergência:** o handoff tira Estimativas e Critérios e põe retro.
  - Retro no Scrum do time conflita com a própria regra de D4: o plano põe review e retro no M10. Pela regra, o preset não cita módulo do M10, então **retro sai do Scrum do time** até o M10.
  - Completo (tudo, com Integrações), Kanban com fluxo e Scrum completo do plano citam módulos do M10 (WIP, subtarefas, métricas, burndown, review). Ficam fora até o M10. Integrações é do M11, não do M10. Não afeta o M2, porque o Completo já sai pela mesma regra.
  - Ponto a confirmar, não bloqueia: Backlog (M3), Sprints (M4) e Check-ins e Impedimentos (M5) ainda não têm telas. Os presets ligam esses módulos antes de existir tela; o efeito é só de estado até lá.

### Conferência da decisão 5 (encerramento gradual) contra o plano e o PROGRESS_2

Conflitos reais viram pergunta A/B abaixo. O resto fica registrado como tomado.

**P1. Impedimentos abertos ao desligar Impedimentos (conflito real).** O plano (seção "Mudar ferramentas", item 4) diz que o módulo fica em _encerrando_ até os impedimentos serem resolvidos. A decisão 5 diz que eles viram tarefa no Backlog.

- A) Viram tarefa no Backlog (decisão 5). O encerramento não espera. Exige Backlog ativo: se o Backlog também sai na mesma mudança, a mudança é recusada.
- B) Ficam em somente leitura até alguém resolver cada um (plano literal). O módulo só vira _desativado_ depois.
- **Recomendação: A**, com a recusa quando o Backlog sai junto. B deixa o módulo em _encerrando_ sem prazo, que é o que o plano quer evitar. Impedimentos só existem a partir do M5, então isso não entra no M2.

**P2. Reuniões ao desligar a Agenda (lacuna que pede escolha).** A Agenda existe hoje e tem dados, mas a decisão 5 não diz o destino de reuniões. O plano diz "desativar esconde, nunca apaga; reativar devolve".

- A) Reuniões viram somente leitura no histórico, com data e autor, como os check-ins. Precisa de uma visão de histórico que o handoff não desenhou.
- B) Só saem da tela e voltam ao reativar. Nenhum destino novo.
- **Recomendação: B para o M2.** A exige uma tela de histórico que não está no handoff. Quando check-ins e retros chegarem (M5 e M10), vale rever A para todos os tipos juntos.

**Tomados sem conflito:**

- Tarefas ficam no Quadro. Bate com "tarefas da sprint voltando ao Kanban como estão" do plano.
- Check-ins e retros em somente leitura. Compatível com o plano, que permite o gestor antecipar o destino. Sem antecipação, o destino vale ao fim do encerramento.
- Histórico do time com data e autor. Bate com D7 (`team_module_events`).
- **Lacuna sem efeito no M2:** o destino da própria sprint (o registro dela) não está no handoff. O plano diz "a sprint fecha". Como sprints só existem a partir do M4, decidir no M4.
- **Código atual (M1.6):** `ChangeTeamModules` desliga direto para `disabled` (`team-modules.ts`, linha 66). Não passa por `winding_down`. Corrigido em M2.4.

### Tarefas M2.1 a M2.12

Ordem: as tarefas sem tela vêm primeiro (pedido do Pedro), com a ordem da seção 4 do handoff depois (tokens, barra lateral, Ferramentas, campos por nível, renomear/arquivar/desfazer). Cada linha é um commit. Pacotes sem tela estão em `packages/core` e `packages/application`. As tarefas M2.7 e M2.12 tocam IPC e UI, indicadas na coluna.

**Status:** M2.1 feito, sem commit (`pnpm check` verde, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-1-check.log`). Registro: `impediments` e `acceptance` viram `advanced`; avisos "inferido" tirados. Teste de telas do Scrum em `capabilities.test.ts` ajustado (intermediário não vê impedimentos nem aceite). Presets não foram tocados (M2.2).

**Status M2.2:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-2-check.log`). Presets em `packages/core/src/modules/presets.ts` (`TEAM_PRESETS`), testes em `presets.test.ts`. Quadro simples = Núcleo, Agenda, Backlog. Scrum do time = + Sprints, check-ins, impedimentos (sem retro, estimativas e critérios). Completo = tudo que existe antes do M10, com Integrações (sem estimativa por pontos). O default de organização sem registro (núcleo e agenda, em `guard.ts`) não mudou.

**Status M2.3:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-3-check.log`, 129 arquivos e 1101 testes). Só core: `packages/core/src/modules/impact-preview.ts` ganha `ITEM_DESTINATION` (tarefas `board`, reuniões `hidden`, conforme P2 padrão B) e `items` em `ModuleImpact`, com destino e contagem só dos tipos que têm destino. Projetos e participações têm contagem em `counts` mas não entram em `items` (sem destino no handoff). `counts` fica como estava, então `team-modules.ts` e seus testes não mudaram. Testes em `impact-preview.test.ts`. Não tocou `guard.ts`, então o comentário "preset Kanban simples" continua (fica para a próxima tarefa que tocar application).

**Status M2.5:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-5-check.log`). Só core: `packages/core/src/modules/task-fields.ts` (`taskFieldLayout(level, modules)`, devolve `visible` e `collapsed`) e testes em `task-fields.test.ts`, exportado em `index.ts`. Leitura adotada para "Campos avançados": no Padrão, os campos de minLevel avançado aparecem recolhidos; no Avançado, aparecem sempre; no Essencial, não aparecem. Módulos ligados a campo: estimativa (`estimates.hours`) e critérios (`acceptance`). Custo por hora, dependências e etiquetas não têm módulo, então só dependem do nível. Quadro 07 não foi aberto; a interpretação do recolhido precisa de confirmação visual no M2.11.

**Status M2.4:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-4-check.log`, 129 arquivos e 1109 testes). Só application. `ChangeTeamModules` desliga um `active` com itens que dependem dele para `winding_down` e sem itens para `disabled` direto; devolve `{ statuses, windingDown }`, com a prévia de cada módulo que entrou em encerramento (quebra da assinatura antiga, sem outro chamador ainda). Desligar um módulo já encerrando não muda nada: só `FinishTeamModuleWindingDown` leva a `disabled`, e recusa se outro módulo ativo ou encerrando depende dele. Reativar cancela. Histórico com data e autor em `teamModuleEvents`, como antes. Contagem de itens saiu para `countItems`, compartilhada com a prévia. Comentário de `guard.ts` trocado (não cita mais preset). O teste do M1.6 de desligar sem reuniões continua afirmando `disabled` direto, porque agora é o caso sem itens.

| Tarefa       | O que faz                                                                                                                                                                                                                                                                                | Arquivos prováveis                                                                                                                | Testes                                                                                                                                                                                                                                   | Escopo                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M2.1         | Alinha o registro às decisões 1 e 3: `minLevel` de `impediments` e `acceptance` vira `advanced`; tira o aviso "inferido" dos comentários                                                                                                                                                 | `packages/core/src/modules/registry.ts`, `registry.test.ts`                                                                       | Arestas confirmadas; `minLevel` de cada módulo; ciclo continua recusado                                                                                                                                                                  | Só core                                                           |
| M2.2         | Presets como dados: Quadro simples (Núcleo, Agenda, Backlog), Scrum do time (sem retro, sem estimativas e critérios, conforme o handoff) e Completo fora até o M10                                                                                                                       | `packages/core/src/modules/presets.ts` (novo), `index.ts`                                                                         | Cada preset resolve a partir de vazio via `resolveModuleSet`; nenhum preset cita módulo do M10; Scrum do time não tem `reviewRetro`                                                                                                      | Só core                                                           |
| M2.3 (feito) | Prévia de impacto com destino por tipo: tarefas (ficam no Quadro) e reuniões (padrão B de P2). Impedimentos, check-ins e retros entram quando existirem                                                                                                                                  | `packages/core/src/modules/impact-preview.ts` e `.test.ts`                                                                        | Prévia traz destino por tipo com a contagem; tipo sem destino não passa                                                                                                                                                                  | Só core                                                           |
| M2.4 (feito) | `ChangeTeamModules` desliga via `winding_down` quando há itens (sem itens, vai direto a `disabled`); novo caso de uso para concluir o encerramento; reativar cancela. Ajusta o teste do M1.6 se ele afirmava `disabled` direto                                                           | `packages/application/src/use-cases/team-modules/team-modules.ts` e `.test.ts`, `create-use-cases.ts`, `modules/guard.ts` (teste) | Desligar agenda com reuniões: `winding_down`, reuniões intactas, guard recusa criar e aceita listar/editar; concluir vira `disabled`; reativar volta a `active` com dados; sem itens, `disabled` direto; colaborador recusado sem gravar | Só application                                                    |
| M2.5 (feito) | Campos da tarefa por nível, como função pura: Essencial (título, estado, prazo); Padrão (+ responsáveis, estimativa, linha do tempo, recolhido "Campos avançados"); Avançado (+ custo por hora, dependências, critérios, etiquetas). Estimativa some se `estimates.hours` está desligado | `packages/core/src/modules/task-fields.ts` (novo), `index.ts`                                                                     | Cada nível lista seus campos; subir de nível não remove dado, só muda visibilidade; módulo desligado esconde o campo ligado a ele                                                                                                        | Só core                                                           |
| M2.6         | Rótulos pt-BR de níveis, módulos e presets, e o aviso de nível da decisão 6 ("Vale para o time inteiro. Os outros times não mudam.")                                                                                                                                                     | `packages/core/src/modules/labels.ts` (novo)                                                                                      | Todo `ModuleId` tem rótulo; rótulos não repetem; aviso fala de "time" e não de "projeto". Se o Pedro preferir na interface, move para `apps/desktop`                                                                                     | Só core                                                           |
| M2.7         | Contrato Zod e IPC de `teamModules` (get, previewImpact, change), sem tela                                                                                                                                                                                                               | `packages/contract/src/` (novo arquivo), `apps/desktop/src/main/ipc/`, `apps/desktop/src/preload/`                                | Schema recusa id desconhecido; handler recusa colaborador; contrato de canais                                                                                                                                                            | Sem tela, toca IPC                                                |
| M2.8         | Tokens e componentes base do handoff: botão, secundário, segmentado, campo, cartão, chip de sinal, interruptor (`role="switch"`), menu de vidro (`role="menu"`), toast (`role="status"`), alvos de 44px                                                                                  | `apps/desktop/src/renderer/shared/` (estilos e componentes)                                                                       | Testing Library: papéis e `aria-checked`; `aria-label` em botões de ícone                                                                                                                                                                | Tela                                                              |
| M2.9         | Barra lateral: item Ferramentas só para gestor; filtro por nível e módulos ligados (aparece se o nível libera **e** o módulo está ligado)                                                                                                                                                | `apps/desktop/src/renderer/panel/layout/` (barra lateral), usa `effectiveCapabilities`                                            | Colaborador não vê Ferramentas; Essencial não vê Backlog; módulo desligado não aparece                                                                                                                                                   | Tela                                                              |
| M2.10        | Tela Ferramentas: cartões com interruptor, dependência e sinal (texto e ícone); presets; prévia em vidro com Aplicar e Cancelar; aviso de nível. Liga em `GetTeamModules` e na prévia. `estimates.points` escondido (D8)                                                                 | `apps/desktop/src/renderer/panel/` (tela nova), `shared/api`                                                                      | Ativar mostra dependências puxadas; Aplicar chama `change`; Cancelar não chama; `estimates.points` não aparece; Playwright fica para o M4 a M6                                                                                           | Tela                                                              |
| M2.11        | Campos da tarefa por nível na tela de detalhe, com "Campos avançados" recolhido                                                                                                                                                                                                          | `apps/desktop/src/renderer/panel/task-detail/`                                                                                    | Campos somem e aparecem conforme o nível; recolhido por padrão                                                                                                                                                                           | Tela                                                              |
| M2.12        | Renomear (clique no título ou F2; Enter salva, Esc cancela), Arquivar no menu "⋯" (atalho E), mesmo menu para projeto na barra lateral, toast de desfazer 8s com Ctrl Z. Cobre M0.9b e M0.11                                                                                             | `apps/desktop/src/renderer/panel/task-detail/`, barra lateral, `shared/query`                                                     | Renomear com Enter e Esc; arquivar some da lista; desfazer restaura; toast tem `role="status"`                                                                                                                                           | Tela (usa casos de uso existentes de arquivar e renomear projeto) |

### Pendências para o Pedro

1. Responder P1 (A ou B) e P2 (A ou B). Recomendações acima.
2. Quadro simples: Agenda entra no preset (como no plano) ou não (como no handoff)?
3. Dashboard: entra no catálogo como módulo ou fica como tela fixa do gestor?
4. Presets que ligam Backlog, Sprints, Check-ins e Impedimentos antes de as telas existirem (M3 a M5): tudo bem, ou o preset Scrum espera o M5?
5. Quadro 06 (Ferramentas) e quadro 07 (Níveis) não foram abertos nesta sessão. Antes de M2.10, confirmar o layout nos quadros.
6. Pendências herdadas: M0.8 (`renameProject`, ainda com trabalho de outra sessão em `rename-project.ts`), M0.9b, M0.11, teste instável de `App.manager.test.tsx` e D10.
