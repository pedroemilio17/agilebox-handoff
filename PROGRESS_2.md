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
