# Orquestração

> **Decisões recomendadas já adotadas**
>
> - **D3:** sim, reabrir o estado Bloqueado (B2).
> - **D5:** manter SVG próprio (sem biblioteca de ícones).
> - **D6:** eventos sem duração valem 1h até o B9.
> - **D7:** atalhos de uma letra são aceitos.
>
> **Regras**
>
> - `pnpm check` precisa estar verde ao fim de cada item.
> - Sem `pnpm install` (o Pedro roda instalação).
> - Commit e push autorizados pelo Pedro na branch `codex/m1-m4`. Sem `--force`.
> - Não incluir `apps/desktop/electron-builder.yml`, `package.json` e `pnpm-lock.yaml` antigos nos commits.

## Backlog

Fase B (detalhes na seção 2 de `design/design_two/agilebox-redesign-v2/docs/REDESIGN-v2-ESCOPO.md`):

- [ ] B10: retro com combinados
- [ ] B11: exportar resumo do dashboard

Fase C:

- [ ] Visão Equipe
- [ ] Daily assíncrona na bandeja
- [ ] Plug-ins (commits vinculados e aviso de atualização)

Final:

- [ ] Relatório final em `docs/laco/relatorio-final.md`

## Em andamento

- B6: definição de pronto (itens por projeto em `definition_of_done_items`, com conferência ao concluir a tarefa). Backend feito; falta UI (conferência ao concluir no detalhe/arrastar/bandeja, edição da DoD no diálogo do projeto).

## Concluído

- B1: ID legível (AB-118). B1 completo: core, persistência, aplicação, UI.
- B3: prioridade (normal | alta). B3 completo: backend e UI.
- B2: bloqueio com motivo (marca na tarefa, não sexto estado). B2 completo: backend e UI.
- B5: subtarefas (tabela `task_checklist_items`). B5 completo: backend e UI.
- B7: comentários e menções (tabela `task_comments`; menções sem aviso no MVP). B7 completo: backend e UI.
- B4: limite de WIP por coluna (medidor no cabeçalho de Desenvolvendo e Revisar, edição pelo gestor, exceção no dashboard). B4 completo: backend e UI.
- B9: agenda com hora de fim, tipo (reunião, revisão, retro) e repetição semanal; só o gestor cria e edita agendamentos. Decisão D6: sem fim, o evento vale 1h. B9 completo: backend e UI.

## Bloqueios

- B6, pendência de ambiente: a migração `0008_definition_of_done.sql` (tabela `definition_of_done_items`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Gerada pelo `drizzle-kit generate` (só cria tabela e índice, sem recriar as existentes).
- B9, pendência de ambiente: a migração `0007_meeting_fields.sql` (colunas `meetings.end_time`, `kind`, `recurrence` e `recurrence_until`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Gerada pelo `drizzle-kit generate` e reescrita à mão com `ALTER TABLE ... ADD`, sem recriar `meetings`, porque o gerado recriava a tabela.
- B4, pendência de ambiente: as migrações `0005_task_comments.sql` (B7) e `0006_board_settings.sql` (tabela `board_settings`, B4) ainda não foram aplicadas num banco real (`pnpm db:migrate`). A `0006` foi gerada pelo `drizzle-kit generate`, e o SQL conferido só cria a tabela e o índice único.
- B7, pendência de ambiente: a migração `0005_task_comments.sql` (tabela `task_comments`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Gerada pelo `drizzle-kit generate` (só cria tabela e índice, sem recriar as existentes).
- B5, pendência de ambiente: a migração `0004_familiar_zeigeist.sql` (tabela `task_checklist_items`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Gerada pelo `drizzle-kit generate` (só cria tabela, sem recriar as existentes).
- B2, pendência de ambiente: a migração `0003_flippant_infant_terrible.sql` (colunas `tasks.blocked_reason` e `tasks.blocked_at`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Escrita à mão com `ALTER`, como a 0002.
- B3, pendência de ambiente: a migração `0002_funny_rictor.sql` (coluna `tasks.priority`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Escrita à mão com `ALTER` (sem recriar a tabela), como a 0001.
- B1, pendência de ambiente: a migração `0001_gorgeous_bill_hollister.sql` ainda não foi aplicada num banco real (`pnpm db:migrate` sobre `.data/agilebox.db`). Vale rodar uma vez antes de subir o app.
  - Feito nesta etapa: migração `0001_gorgeous_bill_hollister.sql` escrita à mão (`ALTER` + backfill por organização em ordem de `created_at`, depois índice único em `(organization_id, number)`). Não usa recriação de tabela, para não depender de `PRAGMA foreign_keys` dentro da transação do migrador.
  - Decisão: `TaskRepository.nextNumber` (MAX+1) é chamado dentro da mesma transação do `CreateTask`. A tarefa passou a ser montada dentro de `unitOfWork.run`.
  - Decisão: `OrganizationRepository` (porta nova) fornece o `taskPrefix` para o DTO. O `key` é montado em `toTaskDto(task, taskPrefix)` com `formatTaskKey`.
  - Limite: o `drizzle-kit generate` só rodou para gerar o snapshot. Como não foi possível apagar o 0001 gerado automaticamente, o SQL foi substituído por edição. O snapshot continua coerente com o schema.
  - Resultado: `pnpm check` verde (121 arquivos, 987 testes).

## Pendências do Pedro

- B7, decisão de produto: comentários contam como "mudança/edição" nas regras "mudanças desde ontem" e "última edição por pessoa" do dashboard (`core/rules/recent-changes.ts`). Mantido como está por ser coerente com "toda edição gera entrada na linha do tempo". Se não for o desejado, ajustar essas duas regras para ignorar `comment_added` e `comment_removed`.
- B7, dado não exposto: o criador da tarefa não aparece no detalhe (`GetTaskDto` traz só participações). As sugestões de `@` usam responsável e apoio (participantes-usuários). Se o criador precisar ser mencionável, o DTO do detalhe precisa de `createdBy`.
