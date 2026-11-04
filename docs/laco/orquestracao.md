# Orquestração

> **Decisões recomendadas já adotadas**
> - **D3:** sim, reabrir o estado Bloqueado (B2).
> - **D5:** manter SVG próprio (sem biblioteca de ícones).
> - **D6:** eventos sem duração valem 1h até o B9.
> - **D7:** atalhos de uma letra são aceitos.
>
> **Regras**
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

- B1: ID legível (AB-118). core feito; faltam infra-sqlite, application/contract e UI.

## Concluído

_Nenhum item concluído ainda._

## Bloqueios

- B1 (fora do core, para as próximas camadas): `Task` ganhou `number` e `Organization` ganhou `taskPrefix`. Quebrados até ajuste:
  - `packages/application/src/testing/builders.ts` (linha 120) e `packages/application/src/use-cases/tasks/tasks.ts` (linha 62): `createTask` sem `number`. Precisa gerar a sequência por organização.
  - `packages/infra-sqlite/src/mappers/task-mappers.ts` (linha 44): falta `number` no mapeamento; coluna e migração de `number` e `task_prefix` ainda não existem.
  - Testes de `application` e `infra-sqlite` (53 falhas no `vitest` da raiz): fábricas e seeds sem `number`/`taskPrefix`, e o contrato de repositórios.
  - `apps/desktop`: 2 erros de tipo que vêm da cadeia acima (não investigado separadamente).
  - Core: `pnpm test`, `pnpm lint` e `pnpm typecheck` do pacote passam (367 testes).
