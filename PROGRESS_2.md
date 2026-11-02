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
