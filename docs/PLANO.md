# Plano de construção do AgileBox (MVP)

> Documento vivo. Complementa o `MVP.md` (escopo) e o `HANDOFF.md` (visual e comportamento).
> Cada marco termina com algo que o Pedro abre, usa e revisa. Nenhum marco começa sem confirmação.

## Sumário

1. Decisões consolidadas
2. Interpretações a confirmar
3. Arquitetura
4. Convenções de código
5. Modelo de dados
6. Regras de domínio
7. Contrato da API
8. Estratégia de testes
9. Marcos e metas
10. Estrutura de arquivos (e função de cada um)
11. Riscos e mitigação
12. Decisões ainda em aberto
13. Pós-MVP

**Execução**: os marcos são construídos em passos pequenos listados em `PROGRESS.md`, executados pelo Codex em laço (`AGENTS.md`, `scripts/codex-loop/`). O laço para em cada `PARADA` para revisão do Pedro.

---

## 1. Decisões consolidadas

| Tema                       | Decisão                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop                    | **Electron** (processo principal em Node + duas janelas: Painel e Bandeja)                                                                                                                                 |
| Interface                  | **React + TypeScript + Vite** (via `electron-vite`), **CSS próprio** com variáveis (tokens do HANDOFF) e CSS Modules                                                                                       |
| Dados no MVP               | **SQLite local** (`better-sqlite3`) + **Drizzle**, com acesso isolado atrás de portas (interfaces)                                                                                                         |
| Organização                | **Monorepo pnpm workspaces**, cliente (`apps/desktop`) separado do servidor (`apps/server`, vazio no MVP)                                                                                                  |
| Arquitetura                | **Clean Architecture**: domínio → aplicação → adaptadores; **injeção de dependência manual** (construtores + composition root)                                                                             |
| Fronteira cliente/servidor | Interface `AgileBoxApi` no pacote `contract`, validada com **zod**. MVP: adaptador IPC. Futuro: adaptador HTTP                                                                                             |
| Testes                     | **Vitest** (unidade e integração), **Testing Library** (componentes), **Playwright** (`_electron`, ponta a ponta)                                                                                          |
| Windows                    | O Pedro tem Windows 11 para testar vidro, bandeja e instalador                                                                                                                                             |
| Git e instalação           | O Pedro roda `git`, `pnpm install` e afins; o Claude foca no código                                                                                                                                        |
| "Plano"                    | É outro nome para **projeto**. Não há nível intermediário                                                                                                                                                  |
| Bloqueado                  | Não existe por enquanto                                                                                                                                                                                    |
| Frequentes (bandeja)       | Tarefas **abertas mais recentemente por mim**. Recentes = **última atualização**                                                                                                                           |
| Texto vazio de Frequentes  | "Nenhuma tarefa aberta ainda."                                                                                                                                                                             |
| Dono da tarefa             | **Quem criou** (até segunda ordem)                                                                                                                                                                         |
| Responsável                | Sempre um **usuário** cadastrado. O padrão ao criar é o próprio criador                                                                                                                                    |
| Envolvidos                 | Cada envolvido é **um usuário** (Responsável ou Apoio, que ganha acesso à tarefa) **ou uma entidade** (ver 2.6)                                                                                            |
| Entidades                  | São **stakeholders**: só nome, para identificação. **Nunca** dão permissão nem recebem avisos. Lista compartilhada pela organização, criada pelo botão "Criar entidade". Origem `manual` (futuro: `azure`) |
| Valor/hora                 | **Cada usuário e cada entidade tem o seu valor/hora padrão**. Ao entrar numa tarefa, o valor é copiado para o envolvimento. Custo = Σ (horas trabalhadas × valor/hora)                                     |
| Visibilidade do valor/hora | O **gestor** vê e edita todos. O **usuário** vê e edita só o próprio. Colaborador não vê R$ de ninguém além de si                                                                                          |
| Projetos                   | Criados por colaborador ou gestor; têm **vários membros**. Só **quem criou e o gestor** adicionam/removem membros                                                                                          |
| Kanban "Minhas tarefas"    | Mostra **as tarefas de que o usuário participa** (criou, é Responsável ou Apoio), **de todos os projetos dele**; o seletor de projeto filtra (inclui "Todos os projetos")                                  |
| Visão Equipe               | O resto das tarefas dos projetos de que a pessoa é membro fica **só na visão Equipe**, em somente leitura (ver 2.5)                                                                                        |
| Banco                      | **SQLite agora**, pronto para migrar (seção 3.7)                                                                                                                                                           |
| Multiempresa (SaaS)        | **Depois**, mas com o terreno preparado desde já: `organization_id` em todas as tabelas raiz (seção 3.6)                                                                                                   |
| Marca "Gestor"             | **Toda** edição feita por um gestor é marcada como Gestor                                                                                                                                                  |
| Chamado                    | **ID numérico** obrigatório quando houver chamado, **link opcional**                                                                                                                                       |
| Login                      | **Pós-MVP**, junto com o servidor: Google, Microsoft e login manual (nessa ordem). No MVP, troca manual de perfil                                                                                          |

---

## 2. Respostas às interpretações (2026-10-31)

2.1 **Responsável padrão: confirmado.** Ao criar, o Responsável é o criador; pode ser trocado depois.

2.2 **Criar tarefa: confirmado.** Colaborador cria só em projetos de que é membro; gestor em qualquer um.

2.3 **Valor/hora: confirmado.**

- O **gestor vê e edita** o valor/hora de qualquer usuário, entidade e envolvimento.
- O **usuário vê e edita só o próprio** valor/hora (padrão e nos envolvimentos dele).
- O valor das **entidades** só é visto e editado pelo gestor.
- Para o colaborador, o card **Custo** mostra **as horas** de todos os envolvidos, mas R$ só nas linhas dele; o **total em R$ só aparece para o gestor**.

2.4 **Valor copiado por tarefa: confirmado.** Ao entrar numa tarefa, o valor padrão do envolvido é copiado para o envolvimento; mudar o padrão depois não altera custos registrados. Editar o valor dentro de uma tarefa também atualiza o padrão daquele envolvido (usuário ou entidade).

2.5 **Minhas tarefas × Equipe: decidido.** O kanban principal ("Minhas tarefas") mostra **só** as tarefas de que o colaborador participa. Todas as outras tarefas dos projetos de que ele é membro pertencem à **visão Equipe**, em somente leitura. A regra e a API (`tasks.listTeamBoard`) existem **desde o M3**. A **tela** da visão Equipe segue fora do MVP (ver `CLAUDE.md`), até o Pedro dizer o contrário.

2.6 **Entidades não são usuários: decidido.** Entidades são stakeholders: **só nome**, para identificação. Não dão permissão, não recebem avisos, não têm vínculo com conta. Consequência no modelo (derivada desta resposta e da resposta "quem apoia pode ver e editar"):

- Um envolvimento (`task_participations`) aponta para **um usuário ou uma entidade**, nunca os dois.
- Papéis: `responsible` (sempre usuário, exatamente um por tarefa) e `support` (usuário **ou** entidade).
- **Só envolvimentos de usuário** contam para "participa" (acesso). Envolvimento de entidade serve para custo e identificação.

2.7 **Multiempresa: preparar agora, construir depois.** Existe a tabela `organizations` com **uma** organização no seed. Todas as tabelas raiz têm `organization_id`, o ator carrega `organizationId` e todo repositório filtra por ele (seção 3.6). Telas de empresa, convites e cobrança ficam para o pós-MVP. "Time" = organização no MVP.

---

## 3. Arquitetura

### 3.1 Camadas e regra de dependência

```
                ┌───────────────────────────────┐
                │  core (domínio puro)          │  ← não depende de nada
                │  valores, entidades, políticas│
                │  de acesso, regras            │
                └──────────────▲────────────────┘
                               │
   ┌───────────────────────────┴───────────────────────────┐
   │  application (casos de uso)                           │
   │  portas: repositórios, UnitOfWork, Clock, IdGenerator,│
   │          ChangeNotifier                               │
   │  usa: core + contract (DTOs)                          │
   └──────────────▲───────────────────────▲────────────────┘
                  │ implementa portas     │ chama casos de uso
   ┌──────────────┴─────────┐   ┌─────────┴──────────────────────┐
   │ infra-sqlite           │   │ apps/desktop/main              │
   │ Drizzle + better-sqlite│   │ composition root + IPC + janelas│
   └────────────────────────┘   └─────────▲──────────────────────┘
                                          │ IPC (contrato zod)
                               ┌──────────┴──────────────────────┐
                               │ apps/desktop/renderer           │
                               │ Painel e Bandeja (React)        │
                               │ usa: contract, ui, core (regras │
                               │ puras de exibição)              │
                               └─────────────────────────────────┘
```

Regras (verificadas pelo ESLint, ver M1):

| Pacote             | Pode importar                                                       |
| ------------------ | ------------------------------------------------------------------- |
| `core`             | nada interno                                                        |
| `contract`         | nada interno (só `zod`)                                             |
| `application`      | `core`, `contract`                                                  |
| `infra-sqlite`     | `core`, `application` (portas)                                      |
| `ui`               | `core` (só valores, ex.: lista de estados)                          |
| `desktop/main`     | `core`, `contract`, `application`, `infra-sqlite`                   |
| `desktop/preload`  | `contract`                                                          |
| `desktop/renderer` | `core`, `contract`, `ui`. **Nunca** `application` ou `infra-sqlite` |
| `server` (futuro)  | igual ao `desktop/main`, com `infra-postgres`                       |

### 3.2 Injeção de dependência (manual)

- Cada caso de uso é uma classe (ou função-fábrica) que **recebe as portas no construtor**.
- `application` exporta `createUseCases(deps: AppDeps)`, que monta todos os casos de uso a partir das portas.
- O **composition root** (`apps/desktop/src/main/composition-root.ts`) é o único lugar que conhece as implementações concretas: abre o SQLite, cria os repositórios, o relógio, o gerador de IDs e o notificador, e chama `createUseCases`.
- No renderer, a DI é um **React Context** (`ApiProvider`) que entrega um `AgileBoxApi`. A app usa o cliente IPC; os testes usam um fake.
- Trocar SQLite por Postgres ou IPC por HTTP = escrever um novo adaptador e mudar **só** o composition root.

### 3.3 Caminho de uma edição

```
Bandeja: "Salvar"
  → api.tasks.update({ taskId, changes })            renderer (ipc-client)
  → ipcRenderer.invoke('tasks.update', payload)      preload
  → handler valida com zod, pega o Actor da sessão   main/ipc
  → UpdateTask.execute(actor, input)                 application
      ├─ carrega tarefa (TaskRepository)
      ├─ AccessPolicy.canEditTask(actor, ctx)        core → se não, PermissionDenied
      ├─ aplica mudanças na entidade Task            core (valida)
      ├─ diffTask(antes, depois) → eventos           core
      ├─ UnitOfWork: salva tarefa + eventos juntos   infra-sqlite (transação)
      └─ ChangeNotifier.publish({ kind:'task', ids })
  → main transmite 'changes' para as duas janelas
  → renderers invalidam as queries do TanStack Query → telas atualizam
```

### 3.4 Sessão e "ator" no MVP

- O processo principal guarda o **ator atual** (`{ userId, organizationId, role }`) num `ActorSession` em memória, persistido em `settings` local.
- O renderer **nunca envia** quem é o ator; o main injeta em todo caso de uso. No futuro, isso vira o token de login do servidor.
- O `AccountMenu` (só em modo desenvolvimento/demonstração) chama `session.switchUser(userId)`.

### 3.5 Erros

- Domínio e aplicação lançam erros tipados (`DomainError` com `code`: `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`).
- O handler IPC converte para `{ ok: false, error: { code, message } }`. O cliente IPC devolve o valor ou lança `ApiError`. O main nunca deixa escapar uma exceção crua.
- Mensagens para o usuário em pt-BR, no padrão de vidro (toast ou texto curto).

### 3.6 Multiempresa (preparado, não construído)

- `Actor = { userId, organizationId, role }`. O `organizationId` vem da sessão (no futuro, do token), nunca do renderer.
- Toda porta de repositório recebe o `organizationId` como **primeiro parâmetro** dos métodos (ex.: `tasks.findById(orgId, taskId)`). Não existe consulta sem organização.
- Tabelas raiz com `organization_id`: `users`, `contributors`, `projects`, `tasks`, `meetings`. Tabelas filhas herdam pelo pai (`project_members`, `task_participations`, `task_events`, `task_opens`, `meeting_participants`).
- A suíte de contrato dos repositórios tem testes de **isolamento**: dados da organização A nunca aparecem para a B.
- Unicidade sempre por organização (ex.: nome de projeto único **dentro** da organização).

### 3.7 Pronto para trocar de banco

O SQLite é um adaptador. Para que outro banco (Postgres, por exemplo) entre só com um pacote novo (`infra-postgres`):

- **Nenhum SQL fora de `packages/infra-sqlite`.** Domínio e aplicação só conhecem as portas.
- **IDs gerados na aplicação** (ULID via `IdGenerator`), nunca autoincremento do banco.
- **Tipos portáveis**: instantes em texto ISO-8601 UTC, datas `YYYY-MM-DD`, dinheiro e horas em inteiros, booleanos pelo modo `boolean` do Drizzle, JSON só no `payload` dos eventos (lido e escrito pela aplicação, sem funções JSON do banco).
- **Sem recursos exclusivos do SQLite** nas consultas (nada de `GLOB`, `json_extract`, `rowid`). Busca sem acentos é feita com uma coluna normalizada (`search_text`) preenchida pela aplicação.
- **Transação pela porta `UnitOfWork`**, com interface assíncrona (`run(async (tx) => …)`), embora o better-sqlite3 seja síncrono. Assim o Postgres encaixa sem mudar os casos de uso.
- **Repositórios assíncronos** (`Promise`) pelo mesmo motivo.
- A **suíte de contrato** (seção 8) é a prova: o adaptador novo só entra quando passa nela inteira.

---

## 4. Convenções de código

- **Idioma**: código, nomes de arquivos e identificadores em **inglês**. Textos da interface em **pt-BR**, centralizados em `copy.ts` por tela. Documentação em pt-BR.
- **Termos**: "Entidade" (UI) = `Contributor` no código, para não confundir com "entity" da Clean Architecture. "Envolvimento" = `Participation`. Agendamento = `Meeting`.
- **Arquivos**: `kebab-case.ts`; componentes React em `PascalCase.tsx`; um componente por arquivo; testes ao lado (`*.test.ts(x)`).
- **TypeScript**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Sem `any`.
- **IDs**: ULID (`string` com tipo marcado: `TaskId`, `UserId`…), gerados pela porta `IdGenerator`.
- **Dinheiro**: inteiro em **centavos**. **Horas**: inteiro em **centésimos de hora** (1,5 h = 150). Entrada aceita vírgula.
- **Datas**: instantes em ISO-8601 UTC (`criada_em`, `quando`). Prazo: `YYYY-MM-DD` (data sem hora). Agendamento: `YYYY-MM-DD` + `HH:mm` no horário local. Exibição sempre na data local; semana começa no domingo.
- **"Hoje"** vem sempre da porta `Clock` (testável).
- Pacotes internos são consumidos **como código-fonte TS** (o `exports` aponta para `src/`), sem build separado; o `electron-vite` empacota tudo.

---

## 5. Modelo de dados (SQLite, Drizzle)

| Tabela                     | Colunas                                                                                                                                                                                         | Observações                                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`            | `id`, `name`, `created_at`                                                                                                                                                                      | Uma só no MVP (seed). Base do SaaS (3.6)                                                                                                                                                                                                     |
| `users`                    | `id`, `organization_id`, `name`, `email` (único na organização), `initials`, `role` (`collaborator`\|`manager`), `default_rate_cents`, `created_at`                                             | Quem usa o sistema                                                                                                                                                                                                                           |
| `contributors` (entidades) | `id`, `organization_id`, `name`, `source` (`manual`\|`azure`), `external_id?`, `default_rate_cents`, `created_by`, `created_at`                                                                 | Stakeholders: só identificação, **sem** vínculo com conta (2.6). `default_rate_cents` começa em 0 = não definido (6.2)                                                                                                                       |
| `projects`                 | `id`, `organization_id`, `name`, `name_key` (normalizado, único na organização), `created_by`, `created_at`                                                                                     | Nome repetido seleciona o existente (HANDOFF)                                                                                                                                                                                                |
| `project_members`          | `project_id`, `user_id`, `added_by`, `added_at`                                                                                                                                                 | PK composta. O criador entra como membro                                                                                                                                                                                                     |
| `tasks`                    | `id`, `organization_id`, `project_id`, `created_by` (dono), `title`, `description`, `status` (CHECK nos 5), `deadline?`, `ticket_id?`, `ticket_url?`, `search_text`, `created_at`, `updated_at` | `updated_at` ordena "Recentes"; `search_text` = título + projeto sem acentos, minúsculo (3.7)                                                                                                                                                |
| `task_participations`      | `id`, `task_id`, `user_id?`, `contributor_id?`, `role` (`responsible`\|`support`), `hours_hundredths`, `rate_cents`, `added_at`                                                                 | CHECK: exatamente um entre `user_id` e `contributor_id`; `responsible` exige `user_id`. Únicos: (`task_id`, `user_id`), (`task_id`, `contributor_id`) e um `responsible` por tarefa (índice parcial). `rate_cents` é a cópia do padrão (2.4) |
| `task_events`              | `id`, `task_id`, `at`, `actor_user_id`, `as_manager` (bool), `type`, `payload` (JSON: campo, antes, depois, ids)                                                                                | **Sem texto pronto**: o texto é gerado na leitura, conforme quem vê (não vaza valor/hora)                                                                                                                                                    |
| `task_opens`               | `user_id`, `task_id`, `last_opened_at`, `open_count`                                                                                                                                            | PK composta. Ordena "Frequentes"                                                                                                                                                                                                             |
| `meetings`                 | `id`, `organization_id`, `title`, `date`, `time`, `created_by`, `created_at`, `updated_at`                                                                                                      | Só gestor grava                                                                                                                                                                                                                              |
| `meeting_participants`     | `meeting_id`, `user_id`                                                                                                                                                                         |                                                                                                                                                                                                                                              |
| `local_settings`           | `key`, `value`                                                                                                                                                                                  | Só do app local (ator atual, tamanho da bandeja). Não vai para o servidor                                                                                                                                                                    |

Índices: `tasks(organization_id, project_id)`, `tasks(organization_id, updated_at)`, `task_participations(user_id)`, `task_participations(contributor_id)`, `task_events(task_id, at)`, `task_opens(user_id, last_opened_at)`, `meetings(organization_id, date)`.

Pragmas: `journal_mode=WAL`, `foreign_keys=ON`. Migrações geradas pelo `drizzle-kit` e aplicadas ao iniciar o app.

**Fora agora**: `auth_identities`, `teams`, `plugin_events`, `inbox`.

---

## 6. Regras de domínio

### 6.1 Acesso (`core/policies/access-policy.ts`)

"Participa" = é o criador, **ou** tem um envolvimento de **usuário** na tarefa (Responsável ou Apoio). Entidades nunca contam (2.6).
Tudo acontece **dentro da organização do ator**; nada cruza organizações (3.6).

| Ação                                 | Colaborador                                                        | Gestor                                                         |
| ------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Kanban "Minhas tarefas"              | tarefas de que participa, nos projetos de que é membro             | as de que participa; via Dashboard, as de qualquer colaborador |
| Visão Equipe (API; tela fora do MVP) | demais tarefas dos projetos de que é membro, somente leitura (2.5) | todas                                                          |
| Ver detalhe                          | participa → edita; membro sem participar → somente leitura         | todas                                                          |
| Editar tarefa                        | se participa                                                       | todas (**sempre** `as_manager = true`)                         |
| Criar tarefa                         | em projeto de que é membro (2.2)                                   | qualquer projeto                                               |
| Criar projeto                        | sim (vira criador e membro)                                        | sim                                                            |
| Gerenciar membros                    | se criou o projeto                                                 | sim                                                            |
| Ver projetos                         | os de que é membro                                                 | todos                                                          |
| Ver/editar valor/hora                | só o próprio (padrão e envolvimentos dele) (2.3)                   | todos (usuários e entidades)                                   |
| Ver total em R$ da tarefa            | não (2.3)                                                          | sim                                                            |
| Criar entidade                       | sim                                                                | sim                                                            |
| Ver agenda                           | sim                                                                | sim                                                            |
| Criar/editar/excluir agendamento     | não                                                                | sim                                                            |
| Dashboard                            | não                                                                | sim                                                            |

### 6.2 Custo (`core/rules/cost.ts`)

- `subtotal = hours_hundredths × rate_cents / 100`, arredondado para centavo (meio para cima).
- `total = Σ subtotais`. Formatação BRL `pt-BR`.
- Entrada: aceitar `"1,5"`, `"1.5"`, `"45"`, `"45,50"`; rejeitar negativos; valor/hora > 0 para virar padrão.
- **Valor/hora padrão 0 = "não definido"** (decisão do Pedro, M3.10): usuário ou entidade recém-criados começam com 0, e o custo é R$ 0 até alguém com permissão definir o valor. O domínio aceita 0 como padrão; **definir ou alterar** o padrão (e o valor digitado na tarefa que vira novo padrão) exige valor maior que zero.

### 6.3 Prazo (`core/rules/deadline-label.ts`)

"Concluída" (se `status = done`), "Sem prazo definido", "Vence hoje", "Vence amanhã", "Em N dias", "Venceu há N dias". Calculado em dias de calendário local.

### 6.4 Linha do tempo (`core/rules/timeline.ts`)

- `diffTask(before, after)` gera um evento por campo mudado.
- Tipos: `task_created`, `status_changed` (inclui arrastar: "moveu de X para Y"), `deadline_changed`, `renamed`, `description_edited`, `responsible_changed`, `ticket_changed`, `hours_changed`, `rate_changed`, `participant_added`, `participant_removed`.
- `describeEvent(event, viewer)` monta a frase em pt-BR; omite valores em R$ se o viewer não pode vê-los.
- Texto, descrição, horas e valor/hora são gravados **ao sair do campo** (responsabilidade da UI: um `update` por blur).
- Ordem: mais recente no topo.

### 6.5 Dashboard (`core/rules/dashboard.ts` e `flow.ts`)

Redesign v2 aprovado pelo Pedro: a tela passa a priorizar exceções e fluxo (HANDOFF-v2 4.4).
O gestor recebe tarefas paradas (mais de 4 dias em Desenvolvendo/Revisar), vencidas, quadro em dia
(atualizadas nas últimas 48h), ciclo e lead time médios das conclusões da semana, vazão em seis
semanas de segunda a domingo, até cinco mudanças desde ontem e última edição por pessoa.
Tudo é calculado dentro da organização e a consulta continua restrita ao gestor. Bloqueio,
prioridade e limites de WIP ficam na fase B; daily permanece na fase C. Distribuições existentes
continuam no contrato durante a transição, mas deixam de ser os indicadores principais da tela.

- % de tarefas em cada estado (todos os projetos e colaboradores); soma = 100% (o arredondamento distribui a sobra no maior resto).
- Por colaborador: nº de tarefas (de que participa), distribuição por estado, % concluído.

### 6.6 Bandeja: listas

- Recentes: tarefas de que participo, `updated_at` desc.
- Frequentes: tarefas de que participo, `task_opens.last_opened_at` desc. Abrir o detalhe (bandeja ou painel) registra abertura.
- Busca: título e nome do projeto, sem diferenciar acentos nem maiúsculas.

---

## 7. Contrato da API (`packages/contract`)

Cada método tem schema zod de entrada e saída. Nomes = canais IPC.

| Grupo               | Métodos                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session`           | `getCurrent()`, `switchUser(userId)` (só no MVP), `listUsers()`                                                                                                                                                                                                                                                              |
| `users`             | `setDefaultRate({ userId, rateCents })` (o próprio ou gestor)                                                                                                                                                                                                                                                                |
| `projects`          | `list()`, `create({ name })` (devolve existente se repetido), `listMembers(projectId)`, `addMember`, `removeMember`                                                                                                                                                                                                          |
| `tasks`             | `listBoard({ projectId?, forUserId? })` ("Minhas tarefas"), `listTeamBoard({ projectId? })` (Equipe, somente leitura), `get(taskId)` (com `canEdit`), `create({ projectId, title })`, `update({ taskId, changes })`, `move({ taskId, status })`, `listRecent()`, `listFrequent()`, `search({ query })`, `recordOpen(taskId)` |
| `participations`    | `add({ taskId, participant: { kind: 'user', userId } \| { kind: 'contributor', contributorId }, role })`, `remove`, `setHours`, `setRate`                                                                                                                                                                                    |
| `contributors`      | `list()`, `create({ name })`, `setDefaultRate`                                                                                                                                                                                                                                                                               |
| `timeline`          | `list(taskId)` (textos já gerados para o viewer)                                                                                                                                                                                                                                                                             |
| `dashboard`         | `get()`                                                                                                                                                                                                                                                                                                                      |
| `meetings`          | `list({ month })`, `listUpcoming()`, `create`, `update`, `delete`                                                                                                                                                                                                                                                            |
| eventos             | `onChanges(callback)`: `{ kind: 'task'                                                                                                                                                                                                                                                                                       | 'project' | 'meeting' | 'contributor', ids }` |
| janela (só desktop) | `window.minimize/close/toggleTray/openPanel/setTrayHeight` (fora do `AgileBoxApi`, em `DesktopShellApi`)                                                                                                                                                                                                                     |

DTOs de saída **já vêm filtrados** pela política: valores em R$ ausentes (`null`) quando o ator não pode vê-los.

---

## 8. Estratégia de testes

| Camada                | Tipo                                                                                                                          | Ferramentas                                   | Meta                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `core`                | unidade, tabelas de casos                                                                                                     | Vitest                                        | ≥ 95% de linhas; toda regra do HANDOFF com teste nomeado em pt-BR                                    |
| `application`         | casos de uso com **fakes em memória** das portas e `FixedClock`                                                               | Vitest                                        | ≥ 90%; toda regra de permissão tem caso "permitido" e "negado"; toda edição verifica o evento gerado |
| `application/testing` | **suíte de contrato dos repositórios** (mesmos testes rodam no fake e no SQLite), incluindo **isolamento entre organizações** | Vitest                                        | garante que trocar o adaptador não muda o comportamento                                              |
| `infra-sqlite`        | integração com SQLite **em memória**; migrações do zero; transação desfaz tudo em erro                                        | Vitest                                        | suíte de contrato 100% verde                                                                         |
| `contract`            | schemas aceitam/rejeitam os casos de borda (vírgula, vazio, IDs inválidos)                                                    | Vitest                                        |                                                                                                      |
| `desktop/main`        | handlers IPC: validação, injeção do ator, conversão de erros                                                                  | Vitest com UseCases fake                      |                                                                                                      |
| `ui` e renderer       | componentes e acessibilidade (papéis, `aria-*`, teclado, foco do modal)                                                       | Vitest + jsdom + Testing Library + user-event | componentes base 100% dos estados do HANDOFF                                                         |
| ponta a ponta         | fluxos críticos no Electron real, banco temporário                                                                            | Playwright `_electron`                        | 1 fluxo por marco a partir do M6                                                                     |

Utilitários de teste: `builders` (ex.: `aTask().inProject(p).ownedBy(u).build()`), `FixedClock`, `SequentialIdGenerator`, `seedTestDb()`.
Comandos (definidos no M1): `pnpm test`, `pnpm test:watch`, `pnpm test:e2e`, `pnpm coverage`.

---

## 9. Marcos e metas

Tamanho: P (uma ou duas sessões), M (algumas sessões), G (várias sessões). Cada marco é dividido em passos pequenos, explicados antes e revisados depois.

### M0 · Documentação e decisões · P

- **Meta**: decisões registradas e plano aprovado.
- **Entregas**: `docs/PLANO.md`, `docs/MVP.md` atualizado, `CLAUDE.md` com stack e regras atualizadas.
- **Pronto quando**: o Pedro revisou e respondeu à seção 2.

### M1 · Esqueleto do monorepo · P

- **Meta**: estrutura de pacotes e ferramentas funcionando, sem regra de negócio.
- **Entregas**: arquivos de raiz (`package.json`, `pnpm-workspace.yaml` com `allowBuilds` para `better-sqlite3`, `electron` e `esbuild` (no pnpm 11+ `onlyBuiltDependencies` é ignorado) e `strictDepBuilds: false`, `.npmrc`, `tsconfig.base.json`, `eslint.config.js` com fronteiras, `.prettierrc`, `vitest.config.ts`, `.editorconfig`, `.gitignore`); cada pacote com `package.json`, `tsconfig.json`, `src/index.ts`; um teste trivial no `core`.
- **Testes**: `pnpm test`, `pnpm lint`, `pnpm typecheck` e `pnpm format:check` passam.
- **Pronto quando**: os quatro comandos ficam verdes, e o lint **falha** se o renderer importar `infra-sqlite` (verificado com um import proposital, depois removido). Seção "Convenções" do `CLAUDE.md` preenchida.

### M2 · Domínio (`packages/core`) · M

- **Meta**: todas as regras de negócio puras, testadas, sem banco e sem tela.
- **Entregas**: valores (`TaskStatus`, `Money`, `Hours`, `DateOnly`, `Ticket`, IDs), entidades (`User`, `Contributor`, `Project`, `Task`, `Participation`, `TimelineEvent`, `Meeting`), `AccessPolicy`, regras (`cost`, `deadline-label`, `timeline`, `dashboard`), erros.
- **Testes**: tabelas de casos para custo (vírgula, arredondamento), prazo (todas as frases e virada do dia), matriz de acesso 6.1 completa, `diffTask` por tipo de evento, `describeEvent` com e sem permissão de ver R$, dashboard somando 100%.
- **Pronto quando**: cobertura ≥ 95% e o Pedro revisou a matriz de acesso nos testes.

### M3 · Aplicação + contrato (`packages/application`, `packages/contract`) · G

- **Meta**: todos os casos de uso do MVP funcionando contra fakes em memória.
- **Entregas**: portas (repositórios, `UnitOfWork`, `Clock`, `IdGenerator`, `ChangeNotifier`), casos de uso (seção 10), mappers entidade → DTO (com filtro de R$), `createUseCases`, fakes, builders, suíte de contrato dos repositórios, schemas zod e `AgileBoxApi`.
- **Testes**: cada caso de uso tem: sucesso, permissão negada, entrada inválida, eventos gravados e notificação publicada.
- **Pronto quando**: ≥ 90% de cobertura e um "roteiro" em teste reproduz o fluxo do protótipo (criar projeto → criar tarefa → mover → adicionar envolvido → ajustar horas → gestor edita → linha do tempo correta).

### M4 · Banco SQLite (`packages/infra-sqlite`) · M

- **Meta**: dados persistem de verdade.
- **Entregas**: schema Drizzle, migração inicial, cliente com pragmas, `SqliteUnitOfWork`, repositórios, seed com dados do protótipo (organização "AgileBox Demo"; Pedro, Colaborador 2–4, Gestor; Projetos A, B, C; R$ 45/h; agendamentos de exemplo; duas entidades de exemplo), scripts `db:generate`, `db:migrate`, `db:seed`, `db:reset`.
- **Testes**: suíte de contrato contra SQLite em memória; migração do zero; transação faz rollback se um evento falhar.
- **Spike**: `better-sqlite3` compilado para Node (testes) e para Electron (app) sem conflito (ver risco R2).
- **Pronto quando**: a suíte de contrato passa idêntica no fake e no SQLite.

### M5 · Shell Electron + UI base + spike de vidro · G

- **Meta**: o app abre no Linux e no Windows, lê o banco e mostra as tarefas do seed com o visual base.
- **Entregas**:
  - main: `index.ts`, `composition-root.ts`, `actor-session.ts`, `ipc/` (registro, validação, erros), `ipc-change-notifier.ts`, `windows/` (painel e bandeja básicos), `paths.ts`.
  - preload: ponte tipada.
  - renderer/shared: `ipc-client`, `ApiProvider`, `QueryProvider`, chaves e hooks de dados, invalidação por `onChanges`, formatadores pt-BR.
  - `packages/ui`: tokens, fonte Inter local, reduced motion, foco visível, e os componentes base (`GlassSurface`, `WindowControls`, `SegmentedControl`, `Button`, `IconButton`, `GroupedList`/`FieldRow`, `StatusChip`, `StatusMenu`, `Toast`, `Modal`, `Tooltip`, `Avatar`, `Skeleton`, `ReadOnlyBadge`, campos).
  - Página `dev/gallery` (só em desenvolvimento) mostrando todos os componentes e estados.
- **Spike de vidro no Windows 11** (risco R1): comparar Acrylic nativo e vidro só em CSS para a bandeja (altura animada, cantos de 22 px). Resultado registrado em `docs/decisoes/0001-vidro.md`.
- **Testes**: handlers IPC; componentes base (papéis ARIA, teclado, reduced motion).
- **Pronto quando**: o Painel abre, lista as tarefas do seed vindas do SQLite, e uma edição de título feita na Bandeja aparece no Painel sem recarregar.

### M6 · Painel: kanban e detalhe (Fase 2 do MVP) · G

- **Meta**: usar o painel no dia a dia como colaborador.
- **Entregas**: `Rail` (recolher/expandir, Plug-ins "em breve"), `TitleBar` (segmentado estático, "Nova tarefa"), `BoardView` (todas as tarefas de que participo + filtro por projeto), `KanbanColumn`/`TaskCard` com dnd-kit e alternativa por teclado, `ProjectTitle` + `ProjectDialog` (lista, "Todos os projetos", criar), `TaskDetailView` com cards Detalhes (título, descrição, responsável, chamado), Prazo, Custo, Envolvidos (com `ContributorPicker` e "Criar entidade"), Linha do tempo; salvar ao sair do campo; estados vazios.
- **Testes**: componentes (arrastar muda estado; blur grava uma vez; custo recalcula ao digitar); E2E: criar tarefa → mover → editar → fechar e reabrir → dados e linha do tempo persistem.
- **Pronto quando**: o critério do MVP vale para o painel inteiro.

### M7 · Permissões e gestor (Fase 3) · M

- **Meta**: o gestor acompanha o time; o colaborador não vê o que não deve.
- **Entregas**: `AccountMenu` (troca de perfil de demonstração), item Dashboard só para gestor, `DashboardView` (`StackedBar`, `StatCard`, `CollaboratorTable`), "Abrir projetos" → quadro do colaborador com `ManagerBanner` ("Tarefas de X · editando como Gestor" + "Voltar às minhas"), marca Gestor na linha do tempo, valores em R$ escondidos para colaborador, `ProjectMembersDialog` (ver 12.1).
- **Testes**: E2E com troca de perfil: colaborador não vê R$ nem Dashboard; gestor edita e o evento aparece marcado.
- **Pronto quando**: a matriz 6.1 vale na tela, e não só na API.

### M8 · Agenda (Fase 4) · M

- **Meta**: gestor marca agendamentos; todos veem.
- **Entregas**: `AgendaView`, `Calendar` (6×7, começa no domingo, hoje, selecionado, fora do mês, até 2 eventos + "+N mais"), `UpcomingList`, `MeetingForm` (expande no lugar, criar/editar/excluir, participantes), estado desabilitado para colaborador.
- **Testes**: geração da grade do mês (viradas de ano, meses de 28 a 31 dias), formulário, permissões; E2E criar → editar → excluir.
- **Pronto quando**: os agendamentos persistem e o colaborador vê a mensagem "Só o gestor cria e edita agendamentos."

### M9 · Bandeja (Fase 5) · G

- **Meta**: atualizar ou criar uma tarefa em poucos cliques.
- **Entregas**: máquina de telas (início → atualizar/detalhe, início → nova → detalhe), `SearchField`, segmentado Recentes | Frequentes, `TaskRow` (destaque de nova/atualizada), `UpdateTaskScreen` (o que será feito, status, prazo, responsável, envolvidos, chamado), `NewTaskScreen` (título + projeto), toasts, altura automática pela fórmula do HANDOFF, `ResizeHandle` (arrastar, setas em passos de 24 px, Home/duplo clique volta ao automático), controles de janela (minimizar recolhe, expandir abre o painel, fechar deixa o botão redondo).
- **Testes**: fórmula da altura; busca com acentos; ordem de Recentes e Frequentes; E2E: criar pela bandeja e ver no painel.
- **Pronto quando**: o fluxo inteiro da bandeja funciona e sincroniza com o painel aberto.

### M10 · Empacotar para Windows (Fase 6) · M

- **Meta**: instalar no Windows 11 e usar como um app de verdade.
- **Entregas**: ícone de bandeja (clique abre/fecha a bandeja; menu com "Abrir painel" e "Sair"), instância única, janelas sem moldura, bandeja ancorada no canto inferior direito da área útil (respeitando a barra de tarefas e vários monitores), vidro conforme a decisão do M5, banco em `%APPDATA%/AgileBox`, migrações ao iniciar, `electron-builder` (NSIS), ícones.
- **Testes**: checklist manual no Windows 11 (`docs/checklist-windows.md`) + E2E de inicialização com banco novo e com banco existente.
- **Pronto quando**: o Pedro instala, usa, reinicia o Windows e encontra os dados.

---

## 10. Estrutura de arquivos

```
agilebox/
├── package.json                 scripts da raiz: dev, build, test, test:e2e, lint, typecheck, format, db:*
├── pnpm-workspace.yaml          declara apps/* e packages/*
├── .npmrc                       node-linker=hoisted (exigência do electron-builder)
├── tsconfig.base.json           TS strict compartilhado
├── eslint.config.js             regras + fronteiras entre camadas (tabela 3.1)
├── .prettierrc / .editorconfig / .gitignore
├── vitest.config.ts             projetos de teste de cada pacote
├── CLAUDE.md / AGENTS.md
├── docs/
│   ├── MVP.md · HANDOFF.md · PLANO.md
│   ├── decisoes/                registros curtos de decisão (ex.: 0001-vidro.md)
│   └── checklist-windows.md     verificação manual do M10
├── design/                      protótipos (só referência)
│
├── packages/
│   ├── core/src/
│   │   ├── index.ts                         exportações públicas
│   │   ├── shared/ids.ts                    tipos marcados: UserId, TaskId, ProjectId…
│   │   ├── shared/errors.ts                 DomainError, ValidationError, PermissionDeniedError, NotFoundError
│   │   ├── values/task-status.ts            os 5 estados em ordem, rótulos pt-BR, validação
│   │   ├── values/money.ts                  centavos: parse com vírgula, soma, formatação BRL
│   │   ├── values/hours.ts                  centésimos de hora: parse com vírgula, formatação
│   │   ├── values/date-only.ts              data sem hora: comparar, diferença em dias, hoje local
│   │   ├── values/ticket.ts                 ID do chamado + link opcional (valida URL)
│   │   ├── values/role.ts                   collaborator | manager; ParticipationRole
│   │   ├── entities/organization.ts         organização (base do multiempresa)
│   │   ├── entities/user.ts                 usuário, iniciais, valor/hora padrão
│   │   ├── entities/contributor.ts          entidade (stakeholder): nome, origem, valor/hora padrão
│   │   ├── entities/project.ts              projeto, normalização do nome
│   │   ├── entities/task.ts                 tarefa: renomear, mudar estado, prazo, chamado, responsável
│   │   ├── entities/participation.ts        envolvimento: usuário OU entidade, papel, horas, valor copiado
│   │   ├── entities/timeline-event.ts       tipos de evento e payloads
│   │   ├── entities/meeting.ts              agendamento e validação de data/hora
│   │   ├── policies/actor.ts                Actor { userId, organizationId, role }
│   │   ├── policies/access-policy.ts        matriz 6.1 (canViewTask, canEditTask, canSeeRates…)
│   │   ├── rules/cost.ts                    subtotal e total
│   │   ├── rules/deadline-label.ts          frases do prazo
│   │   ├── rules/timeline.ts                diffTask e describeEvent
│   │   └── rules/dashboard.ts               porcentagens e estatísticas por colaborador
│   │   (cada arquivo com seu *.test.ts ao lado)
│   │
│   ├── contract/src/
│   │   ├── index.ts
│   │   ├── api.ts                           interface AgileBoxApi (seção 7)
│   │   ├── shell-api.ts                     DesktopShellApi (controles de janela)
│   │   ├── channels.ts                      nomes dos canais IPC (iguais aos métodos)
│   │   ├── result.ts                        envelope { ok, data } | { ok:false, error }
│   │   ├── errors.ts                        códigos de erro e ApiError
│   │   ├── changes.ts                       tipo do evento onChanges
│   │   └── schemas/                         zod por grupo: session, projects, tasks, participations,
│   │                                        contributors, timeline, dashboard, meetings
│   │
│   ├── application/src/
│   │   ├── index.ts                         createUseCases + tipos
│   │   ├── deps.ts                          AppDeps: todas as portas que o app precisa
│   │   ├── create-use-cases.ts              DI manual: monta cada caso de uso com suas portas
│   │   ├── ports/
│   │   │   ├── task-repository.ts · project-repository.ts · contributor-repository.ts
│   │   │   ├── participation-repository.ts · timeline-repository.ts · task-open-repository.ts
│   │   │   ├── meeting-repository.ts · user-repository.ts
│   │   │   ├── unit-of-work.ts              run(fn) em transação, com repositórios transacionais
│   │   │   ├── clock.ts · id-generator.ts · change-notifier.ts
│   │   ├── use-cases/
│   │   │   ├── session/                     get-current-actor, switch-user, list-users
│   │   │   ├── users/                       set-default-rate
│   │   │   ├── projects/                    list-projects, create-project, list/add/remove-member
│   │   │   ├── tasks/                       list-board, list-team-board, get-task-detail, create-task, update-task,
│   │   │   │                                move-task, list-recent, list-frequent, search-tasks, record-open
│   │   │   ├── participations/              add, remove, set-hours, set-rate
│   │   │   ├── contributors/                list, create, set-default-rate
│   │   │   ├── timeline/                    list-timeline (texto gerado por viewer)
│   │   │   ├── dashboard/                   get-dashboard
│   │   │   └── meetings/                    list-month, list-upcoming, create, update, delete
│   │   ├── mappers/                         entidade → DTO do contrato (aplica filtro de R$)
│   │   └── testing/                         exportado só para testes:
│   │       ├── fakes/                       repositórios em memória, FixedClock, SequentialIdGenerator,
│   │       │                                RecordingNotifier
│   │       ├── builders.ts                  construtores de dados de teste
│   │       └── repository-contract.ts       suíte de contrato reaproveitada pelo infra-sqlite
│   │
│   ├── infra-sqlite/
│   │   ├── drizzle.config.ts
│   │   ├── migrations/                      SQL gerado pelo drizzle-kit (versionado)
│   │   └── src/
│   │       ├── index.ts                     createSqliteAdapters(dbPath) → portas
│   │       ├── client.ts                    abre o banco, pragmas, aplica migrações
│   │       ├── schema/                      tabelas Drizzle (seção 5), um arquivo por agregado
│   │       ├── mappers/                     linha ↔ entidade
│   │       ├── repositories/                implementações das portas
│   │       ├── unit-of-work.ts              transação do better-sqlite3
│   │       ├── seed/seed.ts · seed/data.ts  dados de exemplo do protótipo
│   │       └── scripts/                     migrate, seed, reset (para os comandos db:*)
│   │
│   └── ui/src/
│       ├── index.ts
│       ├── styles/tokens.css                variáveis do HANDOFF (cores, raios, espaços, tipografia, ease-ios)
│       ├── styles/base.css                  reset, fonte, foco visível, barra de rolagem de 3 px
│       ├── styles/motion.css                animações nomeadas + prefers-reduced-motion
│       ├── styles/fallback.css              sem backdrop-filter → fundo sólido
│       ├── fonts/                           Inter (woff2, local: app funciona offline)
│       ├── icons/                           ícones SVG como componentes
│       ├── hooks/                           useReducedMotion, useFocusTrap, useRestoreFocus
│       └── components/                      GlassSurface, WindowControls, SegmentedControl, Button,
│                                            IconButton, GroupedList, FieldRow, TextField, TextArea,
│                                            DateField, NumberField, StatusChip, StatusMenu, Toast(+useToast),
│                                            Modal, Tooltip, Avatar, Skeleton, ReadOnlyBadge, EmptyState
│                                            (cada um com .module.css e .test.tsx)
│
└── apps/
    ├── server/
    │   └── README.md                        o que vai morar aqui no pós-MVP (API HTTP, login, Postgres)
    │
    └── desktop/
        ├── electron.vite.config.ts          build de main, preload e as duas páginas do renderer
        ├── electron-builder.yml             instalador NSIS para Windows (M10)
        ├── resources/                       ícones do app e da bandeja
        ├── e2e/                             testes Playwright (_electron) + helpers de banco temporário
        └── src/
            ├── main/
            │   ├── index.ts                 ciclo de vida, instância única, inicialização
            │   ├── composition-root.ts      ÚNICO lugar que liga portas às implementações
            │   ├── paths.ts                 caminho do banco (userData) e do banco de teste
            │   ├── actor-session.ts         ator atual no MVP (persistido em local_settings)
            │   ├── ipc/register-handlers.ts liga cada canal a um caso de uso
            │   ├── ipc/handle.ts            valida com zod, injeta o ator, converte erros
            │   ├── ipc/change-broadcaster.ts implementação do ChangeNotifier: envia para as janelas
            │   ├── windows/window-manager.ts cria, mostra e alterna Painel e Bandeja
            │   ├── windows/panel-window.ts  janela do painel
            │   ├── windows/tray-window.ts   janela da bandeja: posição, altura, vidro
            │   └── tray/tray-icon.ts        ícone na área de notificação e menu (M10)
            ├── preload/
            │   └── index.ts                 contextBridge: expõe AgileBoxApi + DesktopShellApi
            └── renderer/
                ├── shared/
                │   ├── api/ipc-client.ts    implementa AgileBoxApi sobre window.agilebox
                │   ├── api/ApiProvider.tsx  DI do cliente (contexto React); testes injetam fake
                │   ├── query/QueryProvider.tsx · keys.ts · use-*.ts (hooks por recurso)
                │   ├── query/sync-changes.ts onChanges → invalidar queries
                │   ├── session/useActor.ts  ator atual e capacidades (canSeeRates…)
                │   ├── lib/format-date.ts   "Qui, 05 nov", "há 12 min" (date-fns pt-BR)
                │   ├── lib/calendar-grid.ts grade 6×7 começando no domingo
                │   └── testing/fake-api.ts  AgileBoxApi falso para testes de componentes
                ├── panel/
                │   ├── index.html · main.tsx · App.tsx · copy.ts
                │   ├── layout/              Rail, RailItem, TitleBar, AccountMenu, PanelShell
                │   ├── board/               BoardView, KanbanColumn, TaskCard, ProjectTitle,
                │   │                        ProjectDialog, ProjectMembersDialog, ManagerBanner
                │   ├── task-detail/         TaskDetailView, DetailsCard, DeadlineCard, CostCard,
                │   │                        ParticipantsCard, ContributorPicker, CreateContributor,
                │   │                        TimelineCard, useBlurSave
                │   ├── dashboard/           DashboardView, StackedBar, StatCard, CollaboratorTable
                │   ├── agenda/              AgendaView, Calendar, DayCell, UpcomingList, MeetingForm
                │   └── dev/Gallery.tsx      vitrine de componentes (só em desenvolvimento)
                └── tray/
                    ├── index.html · main.tsx · App.tsx · copy.ts
                    ├── tray-machine.ts      telas e transições (início, atualizar, nova)
                    ├── auto-height.ts       fórmula de altura do HANDOFF (testada)
                    ├── screens/             HomeScreen, UpdateTaskScreen, NewTaskScreen
                    └── components/          SearchField, TaskRow, TaskList, ResizeHandle, ClosedTrayButton
```

---

## 11. Riscos e mitigação

| #   | Risco                                                                                                                                                                                                                                                           | Mitigação                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Vidro na bandeja.** O Acrylic nativo vale para o retângulo inteiro da janela; animar a altura exige redimensionar a janela quadro a quadro (pode tremer), e os cantos de 22 px não são nativos. O vidro em CSS anima liso, mas não desfoca o desktop por trás | Spike no M5 no Windows 11 com 2 protótipos: (a) Acrylic nativo + redimensionar; (b) janela transparente na altura máxima + vidro CSS animado por dentro, com cliques passando pela área vazia. Decisão registrada antes do M9 |
| R2  | `better-sqlite3` é nativo: os testes rodam em Node e o app em Electron (versões de ABI diferentes)                                                                                                                                                              | Recompilar para Electron só no build/dev do app (`electron-builder install-app-deps`) e manter o Node para o Vitest; alternativa: rodar os testes com `ELECTRON_RUN_AS_NODE`. Validado no M4                                  |
| R3  | pnpm + Electron (links simbólicos quebram o empacotamento)                                                                                                                                                                                                      | `node-linker=hoisted` no `.npmrc` desde o M1                                                                                                                                                                                  |
| R4  | Arrastar no kanban sem acessibilidade                                                                                                                                                                                                                           | dnd-kit com sensores de teclado + mudar estado pelo detalhe                                                                                                                                                                   |
| R5  | Escopo crescer (Equipe, plug-ins, login)                                                                                                                                                                                                                        | Seção 13 e "Fora do MVP" do `CLAUDE.md`; qualquer item novo entra na seção 12 antes de virar código                                                                                                                           |
| R6  | Vazar valor/hora para colaborador                                                                                                                                                                                                                               | Filtro no mapper da aplicação (não na tela), eventos sem texto pronto, testes de permissão no M3 e E2E no M7                                                                                                                  |

---

## 12. Decisões ainda em aberto

Não bloqueiam os marcos M1 a M5.

12.1 **Tela de membros do projeto** (antes do M7): não existe no design. Proposta: no `ProjectDialog`, um botão "Membros" visível para o criador e o gestor, abrindo uma lista com adicionar/remover.
12.2 **Reordenar cards dentro da coluna** (antes do M6): o protótipo reordena ou só muda o estado? Proposta: só muda o estado; ordem por `updated_at`.
12.3 **Ajustes** (antes do M6): o item existe na barra lateral, mas não tem conteúdo definido. Proposta: placeholder "em breve".
12.4 **Gestor no dashboard** (antes do M7): o gestor aparece na tabela por colaborador se tiver tarefas?
12.5 **Participantes do agendamento** (antes do M8): só usuários, ou também entidades sem conta?
12.6 **Carregando / erro / offline** (antes do M6): o HANDOFF pede esqueleto e mensagem curta, para confirmar com o Pedro.
12.7 **Iniciar com o Windows** (antes do M10): a bandeja abre sozinha ao ligar o computador?

---

## 13. Pós-MVP (ordem sugerida, não implementar agora)

0. **Multiempresa (SaaS)**: cadastro de organizações, convites, troca de organização, cobrança. O modelo já está preparado (3.6).
1. **Servidor**: `apps/server` (API HTTP sobre o mesmo `application`), `packages/infra-postgres` (passa na mesma suíte de contrato), adaptador `http-client` no renderer, migração dos dados locais.
2. **Login**: Google, Microsoft (Entra ID), manual; tabela `auth_identities`; fluxo OAuth com PKCE pelo navegador do sistema; o ator passa a vir do token.
3. **Visão Equipe**: tarefas do projeto em somente leitura (a regra 2.5 já existe).
4. **Entidades do Azure AD**: importar funcionários como `contributors` com `source = azure`.
5. **Plug-ins**: GLPI, Azure DevOps, webhooks de commit, caixa de pendências, aviso de atualização.
6. **Aviso diário**.
