# Redesign v2: escopo, fases e decisões

O protótipo `design/v2/` mostra o produto completo. **Nem tudo nele cabe no MVP** e algumas partes
contrariam decisões já registradas no `docs/MVP.md`. Este arquivo separa o que dá para fazer agora do
que precisa de decisão do Pedro antes.

Regra para quem implementa: **não implemente a fase B nem a C sem o Pedro confirmar** cada item da
seção 4. O `CLAUDE.md` continua valendo (explicar antes, passos pequenos, `pnpm check`).

## 1. Fase A · Visual + dados que já existem (sem migração de banco)

Pode começar depois de aprovado o ADR 0004.

| # | Entrega | Onde | Observação |
| --- | --- | --- | --- |
| A1 | Tokens v2 + fontes empacotadas | `packages/ui/src/styles/tokens.css`, `@fontsource-variable/{geist,geist-mono,bricolage-grotesque}` | Substituir pelo `tokens-v2.css`. Nomes atuais mantidos: `tokens.test.ts` segue passando. Trocar `@fontsource-variable/inter`. |
| A2 | Ajuste dos componentes base | `packages/ui/src/components/*` | Tabela 3.1 do HANDOFF-v2. Atenção ao `Button` primário: texto escuro (`--color-on-primary`). |
| A3 | Componentes novos sem dado novo | `Kbd`, `SignalBadge`, `ProjectSwatch`, `Eyebrow`, `Drawer`, `MetricTile`, `Sparkline`, `BarChart`, `WipMeter` | Com testes no padrão do pacote. Adicionar à `dev/Gallery.tsx`. |
| A4 | Barra lateral 232 px com rótulos e lista de projetos | `panel/layout/PanelShell.tsx` | Dados: `projects.list()`. |
| A5 | Quadro: cabeçalho, filtros, `TaskCard` novo, "+" por coluna | `panel/board/*` | Filtros "Paradas" e "Vencidas" (regras em A9). Sem prioridade, bloqueio, subtarefas e WIP. |
| A6 | Detalhe em painel lateral | `panel/task-detail/*` | Mesmos dados e regras; muda o layout. Agrupar eventos seguidos na linha do tempo (só apresentação). |
| A7 | Dashboard por exceções e fluxo | `panel/dashboard/*` + `core/rules/flow.ts` | Exige atualizar o PLANO 6.5 (ver decisão D1). |
| A8 | Agenda semanal + prazos de tarefas | `panel/agenda/*` | Eventos sem duração aparecem com 1 h (ver D6). Mensal continua como opção. |
| A9 | Regras novas, todas derivadas de `tasks` e `task_events` | `packages/core/src/rules/` | `stale.ts` (parada), `flow.ts` (ciclo, lead time, vazão, "quadro em dia"), `recent-changes.ts`. Funções puras com testes. |
| A10 | Paleta `Ctrl K` e interpretador | `core/rules/quick-add-parser.ts`, componente na `ui` | `@pessoa`, `#projeto`, datas em pt-BR. Sem `!prioridade`. |
| A11 | Bandeja v2 (visual) | `tray/*` | Saudação, cartões, campo com interpretador. **Sem** o cartão de daily. |

### Regras derivadas propostas (A9), para o Pedro confirmar os números

- **Parada**: tarefa em Desenvolvendo ou Revisar sem evento `status_changed` há **mais de 4 dias** de calendário.
- **Tempo de ciclo**: da primeira entrada em Desenvolvendo até Concluído (média da semana).
- **Do pedido à entrega (lead time)**: de `created_at` até Concluído.
- **Vazão**: tarefas que entraram em Concluído na semana (seg a dom).
- **Quadro em dia**: % das tarefas não concluídas com `updated_at` nas últimas 48 h.
- **Última atualização da pessoa**: evento mais recente em que ela é o ator.

Tudo calculado dentro da política de acesso (o dashboard já é só do gestor).

## 2. Fase B · Funcionalidades novas (precisam de decisão + migração)

| # | Funcionalidade | Mudança de dados | Conflito com decisão atual |
| --- | --- | --- | --- |
| B1 | ID legível `AB-118` | `tasks.number` (sequência por organização) + prefixo por organização | — |
| B2 | Bloqueio com motivo | `tasks.blocked_reason?`, `blocked_at?`; eventos `blocked`/`unblocked` | **Sim**: MVP decisão 4 diz "Bloqueado não existe por enquanto". |
| B3 | Prioridade | `tasks.priority` (`normal` \| `high`) | — |
| B4 | Limite de WIP por coluna | tabela `board_settings` (org ou projeto): limite por estado | — |
| B5 | Subtarefas | `task_checklist_items` | — |
| B6 | Definição de pronto | `definition_of_done_items` (por projeto) + conferência ao concluir | — |
| B7 | Comentários e menções | `task_comments`; menções sem aviso no MVP | — |
| B8 | Horas estimadas | `tasks.estimate_hundredths?` | — |
| B9 | Agenda: fim, tipo, recorrência | `meetings.end_time`, `type`, `recurrence` | — |
| B10 | Retro com combinados | `retro_actions` ligados ao `meeting` | — |
| B11 | Exportar resumo do dashboard | — | — |

## 3. Fase C · Já previstas como pós-MVP (PLANO 13)

Estão no protótipo só como norte: **aviso diário / daily assíncrona** (bandeja), **aviso de commit e
commits vinculados** (plug-ins), **visão Equipe**. Seguem fora até o Pedro reabrir.

## 4. Decisões para o Pedro antes de implementar

- **D0** Aprovar o ADR 0004 (vidro na barra lateral e na bandeja; conteúdo sólido; fontes; cor de ação lima).
- **D1** Dashboard: trocar porcentagens por estado pelas exceções e pelo fluxo (atualizar PLANO 6.5)?
  Manter a distribuição por estado em algum lugar?
- **D2** Números da regra "parada" (4 dias? quais estados contam?).
- **D3** Reabrir a decisão 4 do MVP (Bloqueado) para a fase B?
- **D4** Detalhe em painel lateral como padrão, mantendo "tela cheia" como opção?
- **D5** Adicionar `lucide-react` para ícones, ou manter SVG próprio?
- **D6** Agenda: eventos sem duração aparecem com 1 h até a fase B?
- **D7** Atalhos de uma letra (`N`, `G D`) estão ok, ou só `Ctrl K`?
- **D8** Ordem da fase B (sugestão: B1, B3, B2, B5, B7, B4, B9, B6, B10, B11).

## 5. Ordem sugerida de execução (fase A)

1. A1 + A2 (todo o app muda de cara de uma vez; checar a galeria `dev/Gallery.tsx`).
2. A3 (componentes isolados, testáveis).
3. A9 (regras puras com testes, antes das telas que as usam).
4. A4 → A5 → A6 (painel).
5. A7 (dashboard).
6. A8 (agenda).
7. A10 (paleta) → A11 (bandeja).

Cada item termina com `pnpm check` verde e uma parada para o Pedro olhar no app.
