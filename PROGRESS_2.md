# Progresso

Plano: `docs/AgileBox 2.0 — Plano de entregas por camadas e marcos.md` (linha M0). Regras do laço: ver prompt do orquestrador.

## M0 · Estabilizar o MVP

Pronto quando: criar, editar, mover e reabrir persistem; nenhuma tela estática.

- [x] M0.1 Definir a semântica de "Minhas tarefas" do gestor (decisão aberta; registrar em `docs/decisoes/`) — teste: nenhum, só o ADR — decidido: opção A (ADR 0004)
- [x] M0.2 Caso de uso `listTasks` com escopo `mine|team` respeitando a regra de acesso — teste: `task-lists.test.ts` (colaborador em `team` só vê as suas; gestor vê todas) — sonnet
- [x] M0.3 Contrato Zod do escopo `mine|team` em `packages/contract/src/tasks.ts` — teste: `tasks.test.ts` — haiku
- [ ] M0.4 Conectar o seletor "Minhas tarefas | Equipe" no painel ao escopo — teste: Testing Library, trocar o seletor refaz a listagem — haiku
- [ ] M0.5 Campo `archivedAt` em tarefa e projeto (core + migração + mapper) — teste: `repository-contract.test.ts` — sonnet
- [ ] M0.6 Casos de uso `archiveTask`/`unarchiveTask` com entrada na linha do tempo (marca Gestor) — teste: `tasks.test.ts` — sonnet
- [ ] M0.7 Casos de uso `archiveProject`/`unarchiveProject`; listas ocultam arquivados por padrão — teste: `projects.test.ts` — sonnet
- [ ] M0.8 Caso de uso `renameProject` com permissão e linha do tempo — teste: `projects.test.ts` — sonnet
- [ ] M0.9 Botões Arquivar/Renomear na UI do painel, com ação desfazer — teste: Testing Library — haiku
- [ ] M0.10 Teste de persistência: criar, editar, mover e reabrir tarefa após reiniciar o banco — teste: `create-sqlite-adapters.test.ts` — haiku
- [ ] M0.11 Varredura: nenhuma tela/controle estático no painel (lista de pendências) — teste: `pnpm check` verde — sonnet

BLOQUEIO: (vazio)
