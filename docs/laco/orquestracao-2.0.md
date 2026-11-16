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
- [x] M0.2 Conferir que o seletor Equipe está conectado de ponta a ponta e sem tela estática; corrigir o que for estático.
- [x] M0.3a Arquivar tarefa e projeto, backend: campo `archived_at`/`archived_by` em tarefa e projeto (core, migração Drizzle, repositórios, casos de uso `ArchiveTask`/`UnarchiveTask`/`ArchiveProject`/`UnarchiveProject`, contrato, IPC). Esconde, nunca apaga; linha do tempo registra (tarefa); só quem edita a tarefa pode arquivá-la; projeto só o gestor e quem o criou; arquivados saem das listas e do quadro por padrão; desfazer arquivamento. Testes de regra de acesso e de isolamento por organização.
- [x] M0.3b Arquivar tarefa e projeto, interface: ação "Arquivar"/"Desarquivar" no detalhe da tarefa e no diálogo/seletor de projetos, filtro "Mostrar arquivados", textos em pt-BR, testes de interface.
- [x] M0.4 Renomear projeto (permissão como a de gerenciar membros; entrada na linha do tempo se aplicável).

### M1 · Motor de capacidades

- [x] M1.1 `ExperienceLevel` (`basic`, `intermediate`, `advanced`) e `ModuleId`/`ModuleDefinition` com `packages/core/src/modules/registry.ts` (catálogo dos 15 módulos do plano, com `requires`, `requiresAnyOf`, `conflicts`, `minLevel`, `core`). Teste que falha se houver ciclo.
- [x] M1.2 `resolveModuleSet` (puro): ativar puxa dependências, desativar bloqueado por dependentes, conflitos exclusivos. Testes de todas as regras do plano (seção Regras e casos de teste).
- [x] M1.3 `effectiveCapabilities({modules, level, role})` (puro) e testes.
- [x] M1.4 `TenantContext` obrigatório nos casos de uso (`organization_id` como tenant) e nos repositórios; nenhum caso de uso roda sem ele.
- [x] M1.5 Persistência: tabelas `team_modules` e preferência de nível da equipe, migração Drizzle, repositório atrás de porta, seed com preset Kanban simples. Auditoria de quem mudou e quando.
- [x] M1.5b Ajuste do padrão das ferramentas: o preset Scrum completo não inclui `wip`, `subtasks` nem `flowMetrics` (estão em Kanban com fluxo), então o backfill/seed não preserva o que já existe. Padrão passa a ser todos os módulos, exceto `estimates.points` (conflita com horas, ADR-07) e `integrations` (plug-ins fora do MVP), nível Avançado; ajustar `defaultTeamTools`, o backfill da migração 0012 (ainda não enviada ao remoto), o seed e os testes.
- [x] M1.6a Guard de módulo no backend: cada caso de uso declara seu módulo e se cria itens; chamada a módulo `disabled` é recusada no backend (painel, chat ou MCP), e `winding_down` recusa só criação (o que já existe segue visível e editável). Mapear os casos de uso atuais (agenda→`agenda`, limite de WIP→`wip`, checklist/subtarefas→`subtasks`, retro→`reviewRetro`, daily→`checkins`, bloqueio→`impediments`, fluxo/insights→`flowMetrics`, demais→`core`). Leitura de dado do módulo desligado: esconde, nunca apaga.
- [x] M1.6b Casos de uso das ferramentas da equipe: `GetTeamTools` (ferramentas, nível e `effectiveCapabilities` do ator), `PreviewTeamToolsChange` (prévia de impacto com contagens do que depende de cada módulo e quem depende), `ApplyTeamToolsChange` (só gestor; aplica via `resolveModuleSet`; ativar é imediato, desativar entra em `winding_down` e só vira `disabled` quando acaba, com destino opcional por tipo de item; auditoria), `ChangeTeamLevel` e `ApplyTeamPreset`; contrato e IPC; testes.

### M2 · Interface adaptativa

- [x] M2.1 Menu e campos avançados por nível (Básico oculta o que for avançado, dados continuam lá).
- [x] M2.2 Tela "Ferramentas da equipe": presets (Kanban simples, Scrum, Kanban com fluxo, Scrum completo), prévia de impacto, aplicação direta pelo gestor, aviso "Sprints aparece a partir do Intermediário. Subir o nível do projeto?".
- [x] M2.3 Time Básico trabalha sem saber Scrum: teste integrado de interface (preset Kanban simples, nível Básico) percorrendo criar, mover, editar, comentar, arquivar e reabrir tarefa sem nenhum termo ou tela de Scrum (backlog, sprint, critérios, estimativa, check-in, impedimento), mais a auditoria de textos/menus por preset. O efeito passivo "Sprint N" no card depende de Sprints e fica para o M4.3; os demais efeitos passivos já valem desde o M2.1.

### M3 · Backlog e critérios

- [x] M3.1 Backlog (core, persistência, aplicação, contrato): itens futuros ordenados, separado da coluna Planejamento; reordenar persiste.
- [x] M3.2 Critérios de aceitação por tarefa (reaproveitar o padrão da definição de pronto) e estimativa em horas ligada ao custo por hora.
- [x] M3.3 Telas de backlog (nível Intermediário) com reordenar, critérios e estimativa.

### M4 · Sprints

- [x] M4.1 Sprint no domínio (`draft`, `active`, `closed`), `sprint_tasks` com histórico, limite de sprints ativas configurável (ADR-08), encerramento com política para itens abertos. Testes de todas as transições.
- [x] M4.2 Persistência, migração, casos de uso e contrato.
- [x] M4.3 Telas: planejar, iniciar, acompanhar, encerrar e replanejar; "Sprint N" no card.

### M5 · Check-ins e impedimentos

- [x] M5.1 Check-in assíncrono pela bandeja funcionando sem sprint, com resumo sugerido a partir das tarefas movidas (reaproveitar a daily).
- [~] M5.2a Impedimento com estado e responsável, backend: entidade `Impediment` por tarefa (motivo, estado `open`/`resolved`, responsável por resolver (usuário que participa da tarefa), aberto por/em, resolvido por/em, nota de resolução), com histórico (uma tarefa pode ter vários ao longo do tempo, no máximo um aberto); `tasks.block`/`tasks.unblock` existentes passam a abrir/resolver o impedimento e mantêm os campos de bloqueio da tarefa em sincronia (compatibilidade); casos de uso `impediments.list` (abertos por padrão; resolvido sai da lista; escopo como o quadro/Equipe), `impediments.assign`, `impediments.resolve`; migração com backfill dos bloqueios atuais; guard no módulo `impediments`; linha do tempo; contrato e IPC.
- [ ] M5.2b Impedimento, interface: tela/lista de impedimentos (`impediments:screen`), responsável por resolver no formulário de bloqueio e no detalhe, estado e histórico no detalhe, resolvido sai da lista, passo 3 do check-in da bandeja usando os impedimentos abertos, testes e auditoria de presets.
- [ ] M5.3 Auditoria final da Onda 1: `pnpm check` completo, revisão dos critérios "Pronto quando" de M0 a M5 e relatório `docs/laco/relatorio-2.0-onda1.md`.

## Agente em andamento

M5.2a (Haiku), lançado após o commit do M5.1. Resultado chega por notificação.

## Pontos para o Pedro decidir

- Agenda do gestor: `AgendaView` usa `listBoard({})`; após o M0.1 o gestor veria só os prazos das próprias tarefas. O M0.2 restaura o comportamento anterior (todos os prazos) por `listTeamBoard`, sem mudar a regra. Confirmar.
- Colaborador não vê as próprias tarefas na Equipe (PLANO 6.1 e 2.5: "demais tarefas"). Mantido.
- WIP no quadro pessoal do gestor agora conta só as tarefas dele; o limite continua da organização. Confirmar.
- Um agente criou por engano o arquivo `/x` na raiz do sistema (cópia de `list-tasks.ts`; ficou fora do projeto). Remoção manual: `rm /x`.

- A semana da agenda começa na segunda-feira (`agendaDays`), mas o PLANO cita domingo em um ponto. Mantido como está; confirmar a intenção.

- Arquivamento (M0.3a): tarefa dentro de projeto arquivado continua editável (só a criação é bloqueada); tarefa arquivada abre em leitura; desarquivar leva a tarefa ao topo de "Recentes". Confirmar. Há sugestão de ADR em `docs/decisoes/` sobre "ocultação na aplicação" e "arquivado não editável".
- Risco baixo preexistente: `projects.save` faz `ON CONFLICT DO UPDATE` incluindo `organization_id`; os casos de uso filtram por organização e os ids são ULID.

- Interface do arquivamento (M0.3b): arquivar tarefa pede confirmação e desarquivar é direto; "Mostrar arquivados" vale também na Equipe e no seletor de projetos; arquivados na barra lateral só com o toggle ligado; atalho N com projeto arquivado selecionado abre no primeiro projeto ativo; arquivar invalida o dashboard. Confirmar cada uma.
- O DTO de detalhe da tarefa ganhou `canArchive` (opcional, calculado no backend). Para projeto, a tela reaproveita `canManageProject` (gestor ou criador), regra duplicada com `canArchiveProject` do core; opção: mover para `canArchive` no `ProjectDto`.

- Renomear projeto (M0.4): nome repetido é recusado com CONFLICT (a criação, ao contrário, devolve o projeto existente); sem limite de tamanho (a criação também não tem); o botão Renomear age sobre o projeto selecionado no diálogo e some em projeto arquivado. Confirmar.
- Funções já implementadas no redesign (WIP, subtarefas, retro, bloqueio, daily) ainda não passam por módulo: hoje aparecem para todos. O guard e a interface adaptativa (M1.6, M2) é que passam a escondê-las conforme as ferramentas da equipe.

- Catálogo de módulos (M1.1): `requiresAnyOf` é "alternativas, cada uma com um conjunto de módulos" (burndown exige horas OU pontos). `estimates.points` está no catálogo só como caso de teste do conflito (ADR-07: só horas existe hoje). `integrations` está no catálogo só como definição, sem tela nem lógica (plug-ins seguem fora do MVP). A tabela de dependências e de nível mínimo por módulo é proposta minha, a refinar por você.

- Resolvedor (M1.2): `dependentsOf` é direto (não transitivo); `core` não aparece em `autoEnabled`; não existe `autoDisabled` (a interface pede "desligar os dois" chamando o resolvedor de novo com os dois em `disable`); `burndown` puxa `estimates.hours` (ADR-07). Confirmar.

- Capacidades (M1.3): `effectiveCapabilities` não resolve dependências (quem chama usa `resolveModuleSet` antes); o efeito passivo (`:passive`) vale para todo módulo ativo, inclusive `core` e `agenda`; `tools:view` para todos e `tools:manage` só para o gestor. Confirmar.

- TenantContext (M1.4): `TenantContext = { tenantId, actor }` com `tenantId = organizationId`; `createUseCases` envolve as 64 folhas e exige o contexto (ator cru não compila nem roda); o IPC monta o contexto da sessão e ignora `userId`/`tenantId` do payload. Fechou uma lacuna real: os `upsert` de users, contributors, projects e tasks agora não regravam id de outra organização. Decidir: (1) o tipo é estrutural, não nominal (aceitável ou quer tipo "branded"?); (2) gravação com id de outra organização é no-op silencioso (ou erro NOT_FOUND/CONFLICT?); (3) as classes de caso de uso continuam exportadas e instanciáveis fora da fronteira. Para o M6a: RLS no Postgres e coluna de organização em `task_participations`.
- Default das ferramentas (M1.5/M1.5b): para preservar o comportamento atual (WIP, subtarefas, retro, daily e bloqueio já aparecem para todos), o backfill da migração e o seed deixam a equipe em "Scrum completo, nível Avançado". O plano pede o seed em "Kanban simples"; mudar isso esconderia funções que hoje existem. Confirmar.

- Persistência (M1.5): linha ausente em `team_modules` conta como desligada (o padrão em código só vale quando a equipe nunca gravou); ator de outra organização em `saveSettings` lança ValidationError (diferente do no-op silencioso do M1.4); mudança só de `config` não é auditada (o `kind` da auditoria não tem esse valor; regra 7 do plano pede auditoria de toda mudança, tratar no M2); id da auditoria é autoincrement. Confirmar.

- Guard (M1.6a): os insights de fluxo do dashboard (`dashboard.get`/`exportSummary`) ficaram em `core`, porque o caso de uso mistura estatística do núcleo com insight de fluxo; mapear para `flowMetrics` esconderia o painel do gestor inteiro. Efeito: com `flowMetrics` desligado, esses insights ainda saem pelo dashboard, o que contraria "zero chamada a módulo desativado" da tabela de segurança. Decidir: dividir em um caso de uso só de fluxo no M2 ou adaptar o DTO. Outros: `daily.save` recusa qualquer gravação durante o encerramento (inclusive editar a daily de hoje); `boardSettings.get` é recusado com WIP desligado (a interface precisa tratar); horas e valor/hora por participação ficam em `core` (alimentam o custo); o guard lê as configurações fora da transação do caso de uso (reavaliar no M6b, Postgres). DTOs que ainda expõem campos de módulos desligados, para o M2: `checklistProgress`, `blockedReason/blockedAt`, `wipLimits/wipColumns`, `checklist`, `insights`, `blockedCount`, eventos de checklist/bloqueio na linha do tempo e contagens de retro na agenda.

- Casos de uso das ferramentas (M1.6b): desativar entra em `winding_down`; o gestor antecipa com `finalize` ou confirma com `completeWindDown` (a detecção automática de "acabou" por módulo não existe: o gestor confirma); aceite entre pessoas (ADR-05) fica para o M6b; as capacidades usam o nível da equipe (não há nível por pessoa, ADR-06); desligar um módulo cujo dependente está em `winding_down` é recusado. Pendente de decisão: `burndown` fica ativo se a alternativa (horas) entra em `winding_down` (o resolvedor considera que "existe"); a mensagem de `conflicting_request` por dependência é genérica; não há broadcast específico de ferramentas (usa o tipo `board`).

- Interface adaptativa (M2.1): enquanto `teamTools.get` carrega ou falha, a tela mostra tudo (o backend segue recusando); o plano põe Agenda no preset Kanban simples, então a Agenda aparece no Básico (o briefing dizia "sem Agenda": segui o plano); nenhum campo avançado foi escondido (o candidato é o bloco Ticket, como `integrations:advanced_fields`; esconder mudaria o que aparece para times sem a ferramenta); no Básico o motivo do bloqueio aparece sem o botão Desbloquear (Desbloquear é `impediments:screen`); o filtro "Paradas" é tratado como filtro de fluxo e o tile "Paradas" do dashboard não tem gate; Plug-ins segue "em breve". Confirmar cada uma.

- Tela de ferramentas (M2.2): Ajustes não tinha placeholder "Em breve" (já abria Aparência e Atualizações); a seção de ferramentas entrou no topo de Ajustes, então a decisão provisória 12.3 perdeu o objeto (confirmar); a lista "Em breve" (`estimates.points`, `integrations`) é fixa na UI, o DTO não tem marcador de indisponível; "Encerrando" tem três botões (Reativar, Antecipar, Concluir) em vez de interruptor; mudança de nível não tem prévia; o aviso diz "da equipe" (o plano diz "do projeto"); as descrições dos presets são texto do agente, para você revisar. A sincronização entre janelas usa o canal de mudanças existente e não foi testada de ponta a ponta; a tela não teve conferência visual (vidro, espaçamento, coluna estreita).

- Time Básico (M2.3), achados da auditoria preset × nível: (1) corrigido: o dashboard do gestor mostrava o bloco "Fluxo · 6 semanas" no Kanban simples; agora exige `flowMetrics:screen`. Para decidir: (2) "parada" (selo "parada Xd" no card, alerta "Tarefa parada" com "Segue em andamento" e tile "Paradas" do dashboard) não tem capacidade; só o filtro "Paradas" do quadro está atrás de `flowMetrics`; o MVP trata parada como sinal do núcleo, o plano 2.0 não tem módulo de parada: ou é do núcleo (então o filtro sai de `flowMetrics`) ou é métrica de fluxo (então tudo some no Kanban simples); (3) Ajustes do colaborador lista o catálogo inteiro (Backlog, Sprints etc. como "Desativada"); (4) com o módulo "Encerrando" a interface ainda mostra os controles de criar (o servidor recusa); precisa de uma capacidade de criação; (5) `dashboard.get` ainda devolve os insights de fluxo com o módulo desligado; (6) Definição de pronto aparece no Kanban simples (é núcleo) e fica perto do termo "Critérios de aceitação".
- Backlog (M3.1), suposições do orquestrador para o agente: um item de backlog é uma tarefa com posição de backlog (nulo = está no quadro), para manter linha do tempo, permissões, arquivamento e custo; o backlog de um projeto é visível a todos os membros do projeto e ao gestor; reordenar é permitido ao gestor e aos membros do projeto (planejar é coletivo); puxar para o quadro e devolver ao backlog geram evento na linha do tempo; o item de backlog não aparece no quadro nem na bandeja; o módulo é `backlog` (guard). Confirmar.

- Backlog (M3.1), implementado: rank inteiro com espaçamento de 1024 (renumera quando não cabe); `backlog.list/add/reorder/pull/sendBack`; `tasks.move` em item de backlog só aceita Planejamento; pull leva a A fazer por padrão. Para decidir: (1) módulo `backlog` em `disabled` deixa os itens escondidos (reativar devolve) e não há passo que os puxe para o quadro no encerramento (o plano prevê o gestor escolher o destino: tarefas da sprint voltando ao Kanban como estão); (2) em projeto arquivado só criar item é recusado (reordenar, puxar e devolver continuam); (3) devolver ao backlog usa a mesma política de puxar (membro ou gestor); (4) o pull gera dois eventos na linha do tempo (`task_pulled_from_backlog` e `status_changed`); (5) `sendBack` calcula o rank fora da transação (corrida rara, ordem de desempate estável); (6) `team-tools.countUsage` conta itens de backlog como tarefas nas contagens de impacto.

- Critérios e estimativa (M3.2): a estimativa é `tasks.setEstimate` (módulo `estimates.hours`), coluna `estimated_hours_hundredths` (centésimos, como `hours_hundredths`), sem CHECK de faixa (um CHECK reconstruiria `tasks` e o DROP dispararia o cascade das subtarefas; a faixa é validada no domínio e no contrato); renomear e reordenar critério geram evento na linha do tempo (o checklist de subtarefas não gera); o custo estimado só aparece para o gestor e para o próprio Responsável; `estimatedHours`, `actualHours` e os critérios vêm no DTO mesmo com o módulo desligado (a UI esconde); `actualHours` aparece para todos (são horas, não valor); a prévia de impacto das ferramentas ainda conta zero para `estimates.hours`, `acceptance` e `backlog` (ajustada no M3.3). Confirmar.

- Telas de Backlog (M3.3): o DTO de tarefa ganhou `criteriaProgress {done,total}` (opcional), mudança no contrato do M3.2 para mostrar o x/y; puxar para Concluído passa pela conferência da definição de pronto; estimativa vazia remove a estimativa; reordenar usa arrastar HTML5 nativo (o quadro usa dnd-kit) e botões Subir/Descer com `aria-live`, sem setas com modificador; o seletor de projetos do colaborador consulta os membros de cada projeto (N consultas; alternativa: o backend filtrar em `projects.list`); em "Encerrando" somem criar item e criar critério. Confirmar.
- Sprints (M4), suposições do orquestrador para o agente: o plano só diz "Sprint com `draft`, `active`, `closed`; `sprint_tasks` com histórico; limite de sprints ativas configurável (ADR-08); encerramento com política para itens abertos". Assumi: uma tarefa está em no máximo uma sprint ativa por vez; quem planeja, inicia, encerra e mexe nos itens da sprint é o gestor e os membros do projeto (como o backlog; o plano não define); política de encerramento: itens abertos voltam ao backlog (padrão) ou seguem para a próxima sprint em planejamento; itens concluídos ficam na sprint como resultado. Confirmar.

- Sprint no domínio (M4.1): `maxActiveSprints` (padrão 1, ADR-08) como chave de configuração do módulo; qualquer tarefa não arquivada do mesmo projeto e fora de outra sprint aberta pode entrar (backlog ou quadro, inclusive concluída); sprint vazia pode iniciar e encerrar; o encerramento gera eventos de saída e, no `carry_over`, de entrada na linha do tempo; itens arquivados e abertos saem como `removed`; o número da sprint é máximo+1 (descartar pode reaproveitar número se a linha for apagada). Decisões do orquestrador para o M4.2, a confirmar: (A) o `return_to_backlog` conflita com a regra do backlog (item já iniciado, em Desenvolvendo ou Revisar, não volta ao backlog): itens ainda não iniciados (Planejamento, A fazer) voltam ao backlog, os iniciados ficam no quadro sem sprint com um novo desfecho `left_on_board`; (B) descartar rascunho é exclusão lógica (`discarded_at`), a linha nunca é apagada e o número não se reaproveita; (C) adicionar um item de backlog a uma sprint não o move; iniciar a sprint puxa os itens de backlog para o quadro (A fazer), e item de backlog adicionado a sprint ativa é puxado na hora; (D) iniciar uma sprint conta como criar para o módulo "Encerrando".

- Sprints no backend (M4.2): as decisões (A) a (D) foram aplicadas; o descarte também deixa no quadro, como `left_on_board`, o item já iniciado; `carry_over` é recusado com o módulo em "Encerrando" (cria linhas na próxima sprint); "Sprint N" no card continua visível durante o encerramento do módulo e some só com o módulo desligado; a faixa 1 a 5 do limite de sprints ativas é validada na aplicação (`teamTools.setModuleConfig`, só gestor; só `sprints.maxActiveSprints` é configurável); eventos de "sprint iniciada/encerrada" não são gravados (o histórico vem de `sprint_tasks` e da linha do tempo das tarefas); a chave de `sprint_tasks` é (sprint, tarefa, `added_at` em ms), então a mesma tarefa na mesma sprint no mesmo milissegundo colidiria (alternativa: id ULID); adicionar item a sprint de projeto arquivado não é recusado de forma explícita. Lacuna aberta: mudança só de `config` do módulo NÃO é auditada (o CHECK de `team_tools_audit.kind` exigiria recriar a tabela), contra a regra 7 do plano.

- Telas de Sprints (M4.3): o "Replanejar" cria um rascunho com a mesma duração da sprint encerrada, começando hoje (o plano não define datas); criar e editar sprint vale para qualquer membro do projeto, como no backend; o filtro "Sprint ativa" aparece no quadro também para o colaborador (só com a tela de Sprints, do Intermediário em diante); "Levar para a próxima" leva todos os itens abertos, inclusive os já iniciados; a aba Ativa lista todas as sprints ativas do projeto (até 5, ADR-08); a atualização da bandeja usa o evento de mudança existente e não foi testada em janela real; a tela não teve conferência visual (o mini-quadro de cinco colunas rola na horizontal em telas estreitas).

- Check-in com sugestão (M5.1): a sugestão vem da linha do tempo das tarefas de que a pessoa participa e é texto editável, nunca gravado sem confirmar (só o "Concluir" grava); movimento de estado feito por qualquer pessoa aparece nas tarefas dela, e horas e comentários só os dela; `nextCandidates` é restrito a tarefas com comentário próprio no dia; "Usar sugestão" só preenche o primeiro passo (nada no segundo); o rótulo "Sprint N" opcional no item não foi feito; sem limite de linhas; o título do grupo é "Tarefas que travaram ou destravaram" (a palavra "Bloqueio" é reprovada pela auditoria no perfil Kanban simples); a data futura não é recusada na leitura; há uma leitura de timeline por tarefa (N+1). Não conferido em janela real (altura da tela do passo 1 na bandeja). Confirmar.

## Diário (mais recente primeiro)

- Ciclo 183: M5.1 concluído (Haiku). `daily.suggestSummary` (regra pura `suggestDailySummary`, caso de uso, contrato, IPC) e painel "Usar sugestão" no passo 1 da bandeja, sem sprint nem backlog; +49 testes. `pnpm check` pelo orquestrador: 272 arquivos, 2410 testes, exit 0. M5.2 dividido em backend (M5.2a) e interface (M5.2b).

- Ciclo 172: M4.3 concluído (Haiku). Tela Sprints (planejar, iniciar, acompanhar com progresso e mini-quadro, encerrar com as duas políticas, histórico e Replanejar), marcador "Sprint N" no card, no backlog, no detalhe e na bandeja, filtro "Sprint ativa" e campo do limite de sprints ativas na tela de ferramentas; +43 testes. `pnpm check` pelo orquestrador: 267 arquivos, 2361 testes, exit 0. **M4 completo.**

- Ciclo 159: M4.2 concluído (Haiku). Tabelas `sprints` e `sprint_tasks` (migração 0015, índice parcial único de linha aberta por tarefa), 9 casos de uso `sprints.*` e `teamTools.setModuleConfig`, campo `sprint` no DTO da tarefa, contagem de impacto; encerramento atômico; +47 testes. `pnpm check` pelo orquestrador: 263 arquivos, 2318 testes, exit 0.

- Ciclo 148: M4.1 concluído (Haiku). `Sprint` (rascunho, ativa, encerrada), `SprintTask` com histórico, limite de sprints ativas, `planSprintClose` com as duas políticas, políticas de acesso e eventos pt-BR, tudo puro em `packages/core` (+59 testes). `pnpm check` pelo orquestrador: 258 arquivos, 2271 testes, exit 0.

- Ciclo 141: M3.3 concluído (Haiku). Tela Backlog (item na barra lateral, atalho G B, lista por projeto, criação rápida, reordenar por arrastar e por teclado, puxar para o quadro, devolver ao backlog), seção Critérios de aceitação e campo Estimativa no detalhe, marcadores passivos; `countUsage` das ferramentas agora conta backlog, critérios e estimativas; +59 testes. `pnpm check` pelo orquestrador: 252 arquivos, 2212 testes, exit 0. **M3 completo.**

- Ciclo 128: M3.2 concluído (Haiku). Critérios de aceitação por tarefa (até 20, `tasks.criteria.*`, módulo `acceptance`) e estimativa em horas (`tasks.setEstimate`, módulo `estimates.hours`) com custo estimado respeitando a visibilidade de valores; migração 0014; 83 arquivos tocados (campo novo na tarefa); +121 testes. `pnpm check` pelo orquestrador: 245 arquivos, 2153 testes, exit 0.

- Ciclo 117: M3.1 concluído (Haiku). Backlog como tarefa com posição (`backlogRank`, migração 0013): domínio, persistência, cinco casos de uso `backlog.*` com guard, contrato e IPC; itens de backlog saem do quadro, da busca, dos recentes e do dashboard; +65 testes. `pnpm check` pelo orquestrador: 236 arquivos, 2032 testes, exit 0.

- Ciclo 103: M2.3 concluído (Haiku). Auditoria de 4 presets × 3 níveis (diff de teste), fluxo diário do time Básico sem termos de Scrum, troca de nível sem perda de dados; uma correção real no dashboard; +23 testes. `pnpm check` pelo orquestrador: 229 arquivos, 1967 testes, exit 0. **M2 completo.**

- Ciclo 92: M2.2 concluído (Haiku). Tela "Ferramentas da equipe" no topo de Ajustes: nível, 4 presets, lista de ferramentas com prévia de impacto, dependentes, encerramento gradual e reativação; gestor edita e colaborador só lê; +23 testes. `pnpm check` pelo orquestrador: 223 arquivos, 1944 testes, exit 0.

- Ciclo 85: M2.1 concluído (Haiku). `useTeamTools`/`useCapabilities` e o filtro por capacidade no painel, no dashboard e na bandeja (mapa elemento→capacidade no relatório do agente); com o padrão de código nada muda para quem usa hoje; +24 testes. `pnpm check` pelo orquestrador: 220 arquivos, 1921 testes, exit 0.

- Ciclo 76: M1.6b concluído (Haiku). Seis casos de uso (`teamTools.get`, `previewChange`, `applyChange`, `completeWindDown`, `setLevel`, `applyPreset`), todos `core` e só o gestor muda; prévia de impacto com contagens reais; auditoria inclusive de preset; contrato, 6 canais IPC e cliente; +45 testes. `pnpm check` pelo orquestrador: 216 arquivos, 1897 testes, exit 0. **M1 completo.**

- Ciclo 67: M1.6a concluído (Haiku). `USE_CASE_MODULES` mapeia as 64 folhas para módulos (40 em `core`); o guard roda dentro de `forTenant`: `disabled` recusa com FORBIDDEN, `winding_down` recusa só criação com CONFLICT, `core` nunca é bloqueado; um caso de uso novo sem declaração não compila. +25 testes. `pnpm check` pelo orquestrador: 212 arquivos, 1852 testes, exit 0.

- Ciclo 61: M1.5b concluído (Haiku). `defaultTeamTools` e backfill da migração 0012 agora cobrem os 13 módulos (todos menos `estimates.points` e `integrations`, nível Avançado), preservando WIP, subtarefas, retro, daily, bloqueio e métricas; +4 testes. `pnpm check` pelo orquestrador: 211 arquivos, 1827 testes, exit 0. M1.6 dividido em M1.6a (guard) e M1.6b (casos de uso das ferramentas).
- Ciclo 57: M1.5 concluído (Haiku). Tabelas `team_modules`, `team_preferences` e `team_tools_audit` (migração 0012 com backfill), porta e repositório SQLite/fake atômicos com auditoria, seed, 25 testes de core e contrato nos dois lados. `pnpm check` pelo orquestrador: 211 arquivos, 1823 testes, exit 0. O agente apontou que o backfill "Scrum completo" não preserva WIP/subtarefas/métricas de fluxo: criado o M1.5b para corrigir o padrão antes do guard.

- Ciclo 49: M1.4 concluído (Haiku). `TenantContext` obrigatório na fronteira dos casos de uso, IPC monta o contexto da sessão, guardas de organização nos repositórios SQLite e nos fakes; testes estruturais (64 casos de uso recusam ator cru ou contexto de outra organização). `pnpm check` pelo orquestrador: 207 arquivos, 1779 testes, exit 0.

- Ciclo 40: M1.3 concluído (Haiku). `effectiveCapabilities`, `hasCapability`, `shouldShowModuleScreen` e `moduleLevelWarning` (base do aviso "Sprints aparece a partir do Intermediário"), 27 testes. `pnpm check` pelo orquestrador: 206 arquivos, 1774 testes, exit 0.

- Ciclo 36: M1.2 concluído (Haiku). `resolveModuleSet` e `dependentsOf` em `core/modules/resolve.ts`, 44 testes (cada preset aplicado sobre `core` dá exatamente o conjunto do preset). `pnpm check` pelo orquestrador: 205 arquivos, 1747 testes, exit 0.

- Ciclo 30: M1.1 concluído (Haiku). `packages/core/src/modules/` com níveis, catálogo dos 15 módulos, 4 presets e detector de ciclo, com testes. `pnpm check` pelo orquestrador: 204 arquivos, 1703 testes, exit 0.

- Ciclo 25: M0.4 concluído (Haiku). `renameProject` no core, `RenameProject` na aplicação (gestor e criador; recusa nome vazio, repetido e projeto arquivado), contrato, IPC e edição inline no diálogo de projetos; +26 testes. `pnpm check` pelo orquestrador: 201 arquivos, 1653 testes, exit 0. **M0 completo.**

- Ciclo 19: M0.3b concluído (Haiku). Botões Arquivar/Desarquivar na tarefa e no projeto, filtro "Mostrar arquivados", cartões atenuados, criação bloqueada em projeto arquivado; +17 testes. `pnpm check` pelo orquestrador: 197 arquivos, 1627 testes, exit 0.

- Ciclo 14: M0.3a concluído (Haiku, ~13 min). Campos de arquivamento em tarefa e projeto, migração 0011 (só colunas nulas), casos de uso, contrato e IPC; ocultação em quadro, equipe, busca, recentes, dashboard e WIP. `pnpm check` pelo orquestrador: 193 arquivos, 1610 testes, exit 0.

- Ciclo 8: M0.2 concluído (Haiku). Agenda do gestor volta a mostrar todos os prazos (`listTeamBoard` + `listBoard`, sem duplicar); seletor Equipe já estava ligado a dados reais nos dois perfis. `pnpm check` pelo orquestrador: 188 arquivos, 1577 testes, exit 0. M0.3 dividido em M0.3a (backend) e M0.3b (interface).

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
