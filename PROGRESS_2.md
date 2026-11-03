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

### Divergências quadro x código (M2.6)

Três pontos em que o quadro 06 diz uma coisa e o código, outra. O código segue a descrição dos rótulos (M2.6). Cada um pede escolha do Pedro.

**Q1. Retro no Scrum do time.** O quadro diz que o Scrum tem retro. `TEAM_PRESETS` não tem (retro é do M10).

- A) Tirar "retro" do texto do quadro: "Sprints, check-ins e impedimentos" (como está no código).
- B) Pôr a retro no preset já (fere a regra do D4: preset não cita módulo do M10).
- **Recomendação: A.** A retro só existe no M10.

**Q2. Agenda no Quadro simples.** O quadro diz "Backlog e quadro. Nada além disso". O preset tem Núcleo, Agenda e Backlog. Mesma pergunta da pendência 2.

- A) Manter a Agenda no preset (plano e default do M1.6) e trocar o texto do quadro por "Backlog, quadro e agenda".
- B) Tirar a Agenda do preset, como o quadro diz.
- **Recomendação: A.** É o que o plano manda e o que o time sem registro já recebe.

**Q3. "Tudo ligado" no Completo.** O preset exclui os módulos do M10 (WIP, subtarefas, métricas, burndown, revisão), então não é tudo.

- A) Trocar o texto do quadro por "Tudo o que existe hoje, incluindo integrações" (como está no código).
- B) Incluir já os módulos do M10 no Completo (fere a regra do D4).
- **Recomendação: A.** Quando o M10 chegar, o preset ganha os módulos e o texto volta a ser "tudo".

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

**Status M2.6:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-6-check.log`, 131 arquivos e 1124 testes). Só core: `packages/core/src/modules/labels.ts` (`LEVEL_LABELS`, `SUGGESTED_LEVEL`, `MODULE_LABELS`, `PRESET_LABELS`, `TEAM_SCOPE_NOTICE`) e `labels.test.ts`, exportado em `modules/index.ts`. Nomes de ferramenta e de nível vêm dos quadros 06 e 07 (lidos pelo Artifact). Ferramentas sem cartão no quadro (estimativas, WIP, subtarefas, métricas, burndown) ganham nome sem descrição. Divergências entre o quadro 06 e o código, mantidas no código: (a) o quadro diz que Scrum do time tem retro, mas `TEAM_PRESETS` não tem (M2.2 e teste ligam isso); a descrição segue o código, então diz "Sprints, check-ins e impedimentos"; (b) o quadro diz "Backlog e quadro. Nada além disso" para Quadro simples, mas o preset tem também Agenda; a descrição diz "Backlog, quadro e agenda"; (c) Completo diz "Tudo ligado", mas exclui os módulos do M10; a descrição diz "Tudo o que existe hoje, incluindo integrações". Pedro precisa decidir se (a) e (b) mudam no preset ou no quadro. Contexto `ctx`/`assertTenant` não se aplica: rótulos são dados puros, sem entidade nem acesso. Conferência visual dos rótulos na tela fica para M2.10.

**Status M2.4:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-4-check.log`, 129 arquivos e 1109 testes). Só application. `ChangeTeamModules` desliga um `active` com itens que dependem dele para `winding_down` e sem itens para `disabled` direto; devolve `{ statuses, windingDown }`, com a prévia de cada módulo que entrou em encerramento (quebra da assinatura antiga, sem outro chamador ainda). Desligar um módulo já encerrando não muda nada: só `FinishTeamModuleWindingDown` leva a `disabled`, e recusa se outro módulo ativo ou encerrando depende dele. Reativar cancela. Histórico com data e autor em `teamModuleEvents`, como antes. Contagem de itens saiu para `countItems`, compartilhada com a prévia. Comentário de `guard.ts` trocado (não cita mais preset). O teste do M1.6 de desligar sem reuniões continua afirmando `disabled` direto, porque agora é o caso sem itens.

**Status M2.7:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-7-check.log`, 132 arquivos e 1137 testes). Contrato em `packages/contract/src/team-modules.ts` (novo): schemas de get, previewImpact, change e finishWindingDown, com `teamModuleIdSchema` (enum dos 15 ids). O contrato não importa `core` (PLANO 3.1), então a lista de ids é duplicada; `register-handlers.test.ts` garante que é igual a `MODULE_IDS`. Canais em `channels.ts`, registro em `api.ts`, `AgileBoxApi.teamModules`, cliente em `ipc-client.ts` e fake em `fake-api.ts`. Handlers em `apps/desktop/src/main/ipc/register-handlers.ts`, com `createTenantContext(actor)`; campos opcionais passam por spread condicional por causa de `exactOptionalPropertyTypes`, como nos outros handlers. `preload/index.ts` não mudou: a ponte `invoke` é genérica. O teste de preload passou a conferir que todo canal da API é encaminhado com o mesmo nome. Testes: schema recusa id desconhecido em todas as entradas; handler com casos de uso reais em memória recusa colaborador em change, previewImpact e finishWindingDown, deixa o colaborador ler e devolve VALIDATION para id inválido; gestor muda e recebe os estados. Sem tela.

**Status M2.8a:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-8a-check.log`, 134 arquivos e 1142 testes). Tokens ficam em `packages/ui/src/styles/tokens.css` e não em `apps/desktop/src/renderer/shared/`: o PLANO (3.1 e estrutura de arquivos) põe tokens e componentes base em `packages/ui`, e o renderer já os importa de lá. Acrescentados `--surface-selected`, `--color-border-control`, `--size-status-dot`, `--glass-float*` (vidro de camadas flutuantes, para M2.8b); nenhum token antigo foi removido. Já existiam e foram reaproveitados: `Button` (primário e secundário), `SegmentedControl`, `TextField` e demais campos, `IconButton`, `SignalBadge` (chip de sinal, raio agora `--radius-chip`). Novos: `Switch` (`role="switch"`, `aria-checked`, alvo de 44px, respeita reduced motion) e `Card`. Botão perde o deslocamento de hover sob reduced motion. Quadro 00 lido pelo Artifact (`project/Main.dc.html`): valores conferidos com os tokens. Não foi feito: menu de vidro e toast (M2.8b), galeria de desenvolvimento com os componentes novos.

**Status M2.8b:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-8b-check.log`, 136 arquivos e 1152 testes). Novos em `packages/ui/src/components/`: `GlassMenu` (`role="menu"`, itens `menuitem`, separador, setas, Home/End, Esc e Tab fecham, foco volta ao gatilho via `useRestoreFocus`; 230px, raio 14px, vidro `--glass-float`, medidas do quadro 08) e `GlassToast` (`role="status"`, canto inferior esquerdo, 8 s, barra de tempo, botão de ação com atalho, pausa com foco dentro, com movimento reduzido a barra anda em degraus de 1 s, medidas do quadro 08). Token `--radius-float: 14px` acrescentado. `Toast` e `StatusMenu` antigos ficaram como estavam, porque a bandeja, `SaveError` e a galeria os usam; unificar fica para decisão do Pedro. Testes em `GlassMenu.test.tsx` (5) e `GlassToast.test.tsx` (5). Não fez: ligar as telas (M2.9 a M2.12) nem o atalho Ctrl Z, que é do M2.12.

**Status M2.9:** feito, sem commit (`pnpm check` exit 0, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-9-check.log`, 138 arquivos e 1176 testes). O renderer pode importar `core` (PLANO 3.1 e `tooling/layers.js`), mas a regra ficou no lado main: `teamModules.get` agora devolve `{ level, screens, statuses }`, com `effectiveCapabilities` e a nova `sidebarScreens` (`packages/core/src/modules/screens.ts`, testes em `screens.test.ts`). Contrato espelha `EXPERIENCE_LEVELS` e `SIDEBAR_SCREEN_IDS`, com teste de igualdade em `register-handlers.test.ts`. Renderer: `PanelShell` filtra o menu por `screens` (`PanelShell.test.tsx`, 8 testes) e cai para Quadro e Agenda enquanto a consulta não responde. `App.manager.test.tsx` passou a simular as telas por papel. Atalho G D só abre Dashboard se a tela está liberada. Itens novos: Backlog, Sprints, Impedimentos, Integrações e Ferramentas (só gestor e Avançado). Plug-ins continua com "Em breve". Não fez: a tela Ferramentas (M2.10) nem ligação com a troca de nível.

**Correção do M2.9 (revisão, sem commit):** a tela que o servidor não libera deixava a área vazia. `App.tsx` agora calcula a view com `resolveView(view, screens)` (em `PanelShell.tsx`, junto de `allowedScreens` e `FALLBACK_SCREENS`) e usa essa mesma view no menu, no conteúdo e na busca do fluxo do quadro. `G A`, `G D` e `G Q` só trocam para telas liberadas. A paleta recebe `screens` no lugar de `isManager` e só lista Quadro, Agenda e Dashboard quando liberados. `screens.ts` não mudou. Testes: `App.test.tsx` (bloco "Telas liberadas pelo servidor": tela aberta que sai da lista depois da resposta, `G A` sem liberação, `G D` de colaborador), `PanelCommands.test.tsx` (paleta sem telas não liberadas e com Dashboard liberado) e `PanelShell.test.tsx` (o teste da linha 97 agora prova o conteúdo do quadro e a ausência do conteúdo do dashboard). Antes da correção, falhavam os 2 testes do `App` com a view presa e a paleta; `G D` e o teste do `PanelShell` já passavam e ficaram como guardas. `pnpm check` exit 0 (138 arquivos, 1181 testes), log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-9-fix-check.log`.

**Status M2.9b:** feito, sem commit (`pnpm check` exit 0, 141 arquivos e 1209 testes, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-9b-check.log`). Pré-requisito da tela Ferramentas. Decisão do Pedro: quadro 07 mantido, então Ferramentas segue só no Avançado e o gestor troca o nível em Ajustes. Application: `GetTeamLevel`, `SetTeamLevel` e `GetTeamCapabilities` em `use-cases/team-settings/team-settings.ts`, com `ctx`/`assertTenant`. `teamSettings` entra em `UnitOfWorkRepositories` (fake e SQLite). Achado na revisão: o adaptador SQLite montava `teamSettings` fora do objeto que o UoW recebe, então o UoW não o enxergava; corrigido e coberto por teste em `create-sqlite-adapters.test.ts`. Só o gestor grava (`canManageTeamModules`). Sem registro, o nível é `SUGGESTED_LEVEL` (Padrão). Pedir o nível que já vale não regrava o registro. Histórico: o registro guarda só quem e quando da última troca (o que `team_settings` já tinha). Não há tabela de eventos de nível, porque exigiria migração nova; se o Pedro quiser o histórico completo como em `teamModuleEvents`, é um passo à parte. `teamModules.get` devolve o nível gravado e a composição de telas saiu do adaptador IPC para `GetTeamCapabilities`. Contrato: `packages/contract/src/team-settings.ts`, canais `teamSettings.getLevel` e `teamSettings.setLevel`. Renderer: `TeamLevelSection` em Ajustes, só para o gestor (segmentado com os três níveis, descrição do nível atual, `TEAM_SCOPE_NOTICE`, alerta em texto se falhar). Grava com `useSetTeamLevel`, que invalida `queryKeys.teamModules.capabilities`. O nível que já vale não chama o servidor. Testes: `team-settings.test.ts` (aplicação), `team-settings.test.ts` (contrato), `experience-level.test.ts` (núcleo), `register-handlers.test.ts` (5 novos), `SettingsView.test.tsx` (4 de opacidade e fundo, 5 de nível), `ipc-client.test.ts`, `create-sqlite-adapters.test.ts`. Pendência do M2.9 sobre caso de uso de nível resolvida.

**Status M2.9c:** feito, sem commit (`pnpm check` exit 0, 141 arquivos e 1212 testes, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-9c-check.log`). Correções pedidas na revisão do M2.9b, sem mudar escopo. (1) Nível fora do catálogo no banco: `mapTeamSettingsRow` valida com `isExperienceLevel` e cai em `SUGGESTED_LEVEL`, para Ajustes continuar abrindo (teste em `team-repositories.test.ts`, com linha gravada direto como `expert`). Isso esconde dado corrompido em silêncio; é o comportamento pedido, mas vale saber. (2) `SetTeamLevel` com entrada ausente ou sem `level` devolve `ValidationError`, não `TypeError` (`team-settings.test.ts`, com `undefined` e `null`). (3) `register-handlers.test.ts`: o teste "colaborador não grava" passa a usar uma unidade de trabalho compartilhada com o gestor. O gestor grava `basic`, o colaborador tenta `advanced` e recebe FORBIDDEN, e os dois leem `basic`. O teste antigo comparava com o padrão, que já era o valor. (4) `SettingsView.test.tsx`: novo teste que prova a troca de conteúdo da seção depois do refetch (descrição do Avançado aparece, a do Padrão some, opção marcada). Verificado por mutação: sem a permissão em `SetTeamLevel` falha o teste do IPC; sem a invalidação em `useSetTeamLevel` falham os dois testes de Ajustes. Os arquivos foram restaurados. Não cobre o menu lateral, que é de outra tela; o teste prova a seção de Ajustes, que é a superfície do nível.

**Status M2.10a:** feito, sem commit (`pnpm check` exit 0, 143 arquivos e 1250 testes, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-10a-check.log`). Tela Ferramentas sem Aplicar e Cancelar. Novo `apps/desktop/src/renderer/panel/tools/`: `tool-draft.ts` (função pura: rascunho a partir do servidor, ligar e desligar pela regra do core, presets, sinal e dependências), `ToolCard.tsx` (interruptor, dependência em texto, sinal com texto e ícone) e `ToolsView.tsx` (presets como botões com `aria-pressed`, aviso em `role="status"`, falha em `role="alert"`). `PanelShell` renderiza a tela na rota `tools`, no lugar de "Em breve". O renderer importa `core` direto (PLANO 3.1 permite), então não há IPC novo nem regra duplicada. Textos em `panel/copy.ts`. Só o gestor vê: a tela confere o papel, e a barra lateral já filtra pelo servidor.

- **Cartões:** Quadro (sempre ligado, interruptor desabilitado), Agenda, Backlog, Sprints, Check-ins, Impedimentos, Estimativa por horas, Aceite e Integrações. **Fora:** `estimates.points` (D8) e os cinco módulos do M10 (WIP, subtarefas, métricas, burndown e retro), que ainda não existem e não têm cartão no quadro. Essa exclusão é decisão minha nesta etapa; ver pendência 7.
- **Dependências:** ligar uma ferramenta puxa o que ela exige, e o aviso diz quem entrou. Desligar uma ferramenta com dependentes ativos tira os dependentes junto, porque o servidor só aceita essa cascata na mesma mudança; o aviso diz quem saiu. Conflito (horas com pontos) recusa com o motivo em texto.
- **Q1 a Q3:** os textos de `PRESET_LABELS` já estavam nas recomendações A (Scrum sem retro; Quadro simples com Agenda; Completo com "Tudo o que existe hoje, incluindo integrações"). `labels.ts` não mudou.
- **Quadros 06 e 07 não foram lidos:** a ferramenta Artifact não estava disponível nesta sessão. Layout e medidas seguem o texto do HANDOFF_M2. Conferência visual fica para a revisão do M2.10b.
- **Testes:** `tool-draft.test.ts` (regra do rascunho, presets, sinal, dependências), `ToolsView.test.tsx` (papéis e `aria-checked`, dependência puxada e cascata, `estimates.points` ausente, rascunho sem gravar, colaborador sem a tela, falha ao carregar) e 2 casos novos em `PanelShell.test.tsx` (rota `tools` liberada e não liberada). Mutação: reintroduzir `estimates.points` em `TOOL_IDS` derruba 2 testes.
- **Próximo: M2.10b** (prévia em vidro com Aplicar e Cancelar, aviso de nível, e conferência visual dos quadros 06 e 07).

**Status M2.10a-fix:** correções da revisão do M2.10a, sem commit (`pnpm check` exit 0, 144 arquivos e 1263 testes, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-10a-fix-check.log`). Teste antes do código: 12 falhas vermelhas, depois verde.

- **Decisão M2.10a-fix (módulos sem cartão):** `estimates.points` (D8) e os cinco módulos do M10 ficam fora do conjunto editável. O rascunho guarda o que o servidor devolve como ativo, para a prévia do M2.10b comparar com o gravado. Quando um conflito ou uma exigência em falta envolve um módulo sem cartão, o rascunho o tira sem aviso e refaz a resolução (`resolveDroppingHidden` em `tool-draft.ts`). `pulled`, `leaving` e as recusas citam só ferramentas com cartão. Desligar também leva em silêncio os dependentes sem cartão. Os presets não contêm esses módulos, então aplicar um preset os tira do rascunho. **Pendente do Pedro:** a prévia do M2.10b deve mostrar essas saídas silenciosas, ou só as que têm cartão?
- **B1 (rascunho com todo o catálogo):** corrigido. Ligar "Estimativa por horas" com pontos ativos no servidor funciona e tira pontos sem erro. Desligar Sprints com Retro ativa funciona e a mensagem não cita Retro (`ToolsView.test.tsx` e `tool-draft.test.ts`).
- **B2 (colaborador vacuoso):** o teste espera um sinal positivo antes de afirmar ausência de interruptor. O sinal é `LoadProbe`, que mostra "Sessão e estado carregados" quando a sessão e o estado do time já chegaram. Mutação: removido o guarda de papel de `ToolsView.tsx`, o teste falhou com 9 interruptores. Arquivo restaurado e conferido por `diff`.
- **Opcionais feitos:** `aria-describedby` no interruptor, ligando dependência e sinal (`ToolCard.tsx`, com `useId`); texto de dependência em `dependency-text.ts`, com " ou " dentro de `requiresAnyOf` (teste em `dependency-text.test.ts`); `toolsHint` agora diz "depois de aplicar".
- **Opcional não feito:** `useTeamCapabilities()` só para gestor. Com a consulta condicionada, o colaborador nunca pede o estado, e a mutação do B2 deixaria de detectar a remoção do guarda. O servidor já recusa. Fica para decisão do Pedro.
- **Ramo sem caso atual:** a recusa por conflito entre ferramentas com cartão não tem caso hoje, porque nenhum par com cartão entra em conflito e toda exigência entre eles é puxada ao ligar. O ramo continua no código, sem teste de tela.

**Status M2.10b:** feito, sem commit (`pnpm check` exit 0, 145 arquivos e 1289 testes, log em `/tmp/claude-1000/-home-peeddrroolg--rea-de-trabalho-Projetos-agilebox-handoff/250a56b1-8abf-4bd5-ada3-633af224a55d/scratchpad/m2-10b-check.log`). Prévia em vidro à direita do quadro 06, com Aplicar e Cancelar.

- **Plano da mudança** (`tools/change-plan.ts`, função pura, `change-plan.test.ts`): compara o rascunho com os módulos `active` do servidor. `teamModules.change` aceita só `enable` e `disable`, então o conjunto final vira essas duas listas (o servidor resolve o resto). Separa "escolha" de "por dependência" (`enableRoots`, `enablePulled`, `disableRoots`, `disableCascaded`). Título: "Ligar X", "Desligar X" ou "Ajustar ferramentas do time".
- **Impacto:** `teamModules.previewImpact` só para os módulos que saem (`disable`). Ligar não tem prévia de impacto no servidor. Itens somados por tipo e destino, sem contagem zerada; a linha mostra "3 · escondidas". Módulo sem cartão que sai (hoje `estimates.points`, por preset) aparece como "Também sai", como pedido.
- **Aplicar:** chama `change` com a diferença. Sucesso: `GlassToast` com "Mudança aplicada ao time." (ou "Encerrando: X" quando algum módulo entrou em encerramento), rascunho zerado e `teamModules.capabilities` invalidado (o estado é relido do servidor antes de a prévia sumir). Falha: texto em `role="alert"` dentro da prévia, rascunho mantido.
- **Cancelar** descarta o rascunho sem chamar `change`. **Esc** cancela quando há mudança (e não durante a gravação). Depois de Aplicar e de Cancelar, o foco vai para o título da prévia.
- **Aviso de escopo:** `TEAM_SCOPE_NOTICE` aparece sempre na prévia, como no quadro.
- **Movimento:** a entrada da prévia usa `motion-fade-enter` só sem `prefers-reduced-motion`.
- **Teste antigo ajustado:** "rascunho não chama alteração nem prévia" passou a permitir a prévia (que agora é só leitura). Continua proibindo `change`.
- **Teste de shell:** `PanelShell.test.tsx` passa a simular `matchMedia` na tela Ferramentas (a prévia lê a preferência de movimento; o jsdom não tem a API).
- **Não feito: `finishWindingDown`.** O quadro 06 não tem controle para concluir o encerramento, então a tela não chama essa rota. Ver pendência abaixo.

**Conferência visual M2.10** (quadros 06 e 07 lidos pelo Artifact, versão `1793642272-40d3`; `project/Ferramentas.dc.html` e `project/Niveis.dc.html`):

Corrigido (CSS e texto, o quadro vence):

- Textos de dependência: "Precisa de X" (era "Depende de X."), "Independente" (era "Sem dependências."), "Base" (era "Base do time, sempre ligada."). `copy.ts`, `dependency-text.test.ts`, `ToolsView.test.tsx`.
- Cada cartão ganha a descrição do quadro e o ponto de estado de 9 px (`ToolCard.tsx`, `tool-descriptions.ts`).
- Chip de sinal com altura 24 px, raio 8 e fundo só no estado de atenção; dependência em mono 11 px; cartão com altura mínima 128 px, raio 14 px, padding 14/16 px.
- Presets com nome e descrição dentro do botão (antes só o nome), rótulo visível "Ponto de partida", 200–280 px por 64 px mínimo.
- Grade de cartões: `minmax(300px, 1fr)` e espaço de 12 px (era 240 px).
- Cabeçalho: o texto "Ligue só o que o time usa. Cada ferramenta aparece no menu de todos; o resto fica fora do caminho." substitui "Desligar esconde...".
- Layout: prévia de 340 px à direita, sticky, com tokens `--glass-float`; abaixo de 900 px empilha.

Divergências mantidas (decisão do Pedro):

- **Cartões:** o quadro 06 não tem cartão de "Estimativa por horas" e tem cartão de "Retro" (módulo do M10). O código mantém "Estimativa por horas" (M2.10a) e não tem "Retro". A descrição de "Estimativa por horas" não existe no quadro: o texto "Horas estimadas por tarefa." é novo, a confirmar.
- **Sinal "Ligada"/"Desligada":** o quadro esconde o sinal nesses dois estados e mostra só "Sai com X" e "Precisa de X". O código mostra o texto em todos os cartões, porque o estado em texto é exigência de acessibilidade (M2.10a). Não implementei "Sai com X" nem "Precisa de X" no cartão: o rascunho já mostra o que sai na prévia.
- **Descrições dos presets** (texto de `labels.ts`, decisão M2.6): Quadro simples diz "Backlog, quadro e agenda." (quadro: "Backlog e quadro. Nada além disso."); Scrum do time não cita retro (quadro: "... e retro"); Completo diz "Tudo o que existe hoje, incluindo integrações." (quadro: "Tudo ligado, incluindo integrações."). Mantido o texto do código, porque o conteúdo do preset não bate com o quadro.
- **Cabeçalho do quadro** (título "Ferramentas do time" e a etiqueta "Time · Desenvolvimento"): não repetido na tela, porque o shell já mostra o título "Ferramentas".
- **Destinos por tipo** do quadro (check-ins arquivados, impedimentos viram tarefa no Backlog, retros arquivados) dependem de M5 e M10. Hoje a prévia mostra só o que o servidor devolve (reuniões escondidas). Tarefas só aparecem se o núcleo sai, o que nunca acontece, então "tarefas ficam no Quadro" não aparece na prévia.
- **Barra lateral** (item Ferramentas com ponto de destaque): não conferido nesta etapa.
- **Quadro 07 (Níveis):** não há tela de níveis neste passo (o controle fica em Ajustes, M2.9b). Conferido só o texto do aviso de escopo, que é o mesmo do quadro 06.

Pendências do M2.10b (para o Pedro):

1. **Encerramento:** o quadro não prevê concluir o encerramento. Um módulo que entra em `winding_down` (quando tem itens) fica "Encerrando" até alguém chamar `finishWindingDown`. Confirmar se o quadro ganha esse controle ou se fica em outra tela.
2. **Estimativa por horas:** confirmar se tem cartão (o quadro não tem) e o texto da descrição.
3. **Descrições dos presets e cartão de Retro:** decisão (a), (b) e (c) da conferência acima.

Pendências do M2.9 (para o Pedro):

- ~~Sem caso de uso para ler ou gravar o nível do time~~ **Resolvido no M2.9b** (`GetTeamLevel`, `SetTeamLevel`, `GetTeamCapabilities`).
- **Ferramentas só aparece no Avançado (quadro 07).** Um gestor no Padrão não chega à tela Ferramentas, que é onde o nível seria trocado. Confirmar se o gestor deve ver Ferramentas em qualquer nível, ou se a troca de nível fica em outro lugar.
- **Telas ainda não construídas.** Backlog (M3), Sprints (M4), Impedimentos (M5) e Integrações (M11) já aparecem no menu quando liberados, e abrem a tela "Em breve" do fallback. Ferramentas abre o mesmo fallback até o M2.10.
- **Ferramenta em encerramento conta como ligada no menu** (`winding_down`), porque ainda tem itens em uso. Confirmar.
- **Ordem do menu** segue o quadro 07 (Dashboard depois de Sprints). O quadro 02 põe Dashboard antes de Agenda. Confirmar.
- **Mudança de contrato:** `teamModules.get` deixou de devolver lista e passou a devolver objeto. Nenhum consumidor real existia (só testes e o fake).

| Tarefa         | O que faz                                                                                                                                                                                                                                                                                                                         | Arquivos prováveis                                                                                                                                                                                              | Testes                                                                                                                                                                                                                                   | Escopo                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M2.1           | Alinha o registro às decisões 1 e 3: `minLevel` de `impediments` e `acceptance` vira `advanced`; tira o aviso "inferido" dos comentários                                                                                                                                                                                          | `packages/core/src/modules/registry.ts`, `registry.test.ts`                                                                                                                                                     | Arestas confirmadas; `minLevel` de cada módulo; ciclo continua recusado                                                                                                                                                                  | Só core                                                           |
| M2.2           | Presets como dados: Quadro simples (Núcleo, Agenda, Backlog), Scrum do time (sem retro, sem estimativas e critérios, conforme o handoff) e Completo fora até o M10                                                                                                                                                                | `packages/core/src/modules/presets.ts` (novo), `index.ts`                                                                                                                                                       | Cada preset resolve a partir de vazio via `resolveModuleSet`; nenhum preset cita módulo do M10; Scrum do time não tem `reviewRetro`                                                                                                      | Só core                                                           |
| M2.3 (feito)   | Prévia de impacto com destino por tipo: tarefas (ficam no Quadro) e reuniões (padrão B de P2). Impedimentos, check-ins e retros entram quando existirem                                                                                                                                                                           | `packages/core/src/modules/impact-preview.ts` e `.test.ts`                                                                                                                                                      | Prévia traz destino por tipo com a contagem; tipo sem destino não passa                                                                                                                                                                  | Só core                                                           |
| M2.4 (feito)   | `ChangeTeamModules` desliga via `winding_down` quando há itens (sem itens, vai direto a `disabled`); novo caso de uso para concluir o encerramento; reativar cancela. Ajusta o teste do M1.6 se ele afirmava `disabled` direto                                                                                                    | `packages/application/src/use-cases/team-modules/team-modules.ts` e `.test.ts`, `create-use-cases.ts`, `modules/guard.ts` (teste)                                                                               | Desligar agenda com reuniões: `winding_down`, reuniões intactas, guard recusa criar e aceita listar/editar; concluir vira `disabled`; reativar volta a `active` com dados; sem itens, `disabled` direto; colaborador recusado sem gravar | Só application                                                    |
| M2.5 (feito)   | Campos da tarefa por nível, como função pura: Essencial (título, estado, prazo); Padrão (+ responsáveis, estimativa, linha do tempo, recolhido "Campos avançados"); Avançado (+ custo por hora, dependências, critérios, etiquetas). Estimativa some se `estimates.hours` está desligado                                          | `packages/core/src/modules/task-fields.ts` (novo), `index.ts`                                                                                                                                                   | Cada nível lista seus campos; subir de nível não remove dado, só muda visibilidade; módulo desligado esconde o campo ligado a ele                                                                                                        | Só core                                                           |
| M2.6 (feito)   | Rótulos pt-BR de níveis, módulos e presets, e o aviso de nível da decisão 6 ("Vale para o time inteiro. Os outros times não mudam.")                                                                                                                                                                                              | `packages/core/src/modules/labels.ts` (novo)                                                                                                                                                                    | Todo `ModuleId` tem rótulo; rótulos não repetem; aviso fala de "time" e não de "projeto". Se o Pedro preferir na interface, move para `apps/desktop`                                                                                     | Só core                                                           |
| M2.7 (feito)   | Contrato Zod e IPC de `teamModules` (get, previewImpact, change), sem tela                                                                                                                                                                                                                                                        | `packages/contract/src/` (novo arquivo), `apps/desktop/src/main/ipc/`, `apps/desktop/src/preload/`                                                                                                              | Schema recusa id desconhecido; handler recusa colaborador; contrato de canais                                                                                                                                                            | Sem tela, toca IPC                                                |
| M2.8a (feito)  | Tokens e componentes base do handoff: botão primário e secundário, segmentado, campo, cartão, chip de sinal, interruptor (`role="switch"`), alvos de 44px. Menu de vidro e toast ficam para M2.8b                                                                                                                                 | `packages/ui/src/styles/tokens.css`, `packages/ui/src/components/` (`Switch`, `Card` novos)                                                                                                                     | Testing Library: papéis e `aria-checked`; `aria-label` em botões de ícone                                                                                                                                                                | Tela                                                              |
| M2.8b (feito)  | Menu de vidro (`role="menu"`) e toast (`role="status"`), com os tokens `--glass-float*` já prontos                                                                                                                                                                                                                                | `packages/ui/src/components/`                                                                                                                                                                                   | Papéis `menu`/`menuitem` e `status`; reduced motion                                                                                                                                                                                      | Tela                                                              |
| M2.9 (feito)   | Barra lateral: item Ferramentas só para gestor; filtro por nível e módulos ligados (aparece se o nível libera **e** o módulo está ligado)                                                                                                                                                                                         | `apps/desktop/src/renderer/panel/layout/` (barra lateral), usa `effectiveCapabilities`                                                                                                                          | Colaborador não vê Ferramentas; Essencial não vê Backlog; módulo desligado não aparece                                                                                                                                                   | Tela                                                              |
| M2.9b (feito)  | Nível do time gravado (leitura para qualquer integrante, gravação só do gestor), `teamModules.get` passa a usar o nível gravado, composição de telas em `GetTeamCapabilities`, contrato e IPC de `teamSettings`, e controle de nível em Ajustes só para o gestor (segmentado, aviso de escopo). Pré-requisito da tela Ferramentas | `packages/application/src/use-cases/team-settings/` (novo), `ports/unit-of-work.ts`, `packages/contract/src/team-settings.ts` (novo), `apps/desktop/src/main/ipc/`, `apps/desktop/src/renderer/panel/settings/` | Padrão sem registro; colaborador recusado na gravação; nível que já vale não regrava; Essencial esconde Backlog ligado; invalidação de `teamModules.capabilities`                                                                        | Tela (Ajustes)                                                    |
| M2.10a (feito) | Tela Ferramentas sem gravação: cartões com interruptor (`role="switch"`), dependência em texto e sinal de estado (texto e ícone), presets e rascunho local. Ativar puxa as dependências com `resolveModuleSet` do core; desligar tira junto os dependentes. `estimates.points` escondido (D8)                                     | `apps/desktop/src/renderer/panel/tools/` (nova), `layout/PanelShell.tsx`                                                                                                                                        | Papéis e `aria-checked`; dependência puxada aparece; `estimates.points` ausente; colaborador não vê a tela; rascunho não chama `change` nem `previewImpact`                                                                              | Tela (sem Aplicar/Cancelar)                                       |
| M2.10b (feito) | Prévia em vidro à direita com Aplicar e Cancelar; aviso de nível; Aplicar chama `change` e Cancelar não chama; encerramento mostrado na prévia; conferência do layout nos quadros 06 e 07                                                                                                                                         | `apps/desktop/src/renderer/panel/tools/`                                                                                                                                                                        | Aplicar chama `change`; Cancelar não chama; prévia mostra o que sai junto                                                                                                                                                                | Tela                                                              |
| M2.11          | Campos da tarefa por nível na tela de detalhe, com "Campos avançados" recolhido                                                                                                                                                                                                                                                   | `apps/desktop/src/renderer/panel/task-detail/`                                                                                                                                                                  | Campos somem e aparecem conforme o nível; recolhido por padrão                                                                                                                                                                           | Tela                                                              |
| M2.12          | Renomear (clique no título ou F2; Enter salva, Esc cancela), Arquivar no menu "⋯" (atalho E), mesmo menu para projeto na barra lateral, toast de desfazer 8s com Ctrl Z. Cobre M0.9b e M0.11                                                                                                                                      | `apps/desktop/src/renderer/panel/task-detail/`, barra lateral, `shared/query`                                                                                                                                   | Renomear com Enter e Esc; arquivar some da lista; desfazer restaura; toast tem `role="status"`                                                                                                                                           | Tela (usa casos de uso existentes de arquivar e renomear projeto) |

### Pendências para o Pedro

**Status M2.10b-fix:** correções do revisor na prévia de Ferramentas (TDD, teste vermelho antes). B1: a cascata de desligar inclui módulos em `winding_down` (`toggleTool` e `planChanges`), então a prévia mostra o que sai junto e o servidor recebe a lista completa; a recusa do servidor aparece com a razão. B2: Aplicar só libera com a prévia de impacto pronta, com "Calculando…" no carregamento e alerta em texto na falha. B3: interruptores e presets travam durante a gravação; Cancelar não reseta a gravação em andamento; o rascunho só é descartado depois da releitura do estado do time. Opcionais feitos: (4), (7) e (9). Não feito: (5), porque a prévia não sabe quais itens o gestor escolheu explicitamente, e isso pede estado extra. Achado para o servidor (não alterado): `ChangeTeamModules` reativa um `winding_down` que sobrevive à resolução de qualquer mudança (`desired = resolution.enabled`), mesmo sem ele ser pedido. A tela não mostra isso até gravar. Decisão para o Pedro: corrigir no servidor (só reativar o que está em `enable`) ou tratar como comportamento.

1. Responder P1 (A ou B) e P2 (A ou B). Recomendações acima.
2. Quadro simples: Agenda entra no preset (como no plano) ou não (como no handoff)?
3. Dashboard: entra no catálogo como módulo ou fica como tela fixa do gestor?
4. Presets que ligam Backlog, Sprints, Check-ins e Impedimentos antes de as telas existirem (M3 a M5): tudo bem, ou o preset Scrum espera o M5?
5. Quadro 06 (Ferramentas) e quadro 07 (Níveis) não foram abertos nesta sessão. Antes de M2.10, confirmar o layout nos quadros.
6. Pendências herdadas: M0.8 (`renameProject`, ainda com trabalho de outra sessão em `rename-project.ts`), M0.9b, M0.11, teste instável de `App.manager.test.tsx` e D10.
7. M2.10a: confirmar se os cinco módulos do M10 (WIP, subtarefas, métricas, burndown e retro) ficam fora dos cartões até o M10 existir (hoje ficam fora) e se Estimativa por horas tem cartão. Confirmar também o layout dos quadros 06 e 07, que não foram lidos nesta sessão.

**Status M2.10c (servidor: `winding_down` não é reativado sem pedido):** feito. TDD: três testes vermelhos antes da correção (ligar Backlog com Check-ins encerrando; desligar Agenda; ativar Retro, que depende de Sprints) e um de controle (pedir Check-ins em `enable` cancela o encerramento). Em `ChangeTeamModules`, um módulo `winding_down` só entra em `desired` se estiver em `enable`. `vitest run packages/application packages/core`: 599 testes verdes. Pendências para o Pedro: (a) o contrato do M2.4 diz que desligar de novo um módulo já encerrando não muda nada (continua `winding_down`); manter. (b) Ligar Sprints com Backlog encerrando deixa Backlog `winding_down` sob Sprints ativo, porque a dependência já está no conjunto; confirmar.

**Status M2.12b (listagens ocultam arquivadas):** feito. Tarefas arquivadas saem de quadro (`listBoard`), `listByProject`, Recentes, Frequentes, busca, `tasks.count` e `participations.count` (base da prévia de impacto). `findById` continua trazendo a arquivada (linha do tempo e desfazer). Mesma regra no fake em memória; caso acrescentado ao contrato compartilhado (memória e SQLite). A prévia de impacto conta só projetos ativos. `ListProjects` já oculta arquivados por padrão. `packages/application` e `packages/infra-sqlite` verdes (209 testes). Pendente: `findByProjectNameKey` continua incluindo arquivadas (decisão).

**Status M2.11 (campos da tarefa por nível):** feito (`fc2a47b`). `TaskDetailView` lê `teamModules.get` e monta os campos com `taskFieldLayout`; módulo ligado = estado diferente de `disabled`. Essencial: título, estado, prazo (+ chamado e descrição, fora do catálogo). Padrão: + responsáveis, estimativa (horas por participação) e "Campos avançados" recolhido (botão com `aria-expanded`/`aria-controls`, 44px) com custo por hora. Avançado: custo por hora sempre visível. Sem `estimates.hours`, a estimativa some. Sem permissão, o servidor já envia `rate`/`total` nulos. Sem capacidades carregadas, cai no Essencial. Dependências, critérios e etiquetas ainda não têm dado nem tela. Pendências do Pedro: estimativa usa as horas por participação; com horas desligadas o custo segue calculado com horas que não dá para lançar; chamado e descrição em todos os níveis; o recolhido pede conferência no quadro 07.

**Status M2.12 (renomear, arquivar, desfazer):** feito. Renomear no lugar (tarefa: F2/Enter/Esc; projeto na barra lateral), arquivar pelo menu "⋯" (tarefa com atalho E; projeto na barra lateral) e desfazer em aviso de 8 s com Ctrl Z (`role=status`). Correções da revisão (M2.12-fix): F2/E ignoram teclas já tratadas, foco na barra lateral e Shift+E; menus fecham no clique fora, na saída do foco e ao abrir outro; avisos de desfazer em fila FIFO nomeando o item; alerta de erro some em 5 s; `canManageProject` no `App.tsx` (gestor ou criador). `desktop-renderer` 334/334. Pendências: foco de destino após arquivar; conferir o foco de fechamento do menu no Electron real; renomear projeto com nome duplicado mostra só mensagem genérica; tarefas arquivadas sem tela de desarquivar.

**Status M2.12c (Ajustes lista projetos arquivados):** feito. Seção "Projetos arquivados" em Ajustes com "Desarquivar projeto <nome>" (criador ou gestor; recusa do servidor em `role=alert`), estado vazio em texto, chave `queryKeys.projects.archived`. A lista sai da diferença entre `projects.list({ includeArchived: true })` e `projects.list()` porque `ProjectDto` não traz `archivedAt` (pendência: expor o campo). `panel/settings` 27/27.

## Antes do M3 — o que o Pedro precisa decidir

Sessão Claude, 2026-11-02. Só leitura de código, notas e `git log`. Nenhum código alterado e nenhum commit. Os commits citados são os de `git log --oneline`.

### 1. Critérios de saída do M2 (plano)

- **Trocar nível ou preset não perde dados: PARCIAL.** Domínio e contrato atendidos: nível grava só `level` (`8c2805e`); desligar com itens vai a `winding_down` e reativar preserva dados (`61a3aa9`, `6654f31`); campos por nível só mudam visibilidade (`13bd9e0`). Falta teste ponta a ponta no Electron real. `finishWindingDown` tem IPC, mas nenhum controle no renderer, então um módulo pode ficar "Encerrando" sem saída pela tela.
- **Desativar módulo com sprint ativa não deixa item órfão: PARCIAL.** Sprints só existe no M4. O mecanismo vale para a Agenda (reuniões em `winding_down`, `61a3aa9`).
- **Time Básico trabalha sem saber Scrum: PARCIAL.** Menu filtrado e teste "Essencial não vê Backlog, Sprints nem Dashboard" (`7a45e02`); campos do Essencial (`fc2a47b`). Falta a conferência visual do quadro 07 (pendência do M2.5 e do M2.11).
- **Entrega: menu por nível e campos avançados ocultos: ATENDIDO** (`7a45e02`, `fc2a47b`); conferência visual pendente.
- **Entrega: Ferramentas com presets, prévia e aplicação só pelo gestor: ATENDIDO** (`c0c5fc0`, `c72dc7c`, `6654f31`; `canManageTeamModules`).
- **Portão do M2 (100% das regras de dependência e conflito, M1 a M7): NÃO COMPROVADO.** A última medição de cobertura é do M1.12. Presets, `task-fields`, `labels`, `screens`, `change-plan` e `tool-draft` entraram depois, sem medição registrada.

### 2. Decisões abertas (deduplicadas)

**Bloqueiam o M3**

- **B1. Modelo do backlog.** Como o backlog fica separado da coluna Planejamento? A) campo de ordem e de "fora do quadro" na própria tarefa; B) entidade `backlog_items` que aponta para a tarefa. Rec.: A (as sprints do M4 apontam para a tarefa). Sem decidir: não há migração 0005 nem contrato.
- **B2. Escopo da ordem.** A) ordem única por time; B) ordem por projeto. Rec.: A (o módulo é do time). Sem decidir: índice e tela não têm escopo.
- **B3. Quem reordena e edita critérios.** A) só o gestor reordena, e cada participante edita os critérios das suas tarefas; B) qualquer participante reordena. Rec.: A. Sem decidir: a regra de acesso do M3 fica em aberto.
- **B4. Estimativa.** Hoje a estimativa é a soma das horas por participação (M2.11). A) campo "estimado" próprio na tarefa, separado das horas realizadas; B) manter as horas por participação. Rec.: A (ADR-07 pede estimativa em horas; o custo segue por participação). Sem decidir: estimativa e custo ficam ambíguos.
- **B5. Nível dos critérios.** Plano: telas do M3 no Intermediário. Handoff (decisão 3, M2.1): critérios são Avançado. A) Avançado; B) Intermediário. Rec.: A (decisão mais nova). Sem decidir: a tela de critérios não tem nível.
- **B6. Scrum do time.** Plano inclui Estimativas e Critérios; o handoff (decisão 4, já tomada) tirou. A) manter o handoff, e o M3 fica fora do preset; B) voltar ao plano. Rec.: A, com confirmação explícita. Sem decidir: o preset não liga nada novo do M3.

**Podem esperar**

- **P1. Impedimentos ao desligar.** Plano: encerram só depois de resolvidos; decisão 5: viram tarefa no Backlog. Rec.: decisão 5, com recusa se o Backlog sair junto. Vale no M5.
- **P2. Reuniões ao desligar a Agenda.** M2.3 aplicou B (sem destino novo). Confirmar; rever no M5 para todos os tipos.
- **P3. Controle para concluir o encerramento.** Rec.: botão no quadro 06 ao lado de "Encerrando". Sem ele, o estado pode ficar preso.
- **P4. Ligar Sprints com Backlog encerrando** deixa o Backlog em `winding_down` sob Sprints ativo (M2.10c, pendência b). Rec.: aceitar e reavaliar no M4.
- **P5. Textos de presets e cartões.** Q1 a Q3 seguem o código; o cartão "Estimativa por horas" não está no quadro e "Retro" não está no código. Rec.: ajustar o quadro ou o texto, sem mudar a lógica.
- **P6. Ferramentas só no Avançado.** O gestor no Padrão chega à troca de nível só em Ajustes. Rec.: manter.
- **P7. Dashboard** como módulo ou tela fixa do gestor, e ordem do menu (quadro 07 ou quadro 02). Rec.: tela fixa; ordem do quadro 07.
- **P8. Saídas silenciosas na prévia** de módulos sem cartão (`estimates.points`, M2.10a-fix). Decidir se a prévia as mostra.
- **P9. Tarefa arquivada sem tela para desarquivar** (só desfazer em 8 s). Rec.: lista de arquivadas por projeto. Idealmente antes do M3, para o backlog não esconder itens.
- **P10. Permissão de arquivar e renomear projeto** segue `canManageMembers` (M0.7); projeto não tem linha do tempo (M0.8). Confirmar.
- **P11. Laço Codex lendo o PROGRESS_2.md (D10)** ainda não aplicado. Sem ele, o M3 é manual.
- **P12. ADR-08, ADR-09 e aceite por maioria** (M4 e M6b). Confirmar antes do M4.

### 3. O que o M3 pede

- **Escopo (plano):** prioridade persistida com reordenação; critérios de aceitação; estimativa em horas ligada ao custo por hora (ADR-07); backlog separado da coluna Planejamento. Pronto quando: reordenar persiste e o backlog fica separado de `planning`.
- **Módulos:** `backlog` (sem dependência), `acceptance` (exige `backlog`) e `estimates.hours`.
- **Pacotes:** core (ordem e regra de critérios, funções puras); application (listar, reordenar, critérios, guard de módulo); infra-sqlite (migração 0005 e adaptador); contract (Zod e IPC); renderer (tela Backlog e campos no detalhe).
- **Faz sem tela:** core, application com testes, migração, adaptador e contrato, depois de B1 a B4. Não depende de design.
- **Precisa de decisão de design** (nenhum quadro de Backlog existe em `design/` nem no artefato):
  - layout da tela (lista única ou por projeto);
  - gesto de reordenar, com alternativa por teclado e botões (exigência de acessibilidade do handoff);
  - o que cada linha mostra (estimativa, critérios, responsável);
  - ação para levar o item ao Quadro;
  - editor de critérios no detalhe (checklist inline);
  - estado vazio e aviso de escopo ("vale para o time").

### 4. Riscos técnicos acumulados

- **Electron real:** nada do M2 foi rodado no app instalado. Foco ao fechar o menu e foco após arquivar não verificados (M2.12).
- **E2E e Playwright** adiados para M4 a M6 (CLAUDE.md). Nenhum fluxo de Ferramentas ou de desfazer foi validado ponta a ponta.
- **Cobertura** do M2 não medida (ver item 1).
- **`pnpm check` completo não registrado** em `6654f31`, `9190701`, `05a4121`, `fcc1e96` e nos commits de -fix; as notas citam só suítes parciais. Rodar `pnpm check` antes de abrir o M3.
- **Teste instável** `App.manager.test.tsx` (timeout sob carga), ainda sem tratamento.
- **Documentação:** M0.9b e M0.11 seguem `[ ]` no checklist, embora `fcc1e96` diga que os fecha. Várias notas dizem "sem commit" para itens já commitados.
- **Quadros 06 e 07** existem só no artefato, não no repositório.
- **Plano x código:** o plano diz que desativar Backlog com Sprints ativo é "recusado"; a UI oferece desligar junto (regra 2 do plano). Confirmar, porque afeta o Backlog no M3.

## M3 — decisões do Pedro

Sessão Claude, 2026-11-02. Fonte: quadros 06 (Ferramentas), 07 (Níveis), 08 (Ações), 09 (Backlog) e 10 (Backlog: reordenar, critérios e vazio) do artefato https://claude.ai/artifact/TX9ZfHP66SNXsxH4RftMaQ (versão 1793655846-f733), lidos como dado. Não há quadro chamado "Arquivadas": a lista de tarefas arquivadas não tem desenho. Nenhum código alterado; nenhum commit. `docs/AgileBox 2.0 — Plano de entregas por camadas e marcos.md` não foi editado (mudanças no plano são combinadas antes, CLAUDE.md).

### Decisões registradas

- **B1 (A):** backlog = campos na própria tarefa (`backlogRank`, nulo = fora do backlog; `onBoard`), sem entidade nova. Com o módulo Backlog desligado, tudo volta ao quadro, sem migração de dados: a flag fica gravada e o quadro a ignora.
- **B2 (A):** ordem única por time. Tela em lista única, com chips de filtro por projeto.
- **B3 (A):** gestor reordena; participante edita critérios das suas tarefas.
- **B4 (A):** campo próprio de estimativa em horas, separado de Realizado (ADR-07). Hoje a "estimativa" do M2.11 é a soma das horas por participação; isso muda (M3.13).
- **B5 (A):** critérios no nível Avançado. Já está no registro: `acceptance` com `minLevel: 'advanced'` (`packages/core/src/modules/registry.ts:28`).
- **B6 (A):** estimativa e critérios ficam fora do preset Scrum (o preset atual já não os inclui; falta teste que trave isso).
- **Encerramento:** botão "Concluir encerramento" no quadro 06 (M3.0).
- **Arquivadas:** lista de tarefas arquivadas por projeto antes do M3, com Desarquivar (M3.0b).
- **Regra de desligar, reescrita:** não pode terminar com Sprints ativo sem Backlog; desligar os dois juntos é válido. No M3 o caso equivalente é Aceite sem Backlog (M3.4).
- **Arquivar e renomear projeto:** criador ou gestor (M3.0c). Hoje o servidor usa `canManageMembers` (`archive-project.ts:18`, `rename-project.ts:23`); a UI já usa criador ou gestor (M2.12-fix).

### Pergunta aberta para o M4 (registrada, não decidida)

Sprints passa a depender de estimativa para capacidade? Se sim, a dependência liga `estimates.hours` junto com Sprints, sem quebrar o preset Scrum (B6). Hoje `sprints` exige só `backlog` (`registry.ts:12`). Decidir antes do M4.

### Perguntas que as decisões deixam abertas

- **Q1.** Reordenar gera entrada na linha do tempo? A regra "toda edição gera entrada" pede uma entrada por tarefa movida, ou nenhuma? Afeta M3.5.
- **Q2.** Custo estimado com vários envolvidos: qual valor/hora usar? Afeta M3.3 e M3.7.
- **Q3.** Quem pode "Levar ao Quadro": participante ou só gestor? B3 não diz.
- **Q4.** "Nova tarefa" no Backlog cria a tarefa no backlog ou no quadro? O quadro 09 tem o botão, sem destino definido.
- **Q5.** Aceite "conferido ao concluir" (quadro 06): bloqueia a conclusão, ou só mostra o checklist?
- **Q6.** Lista de arquivadas: em Ajustes, ao lado dos projetos arquivados (suposição usada na M3.0b), ou em outro lugar?
- **Q7.** Concluir encerramento: texto e posição do botão (o quadro 06 não tem o botão).

### Divergências: quadro novo x texto, código e plano

- **D1.** Quadro 06 não tem botão de concluir encerramento; módulo em encerramento só mostra "Sai com Sprints". Resolve M3.0 (desenho em Q7).
- **D2.** Quadro 06 não tem cartão "Estimativa por horas", mas `estimates.hours` existe no registro (`registry.ts:15`). Pendência P5 do M2. Resolve M3.14.
- **D3.** Quadro 06: Sprints diz "capacidade em horas", mas a dependência mostrada é só "Precisa de Backlog". É a pergunta do M4.
- **D4.** Quadro 06: Aceite "conferidos ao concluir" sugere bloqueio na conclusão; o texto da decisão não define (Q5).
- **D5.** Quadro 09: a linha não tem o botão "⋯". O menu "Mover para o topo/fim" aparece só descrito no quadro 10. Decidir se o menu fica na linha ou só o teclado e a alça.
- **D6.** Quadro 09 mostra a coluna "Critérios" para todos, mas B5 põe critérios no Avançado (o quadro 07 também). No Padrão a coluna deveria sumir? Decidir.
- **D7.** Quadro 09: a barra lateral conta Projeto A 3, B 4, C 3; os chips do filtro contam A 3, B 2, C 3. Ou a barra conta outra coisa, ou é erro.
- **D8.** Quadro 09 "40 h estimadas · ≈ R$ 2.600" e quadro 10 "3 h · ≈ R$ 195" implicam cerca de R$ 65/h. O plano (M4) fala em R$ 45/h no seed, o que daria R$ 1.800 para as 40 h. Confirmar a taxa do exemplo e a conta (Q2).
- **D9.** Quadro 10 mostra o aviso com "os 2 participantes veem". Falta o caso de tarefa sem outros participantes, em que não há aviso (decidido).
- **D10.** Não há quadro para tarefas arquivadas. Quadro 08 cobre só o Desfazer de 8 s e diz que projeto arquivado "volta por Ajustes". Resolve M3.0b (desenho em Q6).
- **D11.** Quadro 08 não diz quem arquiva ou renomeia projeto. A decisão agora é criador ou gestor; o servidor ainda usa `canManageMembers` (M3.0c).
- **D12.** ADR-07 aparece como "Decidida" no plano, mas `docs/decisoes/` só tem 0001 a 0004. Registrar em `docs/decisoes/0005-estimativa-em-horas.md` (M3.3).
- **D13.** Código x quadros 09/10: o M2.11 mostra "Estimativa" como soma das horas por participação; o quadro 10 separa Estimativa de Realizado (B4). Corrige M3.13.

### Tarefas M3.0 a M3.14

Um commit por linha. Escopo: "Só core/application/infra" ou "Tela". Pacotes disjuntos podem rodar em paralelo; onde dois itens tocam `create-use-cases.ts` ou `ports/`, rodar em sequência.

| Tarefa | O que faz                                                                                                                                                                                                                                                            | Arquivos prováveis                                                                                                                                                                                                                                                                                                                              | Testes                                                                                                                                     | Escopo                         | Ordem / paralelo                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------- |
| M3.0c  | Arquivar e renomear projeto: criador ou gestor, no caso de uso (hoje `canManageMembers`). Se não existir, criar `canManageProject` em `policies`.                                                                                                                    | `packages/application/src/use-cases/projects/archive-project.ts`, `rename-project.ts`, `projects.test.ts`, `packages/core/src/policies/`                                                                                                                                                                                                        | Criador não-membro consegue; outro colaborador recusado; gestor consegue                                                                   | Só core/application            | Bloco 1. Paralelo com M3.1 a M3.4                                                     |
| M3.1   | Modelo do backlog: `backlogRank` (nulo = fora do backlog) e `onBoard`. Funções puras: mandar ao backlog, levar ao quadro (estado Planejamento), mover ao topo, ao fim e reordenar com ordem contígua.                                                                | `packages/core/src/entities/task.ts`, `packages/core/src/values/backlog-order.ts` (novo), testes ao lado                                                                                                                                                                                                                                        | Ordem contígua após mover; topo e fim; levar ao quadro põe Planejamento e `onBoard`; função pura não muda entrada                          | Só core                        | Bloco 1. Paralelo com M3.2 a M3.4. Bloqueia M3.5                                      |
| M3.2   | Critérios de aceite como valor: texto obrigatório com limite, id, feito ou não, contagem n/m.                                                                                                                                                                        | `packages/core/src/values/acceptance-criteria.ts` (novo)                                                                                                                                                                                                                                                                                        | Texto vazio recusado; contagem; alternar feito                                                                                             | Só core                        | Bloco 1. Paralelo. Bloqueia M3.6                                                      |
| M3.3   | Estimativa em horas separada de Realizado (ADR-07): valor não negativo; custo estimado conforme Q2. Registrar ADR-07 em `docs/decisoes/0005-estimativa-em-horas.md`.                                                                                                 | `packages/core/src/values/hours.ts`, `packages/core/src/rules/` (novo), `entities/task.ts`, `docs/decisoes/0005-*.md`                                                                                                                                                                                                                           | Estimativa não mexe em Realizado; negativo recusado; custo com taxa                                                                        | Só core (+ doc)                | Bloco 1. Paralelo. Campo pode ir antes de Q2; custo, não. Bloqueia M3.7               |
| M3.4   | Dependências do M3: `acceptance` exige `backlog`; desligar Backlog com Aceite ativo desliga os dois juntos; `estimates.hours` fora do Scrum. Sprints entra no M4.                                                                                                    | `packages/core/src/modules/registry.ts`, `presets.ts`, `resolve-module-set.ts`, `impact-preview.ts` e testes                                                                                                                                                                                                                                    | Scrum sem `estimates.hours` e sem `acceptance`; desligar Backlog sozinho recusado ou em cascata; os dois juntos válido; catálogo sem ciclo | Só core                        | Bloco 1. Paralelo com M3.1 a M3.3. Bloqueia M3.5 a M3.7                               |
| M3.5   | Casos de uso do backlog: listar a ordem do time (filtro por projeto; colaborador vê só as suas), reordenar (só gestor, guard `backlog`, marcado Gestor), levar ao quadro (Q3). `listBoard` e `listTeamBoard` escondem tarefas fora do quadro só com o módulo ligado. | `packages/application/src/use-cases/backlog/` (novo), `ports/`, `use-cases/tasks/list-tasks.ts`, `create-use-cases.ts`, fakes                                                                                                                                                                                                                   | Sucesso; colaborador recusado ao reordenar; módulo desligado devolve tudo ao quadro; evento e notificação (Q1)                             | Só application                 | Bloco 2. Depende de M3.1 e M3.4. Sequencial com M3.0b e M3.6 a M3.7 (mesmos arquivos) |
| M3.6   | Casos de uso de critérios: adicionar, renomear, marcar, remover; só participante (criou, responsável ou apoio); gestor marca Gestor; guard `acceptance`.                                                                                                             | `packages/application/src/use-cases/tasks/acceptance.ts` (novo), `ports/`, `create-use-cases.ts`                                                                                                                                                                                                                                                | Participante edita; não participante recusado; módulo desligado recusa; linha do tempo                                                     | Só application                 | Bloco 2. Depende de M3.2 e M3.4                                                       |
| M3.7   | Casos de uso de estimativa: definir horas estimadas; guard `estimates.hours`; mapper de DTO filtra R$ (custo estimado só para quem tem permissão).                                                                                                                   | `packages/application/src/use-cases/tasks/` (estimativa), `mappers/`                                                                                                                                                                                                                                                                            | Colaborador vê só o próprio custo; gestor vê todos; módulo desligado recusa                                                                | Só application                 | Bloco 2. Depende de M3.3 e M3.4                                                       |
| M3.8   | Contrato: schemas Zod e métodos `backlog.*`, critérios e estimativa, com DTOs.                                                                                                                                                                                       | `packages/contract/src/backlog.ts` (novo), `tasks.ts`, `api.ts`, `channels.ts`                                                                                                                                                                                                                                                                  | `api.test.ts`; índice negativo e texto vazio recusados                                                                                     | Só contract                    | Bloco 2. Depende de M3.5 a M3.7 (formas de DTO). Paralelo com M3.9                    |
| M3.9   | Persistência: migração 0005 (`backlog_rank`, `on_board`, `estimated_hours` em tasks; tabela de critérios), mapeadores, adaptador e suíte de contrato.                                                                                                                | `packages/infra-sqlite/src/schema/tasks.ts`, `migrations/0005_*.sql`, `repositories/task-repositories.ts`, `mappers/task-mappers.ts`, `repository-contract.test.ts`                                                                                                                                                                             | Suíte de contrato igual no fake e no SQLite; migração do zero                                                                              | Só infra                       | Bloco 2. Depende de M3.1 a M3.3 e M3.5. Paralelo com M3.8                             |
| M3.10  | IPC dos novos métodos: canais e handlers com validação de entrada.                                                                                                                                                                                                   | `apps/desktop/src/main/ipc/register-handlers.ts`, `channels.ts`, testes de handler                                                                                                                                                                                                                                                              | Entrada inválida recusada; erro de permissão chega ao renderer                                                                             | Tela (IPC do app)              | Bloco 2. Depende de M3.8 e M3.9                                                       |
| M3.0   | Botão "Concluir encerramento" para módulos em `winding_down`, usando `teamModules.finishWindingDown` (já existe no IPC).                                                                                                                                             | `apps/desktop/src/renderer/panel/tools/ToolsView.tsx`, `ToolCard.tsx`, `use-tool-change.ts`, `ToolsView.test.tsx`                                                                                                                                                                                                                               | Botão só nos módulos encerrando; chama `finishWindingDown`; invalida `teamModules.capabilities`; colaborador não vê                        | Tela                           | Pode começar já (pré-M3). Não em paralelo com M3.14                                   |
| M3.0b  | Lista de tarefas arquivadas por projeto, com Desarquivar, em Ajustes (Q6). Falta de IPC: caso de uso de listagem de arquivadas (hoje só há arquivar e desarquivar), porta e adaptador, contrato `tasks.listArchived` e handler. Desarquivar usa `tasks.unarchive`.   | `packages/application/src/use-cases/tasks/`, `ports/`, `packages/contract/src/tasks.ts`, `api.ts`, `packages/infra-sqlite/src/repositories/task-repositories.ts`, `apps/desktop/src/main/ipc/register-handlers.ts`, `apps/desktop/src/renderer/panel/settings/ArchivedTasksSection.tsx` (novo), `use-archived-tasks.ts`, `shared/query/keys.ts` | Agrupa por projeto; estado vazio; desarquivar tira da lista e a tarefa volta ao quadro; colaborador vê só as suas                          | Tela (com application e infra) | Pode começar já. Não em paralelo com M3.5 a M3.7 (portas)                             |
| M3.11  | Tela Backlog: item na barra lateral (Padrão ou acima, com módulo ligado); lista única; chips por projeto; linha com título, projeto, estimativa, critérios n/m, responsável e "Levar ao Quadro"; estado vazio de uma frase; "Nova tarefa" (Q4).                      | `apps/desktop/src/renderer/panel/backlog/` (novo), `layout/` (barra lateral), `shared/query/keys.ts`                                                                                                                                                                                                                                            | `role=list` e `listitem`; filtro; vazio; Essencial não vê o item                                                                           | Tela                           | Bloco 3. Depende de M3.10. Paralelo com M3.13 e M3.14                                 |
| M3.12  | Reordenar: alça arrastável, Alt+↑/↓ com linha em foco, menu "⋯" topo/fim (D5), aviso de escopo e Desfazer de 8 s só com outros participantes; participante vê cadeado.                                                                                               | `apps/desktop/src/renderer/panel/backlog/` (`BacklogRow`, hook de reordenação)                                                                                                                                                                                                                                                                  | Alt+seta chama reordenar; menu; cadeado; aviso só com participantes; desfazer restaura                                                     | Tela                           | Bloco 3. Depende de M3.11                                                             |
| M3.13  | Detalhe: checklist de critérios editável pelo participante (Avançado); campo Estimativa em horas separado de Realizado; custo estimado só com permissão; Padrão não mostra critérios.                                                                                | `apps/desktop/src/renderer/panel/task-detail/`                                                                                                                                                                                                                                                                                                  | Checklist editável; Estimativa não altera Realizado; custo com permissão; Padrão sem critérios                                             | Tela                           | Bloco 3. Depende de M3.10. Paralelo com M3.11 e M3.14                                 |
| M3.14  | Ferramentas: cartão "Estimativa por horas" (`estimates.hours`) e textos ajustados (D2, P5).                                                                                                                                                                          | `apps/desktop/src/renderer/panel/tools/ToolCard.tsx`, `tool-descriptions.ts`, testes                                                                                                                                                                                                                                                            | Cartão aparece; `estimates.points` continua escondido                                                                                      | Tela                           | Bloco 3. Depende de M3.4. Não em paralelo com M3.0                                    |

**Caminho crítico:** M3.1 e M3.4 → M3.5 → M3.8 e M3.9 → M3.10 → M3.11 → M3.12. Os itens M3.0, M3.0b e M3.0c não dependem do backlog e podem andar em paralelo com o bloco 1.

**Riscos registrados:** M3.5 e M3.0b tocam as mesmas portas e `create-use-cases.ts`, por isso sequenciais. M3.9 fecha a migração 0005; se Q1 ou Q2 mudarem o modelo, M3.9 espera.

**Status M3.0 (botão "Concluir encerramento"):** feito. Botão no cartão de módulo `winding_down` (Q7 recomendado), nome acessível "Concluir encerramento de <ferramenta>", alvo 44px, só gestor. Chama `teamModules.finishWindingDown` pelo hook `useFinishWindingDown`; no sucesso invalida `teamModules.capabilities` e `teamModules.impactAll`, e o GlassToast "Encerramento concluído: <ferramenta>." sai depois da releitura. Falha: `role="alert"` com a razão do servidor. Durante o envio o botão, os interruptores, os presets e o Cancelar ficam travados. 5 testes novos em `ToolsView.test.tsx`. Pendente: confirmar Q7 (texto e posição).

**Status M3.0c (política de projeto):** feito. `canArchiveProject` (arquivar e desarquivar) e `canRenameProject` no core, ambas gestor ou criador (decisão confirmada, D11 resolvida no servidor). `canManageMembers` ficou só para membros. `RenameProject` recusa nome de outro projeto ativo (ignora o próprio e os arquivados) com `ValidationError`. Pendente: `CreateProject` reaproveita o projeto existente em vez de recusar; alinhar ou manter é decisão do Pedro.

**Status M3.1 (modelo do backlog, só core):** feito. `Task` ganha `backlogRank: number | null` (nulo = fora do backlog) e `onBoard: boolean`, com `onBoard === (backlogRank === null)`. `createTask` nasce no quadro. Ordem em `values/backlog-order.ts`: ranks inteiros contíguos 1..n renumerados a cada movimento (`nextBacklogRank`, `moveInBacklog`, `orderedBacklog`, `isVisibleOnBoard`); mover devolve só as alterações `{id, backlogRank}`. Transições: `sendToBacklog`, `takeToBoard` (vai a Planejamento), `setBacklogRank`. Política `canReorderBacklog` = gestor (B3 A). Módulo `disabled` devolve tudo ao quadro; `winding_down` mantém o backlog fora do quadro. Perguntas abertas: Q1 (reordenar gera linha do tempo?), Q3 (quem leva ao quadro; o core não restringe), Q-a (devolver ao backlog uma tarefa em andamento mantém o estado?), Q-b (confirmar o comportamento em `winding_down`).

**Status M3.0-fix (foco e travas):** feito. Durante o envio o botão usa `aria-disabled` com bloqueio no handler (o foco fica nele); ao concluir, o foco vai para o cabeçalho da prévia. O teste de envio duplo mostrou que a guarda `if (busy)` não bastava (estado velho no segundo clique): trava síncrona em ref (`sending`). O cartão recebe `busy` (aplicando ou concluindo). Aplicar e Cancelar limpam o alerta antigo de encerramento. `tools` 86/86.

**Status M3.0c-fix (colisão de nome de projeto):** feito. `UnarchiveProject` checa `findActiveByNameKey` dentro da transação e recusa com "Já existe um projeto com este nome". Novo `findActiveByNameKey` na porta, no SQLite (`archived_at IS NULL`) e no fake, que agora impõe a unicidade de nome ativo como o índice parcial. O `save` do SQLite mapeia a violação `UNIQUE` de `projects.name_key` para `ValidationError` (cobre a corrida). `RenameProject` e `CreateProject` usam a consulta de ativos (o `CreateProject` reaproveitava arquivado: mesmo defeito). JSDoc em `canRenameProject`. Testes mistos arquivado + ativo; contrato em memória e SQLite. 240 testes nos pacotes tocados. `findByNameKey` ficou na porta só para o contrato; pode ser removido.

**Status M3.1b (mapper com defaults):** feito. `mapTaskRow` lê `backlogRank: null` e `onBoard: true` fixos até a persistência da M3.9 (migração 0005); teste em `task-mappers.test.ts`.

**Status M3.2 (critérios de aceite, só core):** feito. `values/acceptance-criteria.ts`: `AcceptanceCriterion {id, text, done}`, ordem = posição na lista; funções puras `addCriterion`, `editCriterionText`, `setCriterionDone` (valor explícito), `removeCriterion`, `reorderCriterion`, `acceptanceSummary` ({done, total, allDone}). Texto: trim, obrigatório, até 200 pontos de código, sem caracteres invisíveis/controle/quebras; as operações recusam lista com id repetido. `canEditAcceptance` = `canEditTask` (B3 A). Q5: o resumo não bloqueia a conclusão; só expõe `allDone` (lista vazia = falso). Pendente do Pedro: limite de 200 caracteres e Q5. Nota: `addCriterion` ainda não recusa lista de entrada com id repetido.

**Status M3.3 (estimativa em horas, só core + ADR 0005):** feito. `Task.estimatedHours` em centésimos de hora (nulo = sem estimativa, separado das horas por participação; 0 a 100000 = 1000 h; `-0` normalizado), `setEstimatedHours`, `canEditEstimate` = `canEditTask`. Custo estimado (`rules/estimate-cost.ts`): estimativa dividida em partes iguais entre TODOS os envolvidos (usuários e entidades), cada parcela com o valor/hora do próprio envolvido, então lançar horas não muda o estimado (corrige o bloqueante da revisão); sem envolvidos = nulo. Visibilidade: gestor vê tudo; colaborador só a própria parcela e nunca lê o valor/hora de outro. A soma das parcelas arredondadas pode divergir em até n/2 centavos: a tela soma as parcelas. Q2 decidida pela recomendação, pendente de confirmação do Pedro. Para a M3.9: coluna `estimated_hours` (inteiro, nulo) e leitura/escrita no mapper (hoje `estimatedHours: null` fixo); tarefas existentes ficam `null`. Para a M3.6/M3.7: garantir a marcação "Gestor" na linha do tempo nas edições de estimativa e critérios.

**Status M3.4 (dependências de módulos):** feito, sem código de produção novo (o registro já estava conforme): Aceite exige Backlog e fica no Avançado; Scrum do time sem estimativa e critérios; Completo com os dois; desligar Backlog sozinho com Sprints/Aceite ativo é recusado com a razão; desligar os dois juntos é válido (invariante exaustiva sobre 64 combinações); `sprints` exige só `backlog` (pergunta do M4 sobre estimativa para capacidade segue aberta). Plano reescrito nas passagens da regra 2 e do caso de teste. Atenção: a linha da tabela M3.4 acima ainda diz "desliga os dois juntos" ao desligar Backlog com Aceite; vale a regra reescrita.

**Status M3.0b (tarefas arquivadas em Ajustes):** feito. Porta `TaskRepository.listArchived(organizationId)` (fake, SQLite, contrato em memória e SQLite), `ListArchivedTasks` (gestor vê todas; colaborador só as em que participa), canal `tasks.listArchived`, seção "Tarefas arquivadas" em Ajustes agrupada por projeto com "Desarquivar tarefa <título>". Correções da revisão: foco vai ao item seguinte/anterior/título; `aria-disabled` durante o envio; estado por tarefa num Set com erro por item; `role="region"` com `aria-labelledby` nas seções de tarefas e projetos arquivados; "Desarquivando…"; erro de refetch mantém a lista antiga. Pendências do Pedro: a regra usa "participa" e não `canViewTask`; desarquivar tarefa de projeto arquivado a traz ao quadro "todos os projetos"; sem paginação (N+1 em participações); o padrão `aria-label` em `GlassSurface` sobrevive em Aparência, nível do time e atualizações.

**Status M3.9 (persistência, migração 0005):** feito (`e3f35e7`). Só `ALTER TABLE ADD` em `tasks` (`backlog_rank` nulo, `on_board` padrão verdadeiro, `estimated_hours` nulo) e tabela `task_criteria` (índice único `task_id`+`position`, posição a partir de 0, troca da lista inteira em transação). `listBacklog` exclui arquivadas; `saveBacklogRanks` grava o lote atomicamente e ignora ids de outra organização. Invariante `onBoard === (backlogRank === null)` checado na leitura e na escrita. Revisão sem bloqueantes. Opcionais anotados: o fake em memória não aplica o invariante no `save`; o comentário de `task-criteria.ts` sobre apagar tarefa está impreciso (a FK falha, não deixa órfãos); a regra de editar critérios de tarefa arquivada fica no caso de uso; sem índice em (`organization_id`, `backlog_rank`); N+1 herdado em participações.

**Status M3.1c (eventos de backlog):** feito. Tipos `moved_to_board` ("levou a tarefa ao quadro") e `sent_to_backlog` ("devolveu a tarefa ao backlog") no core e no `z.enum` do contrato; sem valores em R$; marcação Gestor como nos demais. Reordenar não gera evento. `task_events.type` é texto livre, sem mudança na persistência.

**Status M3.5 (casos de uso do backlog) + M3.5-fix:** feito. `ListBacklog`, `ReorderBacklog` (só gestor, lote atômico, grava só as posições alteradas), `TakeToBoard` e `SendToBacklog` (`canEditTask`, gestor incluso — Q3), `CreateTask` com `inBacklog` (nasce no fim do backlog em Planejamento — Q4/Q7). `ctx`/`assertTenant` primeiro, guard de módulo (encerrando opera; desativado recusa citando o nome "Backlog"). Quadro, fluxo e Equipe escondem tarefas fora do quadro quando o Backlog está ativo ou encerrando; com o módulo desligado ou nunca gravado nada some. Correções da revisão: desarquivar uma tarefa do backlog a recoloca no fim (sem rank repetido; `ChangeTask` agora lê, transforma e grava na mesma transação); o dashboard usa a mesma visibilidade do quadro; `takeToBoard`/`sendToBacklog` geram os eventos novos com Gestor; id de outro time ou inexistente = NotFoundError. Decisões: Q1 reordenar sem evento; Q-a devolver mantém o estado. Pendências: busca, recentes e frequentes ainda mostram tarefas do backlog; `quadroSimples` inclui Backlog, então o caso "preset sem Backlog" foi modelado como time só com núcleo e agenda; leitura do estado do módulo dentro da transação só é segura enquanto o SQLite é síncrono. Contrato (`inBacklog`, `backlogRank`, `onBoard` no DTO) é a M3.8.

**Status M3.13 (critérios e estimativa no detalhe) e M3.14 (Ferramentas):** feitos (`18250e1`, `3c04546`). Detalhe: checklist de critérios (adicionar, editar, marcar, remover, ↑/↓), texto sempre como texto; "Estimativa (h)" separada de "Realizado"; custo estimado/realizado só quando o DTO traz; "Total" e "Custo realizado" mostram o mesmo número ao gestor (remover um). Ferramentas: destinos na prévia ("Tarefas do backlog voltam ao quadro. Nada é apagado.") e descrições dos presets (Scrum sem estimativa e critérios; Completo com os dois). Validados por pasta; revisão de acessibilidade não concluída (limite de uso).

**Status M3.11/M3.12 (tela Backlog):** feito. Item Backlog na barra lateral abre a tela; lista única do time com chips por projeto; "Levar ao Quadro" (`canEditTask`); "Nova tarefa" no fim do backlog (`inBacklog`); estado vazio; erro em `role=alert`; Desfazer em cada movimento. Alça, Alt+↑/↓ e menu "⋯" (topo/fim) só para o gestor, com anúncio em `role=status` e foco na linha movida; a regra real é do servidor. `UndoOffer.message` passou a `ReactNode`. `pnpm check` completo verde (171 arquivos, 1870 testes).

## Fechamento do M3 — Pendências do Pedro (modo finalizar)

Nada abaixo bloqueia o uso; ajustar depois.

- **Visual:** conferir a tela Backlog contra os quadros 09 e 10 (grade de 920 px, chips, rodapé, menu "⋯") — o agente não tinha o Artifact. Conferir também M3.13 contra o quadro 10 e a barra lateral (D7: contadores não batem com os chips).
- **Electron real:** nada do M2/M3 rodou no app instalado: arraste pela alça, foco após Alt+↑/↓, foco dos menus; Playwright segue adiado (M4–M6).
- **Decisões abertas:** Q2 (custo estimado dividido em partes iguais entre todos os envolvidos), Q3 (levar ao quadro = `canEditTask`), Q5 (aceite não bloqueia concluir), limite de 200 caracteres do critério, teto de 1000 h, valor/hora do quadro (D8: ≈R$65/h contra seed de R$45/h), aceite por maioria e ADR-08/09 antes do M4.
- **M4:** Sprints passa a depender de estimativa para capacidade? Hoje exige só Backlog.
- **Pendências técnicas:** busca, recentes e frequentes ainda mostram tarefas do backlog; o IPC não valida a saída; DTO traz estimativa/custo/critérios mesmo com o módulo desligado; teste dedicado de "módulo Backlog desligado, tela e item somem"; `findByNameKey` sem uso em produção; fake em memória não aplica o invariante de backlog no `save`; `PRESET_LABELS` do core com descrição antiga; leitura do estado do módulo dentro da transação só vale com SQLite síncrono; N+1 em participações e critérios; sem paginação em arquivadas.
- **Decisões M0–M2 ainda pendentes:** `CreateProject` reaproveita o projeto existente em vez de recusar; `ProjectDto` sem `archivedAt`; tarefa de projeto arquivado volta ao quadro "todos os projetos"; D10 (laço do Codex lendo o `PROGRESS_2.md`); `aria-label` em `GlassSurface` em Aparência, nível do time e atualizações.

**Status M3-fix-telas (revisão das telas do M3):** feito. Foco ao "Levar ao Quadro" vai à alça da próxima linha (senão à anterior, senão ao estado vazio; para colaborador, sem alça, ao "Levar ao Quadro" da linha seguinte); o dnd-kit tem instruções e anúncios em pt-BR e honestos (ponteiro, Alt+setas, menu); chips do filtro e campos numéricos com 44 px (testados por leitura do CSS; plugin `rawCssPlugin` também no projeto `desktop-renderer`); Alt+seta ignorado durante reordenação em andamento; "Adicionar critério" sem duplo envio; editar critérios invalida o "n/m" do backlog. `pnpm check` completo verde com carga baixa (173 arquivos, 1882 testes). Atenção: rodar dois `pnpm check` ao mesmo tempo estoura o tempo de testes de interface (carga ~18 em 8 núcleos); rodar um por vez. Pendências do Pedro: conferir no Electron o foco após "Levar ao Quadro" e o visual dos chips de 44 px; desfazer da reordenação usa posição absoluta; "Total" recalculado no cliente pode divergir de "Custo realizado" até gravar; Enter em critério/estimativa tira o foco do campo; mover/remover/adicionar critério sem anúncio em texto; backlog faz uma consulta por linha.

## M4 · Preparação e bloco 1 (valor/hora) — sessão Claude, 2026-11-03

### Decisões do Pedro (2026-11-03)

- **Q2:** estimativa por responsável; custo = Σ (horas × valor/hora de cada um). Substitui a divisão igual (ADR 0005, seção "Revisão de 2026-11-03"). Migração preserva o total; sobra de centésimos vai ao primeiro responsável; tarefas com estimativa e sem responsável guardam o valor em `tasks.estimated_hours_legacy`.
- **Q3:** manter `canEditTask`; pertencimento à equipe entra no M4b.
- **Q5:** aceite pendente não bloqueia concluir; selo "aceite pendente" e filtro no Backlog.
- **Valor/hora:** R$ 45,00 padrão da organização; valor individual do usuário opcional (`null` usa o padrão). Entidades (`Contributor`) seguem com valor obrigatório.
- **Limites** de 200 caracteres no critério e 1000 h por participação: aprovados.
- **Sprint sem estimativa:** permitida, conta 0 h com aviso.
- **ADR-08 revisto:** uma sprint ativa por equipe; mini-equipes; capacidade por porcentagem por equipe (soma até 100%, acima recusada; uma equipe só = 100%); M4a (equipe padrão) e M4b (gestão de equipes). **ADR-09:** Fastify + LISTEN/NOTIFY + SSE. Texto em `docs/AgileBox 2.0 — Plano de entregas por camadas e marcos.md`.
- **Encerramento da sprint (proposta, aguarda aprovação):** por item aberto, voltar ao backlog (padrão) ou ir à próxima sprint `draft` da mesma equipe.

### Andamento (agentes haiku, revisão do Claude)

- [x] **M4.1 core:** `User.defaultRateCents: number | null`, `Organization.defaultRateCents` (4500), `effectiveRate`. 562 testes do core passam.
- [x] **M4.2 infra-sqlite:** migração 0006 (`organizations.default_rate_cents`, `users.default_rate_cents` anulável), mapper, teste `migration-0006.test.ts`. `createSqliteClient` desliga `foreign_keys` em volta do `migrate` (ADR 0006). 56 testes do pacote passam.
- [ ] **M4.3 application + contract:** o typecheck está **quebrado de propósito** em `application/src/mappers/index.ts:54`, `use-cases/participations/participations.ts:184`, `use-cases/tasks/tasks.ts:95` e `:114`. `set-default-rate` aceita `null`; caso de uso do gestor para o padrão da organização; DTO; seed sem 4500 fixo.
- [ ] **M4.4 desktop:** campo "Valor/hora" em Ajustes, placeholder "Padrão R$ 45,00".
- [ ] **Bloco 2 (estimativa por responsável), depois do 1:** 5 core (`Participation.estimatedHoursHundredths`, soma derivada, 1000 h por participação); 6 core (`estimate-cost.ts` vira Σ horas × taxa); 7 infra, migração 0007 com divisão e `estimated_hours_legacy` (**sonnet**); 8 application/contract/desktop.
- [ ] **Bloco 3 (aceite pendente):** 9 core+application (regra e filtro); 10 desktop (selo e chip de 44 px). Independente do bloco 1.
- [ ] **Bloco 4 (M4a):** 11 `Sprint` e regra de uma ativa por equipe (**sonnet**); 12 capacidade e aviso de tarefas sem estimativa; 13 migração 0008 (`teams`, `team_members`, `sprints`, `sprint_tasks`, equipe padrão a 100%); 14 casos de uso e encerramento (**sonnet**); 15 contract e telas.
- [ ] **M4b:** `Team`/`TeamMember`, módulos por equipe, `canEditTask` por equipe, tela de equipes.

Regras da orquestração: uma tarefa por vez (dois `pnpm check` simultâneos estouram o tempo dos testes de interface); agentes não fazem commit nem instalam nada; o Claude revisa cada entrega (diff no escopo, teste novo, typecheck) antes de despachar a seguinte; `pnpm check` completo só quando a M4.3 fechar.

### Pendências do Pedro

- Aprovar a política de encerramento da sprint acima.
- Rodar a consulta do ADR 0005 no banco do app instalado para contar tarefas com estimativa e sem responsável, **antes** da migração 0007 (não havia `sqlite3` no ambiente do Claude).
- Confirmar se `Contributor` (entidade) deve ter valor/hora opcional também; hoje não tem.
- Conferir o ADR 0006 (chaves estrangeiras desligadas durante `migrate`).
