# Orquestração do Plano 2.0 (Onda 1: M0 a M5)

Registro de estado do laço de 3 minutos. O orquestrador (Claude) **não escreve código**: delega a agentes Haiku, um de cada vez (mesma árvore de arquivos, sem conflito), confere com `pnpm check` e reporta ao Pedro.

Fonte: `docs/PLANO-2.0.md`. Regras do projeto: `CLAUDE.md`, `AGENTS.md`, `docs/PLANO.md`.

## Escopo desta rodada

Onda 1 do plano: **M0 a M5** (estabilizar, motor de capacidades e níveis, interface adaptativa, backlog, sprints, check-ins e impedimentos). Ondas 2 a 5 (Postgres, login, servidor, MCP, IA, integrações) dependem de infraestrutura e de decisões do Pedro: ficam para depois.

## Suposições adotadas (Pedro pode reverter)

- ADR-08: uma sprint ativa por projeto, como configuração do módulo Sprints.
- Organização e time são a mesma coisa (`organization_id` vira o `tenantId`).
- ADR-06 (nível por equipe) e ADR-07 (estimativa em horas) valem como estão no plano.
- A daily e o bloqueio já implementados são a base do M5 (check-in e impedimento); reaproveitar, não duplicar.
- Sem commit automático: o Pedro decide quando comitar.

## Passos (um agente Haiku por passo, na ordem)

Estado: `[ ]` pendente · `[~]` em andamento · `[x]` feito e `pnpm check` passou · `[!]` bloqueado (motivo abaixo do passo).

### M0 · Estabilizar o MVP

- [x] M0.1 Semântica de "Minhas tarefas" do gestor: `listTeamBoard` hoje exclui as tarefas do gestor; "Minhas tarefas" deve mostrar as dele e Equipe todas (PLANO 6.1; relatório final, seção f). Corrigir no `core`/`application` com testes.
- [ ] M0.2 Conferir que o seletor Equipe está conectado de ponta a ponta e sem tela estática; corrigir o que for estático.
- [ ] M0.3 Arquivar tarefa e arquivar projeto (esconde, nunca apaga; linha do tempo registra; só quem edita pode; desfazer arquivamento).
- [ ] M0.4 Renomear projeto (permissão como a de gerenciar membros; entrada na linha do tempo se aplicável).

### M1 · Motor de capacidades

- [ ] M1.1 `ExperienceLevel` (`basic`, `intermediate`, `advanced`) e `ModuleId`/`ModuleDefinition` com `packages/core/src/modules/registry.ts` (catálogo dos 15 módulos do plano, com `requires`, `requiresAnyOf`, `conflicts`, `minLevel`, `core`). Teste que falha se houver ciclo.
- [ ] M1.2 `resolveModuleSet` (puro): ativar puxa dependências, desativar bloqueado por dependentes, conflitos exclusivos. Testes de todas as regras do plano (seção Regras e casos de teste).
- [ ] M1.3 `effectiveCapabilities({modules, level, role})` (puro) e testes.
- [ ] M1.4 `TenantContext` obrigatório nos casos de uso (`organization_id` como tenant) e nos repositórios; nenhum caso de uso roda sem ele.
- [ ] M1.5 Persistência: tabelas `team_modules` e preferência de nível da equipe, migração Drizzle, repositório atrás de porta, seed com preset Kanban simples. Auditoria de quem mudou e quando.
- [ ] M1.6 Guard de módulo no backend: cada caso de uso declara seu módulo; chamada a módulo desligado é recusada. Estados `active`, `winding_down`, `disabled` e prévia de impacto.

### M2 · Interface adaptativa

- [ ] M2.1 Menu e campos avançados por nível (Básico oculta o que for avançado, dados continuam lá).
- [ ] M2.2 Tela "Ferramentas da equipe": presets (Kanban simples, Scrum, Kanban com fluxo, Scrum completo), prévia de impacto, aplicação direta pelo gestor, aviso "Sprints aparece a partir do Intermediário. Subir o nível do projeto?".
- [ ] M2.3 Efeitos passivos por módulo (ex.: "Sprint 4" no card em qualquer nível) e o time Básico trabalhando sem saber Scrum.

### M3 · Backlog e critérios

- [ ] M3.1 Backlog (core, persistência, aplicação, contrato): itens futuros ordenados, separado da coluna Planejamento; reordenar persiste.
- [ ] M3.2 Critérios de aceitação por tarefa (reaproveitar o padrão da definição de pronto) e estimativa em horas ligada ao custo por hora.
- [ ] M3.3 Telas de backlog (nível Intermediário) com reordenar, critérios e estimativa.

### M4 · Sprints

- [ ] M4.1 Sprint no domínio (`draft`, `active`, `closed`), `sprint_tasks` com histórico, limite de sprints ativas configurável (ADR-08), encerramento com política para itens abertos. Testes de todas as transições.
- [ ] M4.2 Persistência, migração, casos de uso e contrato.
- [ ] M4.3 Telas: planejar, iniciar, acompanhar, encerrar e replanejar; "Sprint N" no card.

### M5 · Check-ins e impedimentos

- [ ] M5.1 Check-in assíncrono pela bandeja funcionando sem sprint, com resumo sugerido a partir das tarefas movidas (reaproveitar a daily).
- [ ] M5.2 Impedimento com estado e responsável (reaproveitar o bloqueio); resolvido sai da lista.
- [ ] M5.3 Auditoria final da Onda 1: `pnpm check` completo, revisão dos critérios "Pronto quando" de M0 a M5 e relatório `docs/laco/relatorio-2.0-onda1.md`.

## Agente em andamento

M0.2 (Haiku), lançado após o commit do M0.1. Resultado chega por notificação.

## Pontos para o Pedro decidir

- Agenda do gestor: `AgendaView` usa `listBoard({})`; após o M0.1 o gestor veria só os prazos das próprias tarefas. O M0.2 restaura o comportamento anterior (todos os prazos) por `listTeamBoard`, sem mudar a regra. Confirmar.
- Colaborador não vê as próprias tarefas na Equipe (PLANO 6.1 e 2.5: "demais tarefas"). Mantido.
- WIP no quadro pessoal do gestor agora conta só as tarefas dele; o limite continua da organização. Confirmar.
- Um agente criou por engano o arquivo `/x` na raiz do sistema (cópia de `list-tasks.ts`; ficou fora do projeto). Remoção manual: `rm /x`.

## Diário (mais recente primeiro)

- Ciclo 3: M0.1 concluído (Haiku). `pnpm check` conferido pelo orquestrador: 188 arquivos, 1575 testes, exit 0. Conexão com o GitHub restabelecida; push feito.

- Ciclo 1: agente Haiku lançado para M0.1. Agendamento `*/3 * * * *` criado (id `90ddacab`).

- Preparação: plano copiado para `docs/PLANO-2.0.md`; este registro criado.

## Protocolo de cada ciclo (3 min)

1. Ler este arquivo. Se há agente em andamento, conferir se terminou (notificações). Se não terminou, reportar em uma linha e encerrar o ciclo.
2. Se terminou: rodar `pnpm check` (sem editar código). Se passou, marcar `[x]`; se falhou, reenviar a um Haiku o log do erro para corrigir (máximo 3 tentativas, depois `[!]` e relatar ao Pedro).
3. Lançar o próximo passo pendente a um Haiku, com o modelo de prompt abaixo, e marcar `[~]`.
4. Reportar: o que terminou, o que roda agora, o que bloqueou.
5. Quando todos os passos da Onda 1 estiverem `[x]`, produzir o relatório final e parar o laço.

## Modelo de prompt do agente Haiku

Você é um desenvolvedor do AgileBox (monorepo pnpm, TypeScript, Clean Architecture). Leia `CLAUDE.md`, `AGENTS.md`, `docs/PLANO.md` (fronteiras entre camadas, seção 3.1) e a parte relevante de `docs/PLANO-2.0.md`. Implemente SOMENTE o passo indicado, com testes. Responda em português; identificadores em inglês; textos da interface em pt-BR. Siga as fronteiras de camada (`tooling/layers.js`); regras de acesso ficam em `packages/core` e `packages/application`. Não invente requisitos nem dados. Não faça commit, push nem instale pacotes novos sem necessidade. Ao final rode `pnpm check` e informe: arquivos alterados, decisões tomadas, testes adicionados e o resultado do check. Se algo estiver ambíguo, escolha a opção mais simples e registre a suposição.
