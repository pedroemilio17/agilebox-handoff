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

- [ ] B3: prioridade
- [ ] B2: bloqueio com motivo (reabre o estado Bloqueado)
- [ ] B5: subtarefas
- [ ] B7: comentários e menções
- [ ] B4: limite de WIP por coluna
- [ ] B9: agenda com fim, tipo e recorrência
- [ ] B6: definição de pronto
- [ ] B10: retro com combinados
- [ ] B11: exportar resumo do dashboard

Fase C:

- [ ] Visão Equipe
- [ ] Daily assíncrona na bandeja
- [ ] Plug-ins (commits vinculados e aviso de atualização)

Final:

- [ ] Relatório final em `docs/laco/relatorio-final.md`

## Em andamento

- B3: backend feito; falta UI (card, detalhe, bandeja, filtro).

## Concluído

- B1: ID legível (AB-118). B1 completo: core, persistência, aplicação, UI.

## Bloqueios

- B3, pendência de ambiente: a migração `0002_funny_rictor.sql` (coluna `tasks.priority`) ainda não foi aplicada num banco real (`pnpm db:migrate`). Escrita à mão com `ALTER` (sem recriar a tabela), como a 0001.
- B1, pendência de ambiente: a migração `0001_gorgeous_bill_hollister.sql` ainda não foi aplicada num banco real (`pnpm db:migrate` sobre `.data/agilebox.db`). Vale rodar uma vez antes de subir o app.
  - Feito nesta etapa: migração `0001_gorgeous_bill_hollister.sql` escrita à mão (`ALTER` + backfill por organização em ordem de `created_at`, depois índice único em `(organization_id, number)`). Não usa recriação de tabela, para não depender de `PRAGMA foreign_keys` dentro da transação do migrador.
  - Decisão: `TaskRepository.nextNumber` (MAX+1) é chamado dentro da mesma transação do `CreateTask`. A tarefa passou a ser montada dentro de `unitOfWork.run`.
  - Decisão: `OrganizationRepository` (porta nova) fornece o `taskPrefix` para o DTO. O `key` é montado em `toTaskDto(task, taskPrefix)` com `formatTaskKey`.
  - Limite: o `drizzle-kit generate` só rodou para gerar o snapshot. Como não foi possível apagar o 0001 gerado automaticamente, o SQL foi substituído por edição. O snapshot continua coerente com o schema.
  - Resultado: `pnpm check` verde (121 arquivos, 987 testes).
