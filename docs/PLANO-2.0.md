# AgileBox 2.0 — Plano de entregas por camadas e marcos

Nov 1, 2026 · @pedro

## Resumo

A ordem de entrega muda em relação à arquitetura 2.0: primeiro as funcionalidades (níveis de proficiência, ferramentas escolhidas pela equipe e Scrum), depois o servidor central, e por último o executor de comandos, o MCP e a IA local. Banco central (PostgreSQL próprio, em Docker por enquanto), MCP interno, Laya local e modelos trocáveis já estão decididos, e login e e-mail ficam no código, sem serviço externo. Uma camada nova de autenticação e multi-tenant separa os dados de cada time.

Quatro princípios guiam a priorização:

- **Funcionalidade antes de infraestrutura, mas sempre pelas portas.** Sprints, backlog, check-ins e módulos entram por `packages/core` e `packages/application`, com repositórios atrás das portas existentes. Trocar o SQLite pelo banco central depois não reescreve casos de uso.
- **Três filtros independentes.** Ferramentas da equipe decidem o que existe; o nível de proficiência decide o que aparece; a permissão decide o que cada pessoa pode fazer. Nenhum substitui o outro, e todos vêm depois de saber quem é a pessoa e de qual time ela fala.
- **MCP e IA por último.** Eles só expõem ferramentas que os três filtros já liberam, então dependem de tudo que vem antes estar estável.
- **Testes completos no final, com um portão mínimo por marco.** A bateria integrada, E2E, de segurança, IA e desempenho fica para a Onda 4, logo após o M9. Cada marco fecha só com testes unitários do domínio que ele criou, porque o resolvedor de dependências e as regras de sprint são baratos de testar agora e caros de depurar quando o servidor e a IA estiverem em cima.

## Mapa de camadas

O sistema fica em sete camadas, e a do meio é um bloco de três filtros. Há duas camadas novas: identidade e time, logo abaixo da entrada, e ferramentas da equipe, que abre o bloco de filtros ao lado do nível e da permissão.

&#91;embedded content: camadas do AgileBox 2.0 · 7 camadas, 3 filtros\]

A IA e o MCP ficam acima do executor e nunca tocam o domínio direto: tudo que chega por eles passa pela mesma identidade e pelos mesmos três filtros que um clique no painel.

Como os filtros se combinam:

| Filtro                | Pergunta que responde                  | Quem define                           | Onde é verificado              | Se falhar                                  |
| --------------------- | -------------------------------------- | ------------------------------------- | ------------------------------ | ------------------------------------------ |
| Ferramentas da equipe | Essa ferramenta existe para este time? | Gestor propõe, equipe aceita (ADR-05) | Backend (guard no caso de uso) | Recusa a ação; a tela nem mostra a entrada |
| Nível de proficiência | Essa tela aparece para esta pessoa?    | Equipe (ADR-06)                       | Interface                      | Esconde a tela; os dados continuam lá      |
| Permissão             | Esta pessoa pode fazer isso?           | Papel na organização e no projeto     | Backend                        | Recusa a ação                              |

Uma consequência importante: um módulo desativado não aparece em nenhum nível, e um nível alto não ativa nada que a equipe não escolheu.

## Camada nova: ferramentas da equipe

A equipe escolhe quais ferramentas usa a partir de um catálogo fixo no código. O sistema garante que nenhuma fique sem aquilo de que depende e que duas conflitantes nunca estejam ativas juntas. Isso não substitui os níveis: o nível decide o que aparece, a ferramenta decide o que existe.

&#91;embedded content: catálogo de ferramentas · 14 módulos e suas dependências\]

O Núcleo é o único obrigatório; Burndown/velocity é o caso mais exigente, porque precisa de Sprints e de alguma Estimativa ao mesmo tempo. O catálogo é uma proposta inicial; mudar uma seta é mudar uma linha no registro.

### Regras

1. **Ativar puxa as dependências.** Ativar Sprints com Backlog desligado oferece ativar os dois numa confirmação só.
2. **Desativar é bloqueado enquanto alguém depende.** Desligar Backlog com Sprints ativo mostra quem depende e oferece desligar os dois.
3. **Conflitos são exclusivos.** Estimativa em horas e em pontos não coexistem; trocar exige converter ou arquivar as estimativas antigas. Pelo ADR-07 só horas existe hoje; pontos fica como módulo futuro, e o par serve de caso de teste do conflito.
4. **O catálogo não tem ciclo.** Um teste roda a cada build e falha se uma dependência circular for criada.
5. **Desativar esconde, nunca apaga.** Reativar devolve sprints, check-ins e estimativas como estavam.
6. **O backend aplica a regra.** Cada caso de uso declara seu módulo; um guard recusa a chamada se o módulo estiver desligado, venha ela do painel, do chat ou do MCP.
7. **Toda mudança é auditada.** Quem ligou ou desligou, quando e o que mudou.

### Como convive com os níveis

- Cada módulo declara o nível mínimo das suas telas. A tela aparece se o módulo está ativo **e** o nível da pessoa alcança o mínimo.
- Efeitos passivos aparecem em qualquer nível: no time com Sprints, quem está no Básico vê "Sprint 4" no card, sem a tela de planejamento.
- Se a equipe ativa um módulo acima do nível do projeto, o sistema avisa: "Sprints aparece a partir do Intermediário. Subir o nível do projeto?"

### Mudar ferramentas sem quebrar o que está em andamento

O gestor propõe e a equipe aceita. A mudança só vale depois do aceite e roda em etapas, para que nenhuma tarefa, item de backlog ou sprint em andamento fique órfão.

1. **Proposta com prévia de impacto.** Antes de enviar, o sistema calcula o que a mudança afeta: quantos itens de backlog, tarefas em sprint ativa, check-ins e impedimentos abertos dependem de cada módulo envolvido.
2. **Aceite da equipe.** Os membros recebem a proposta com a prévia. Regra inicial sugerida: maioria simples dos membros, prazo configurável e silêncio que não conta como aceite. Proponente, votos e prazo ficam na auditoria.
3. **Ativar é imediato.** Ligar um módulo e suas dependências só acrescenta; nada existente muda.
4. **Desativar é gradual.** O módulo passa para o estado _encerrando_: não aceita itens novos, e o que já existe segue visível e editável até terminar (a sprint fecha, os impedimentos são resolvidos). Só então ele vira _desativado_. O gestor pode antecipar escolhendo antes o destino de cada tipo de item, por exemplo tarefas da sprint voltando ao Kanban como estão. Nada é apagado.
5. **Tudo é reversível.** Reativar um módulo devolve os dados como estavam.

No código, o módulo ganha três estados (`active`, `winding_down`, `disabled`) e a proposta ganha um fluxo próprio (`draft`, `proposed`, `accepted` ou `rejected`, `applied`), guardado na tabela `module_change_proposals`. O guard de módulo trata `winding_down` como "só o que já existe".

Na Onda 1 há uma máquina e um usuário real, então o M2 entrega a prévia de impacto, o encerramento gradual e a aplicação direta pelo gestor. O aceite entre pessoas liga no M6b, quando há login e vários usuários; até lá, a regra de aceite é testada no domínio com votos simulados.

### Presets para começar

O preset só pré-seleciona ferramentas; a equipe ajusta depois, sempre passando pelas regras acima.

| Preset           | Ferramentas ativadas                                                                            | Nível sugerido |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------- |
| Kanban simples   | Núcleo, Agenda                                                                                  | Básico         |
| Scrum            | Kanban simples + Backlog, Sprints, Check-ins, Impedimentos, Estimativas, Critérios de aceitação | Intermediário  |
| Kanban com fluxo | Kanban simples + Limites de WIP, Subtarefas/dependências, Métricas de fluxo                     | Avançado       |
| Scrum completo   | Scrum + Review e retro, Burndown/velocity                                                       | Avançado       |

### Contrato sugerido

O catálogo vive no código (`packages/core/src/modules/registry.ts`), versionado com o app. Só a seleção de cada equipe vai para o banco, numa tabela `team_modules` (escopo, módulo, ativo, configuração, alterado por e em) que estende o `team_preferences` da 2.0.

```typescript
type ModuleId =
  | 'core'
  | 'agenda'
  | 'backlog'
  | 'sprints'
  | 'checkins'
  | 'impediments'
  | 'estimates.hours'
  | 'estimates.points'
  | 'acceptance'
  | 'wip'
  | 'subtasks'
  | 'integrations'
  | 'flowMetrics'
  | 'reviewRetro'
  | 'burndown'

interface ModuleDefinition {
  id: ModuleId
  requires: ModuleId[] // todas precisam estar ativas
  requiresAnyOf?: ModuleId[][] // ex.: burndown exige horas OU pontos
  conflicts?: ModuleId[]
  minLevel: ExperienceLevel // nível mínimo das telas do módulo
  core?: boolean // não pode ser desativado
}

type Resolution =
  | { ok: true; enabled: ModuleId[]; autoEnabled: ModuleId[] }
  | { ok: false; conflicts: [ModuleId, ModuleId][]; blockedBy: ModuleId[] }

// Funções puras em packages/core — testáveis sem banco nem UI
declare function resolveModuleSet(
  current: ModuleId[],
  change: { enable?: ModuleId[]; disable?: ModuleId[] },
): Resolution

declare function effectiveCapabilities(input: {
  modules: ModuleId[]
  level: ExperienceLevel
  role: Role
}): Capability[]
```

## Camada nova: autenticação e multi-tenant

Todo pedido primeiro descobre quem é a pessoa e de qual time ela fala; só depois passa pelos três filtros. A recomendação é um único banco PostgreSQL com isolamento por time (`tenant_id` e RLS), deixando aberto o caminho para um banco dedicado quando um time exigir. Aqui, "time" é o mesmo `organizationId` que a 2.0 já pede em toda entidade; vale confirmar que organização e time são a mesma coisa.

### Quanto separar: três modelos de isolamento

| Modelo                            | Como separa                                                          | Isolamento                                     | Custo operacional                                         | Quando escolher                                  |
| --------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| A · Um banco, `tenant_id` com RLS | Toda tabela carrega o time e o Postgres filtra por linha             | Lógico, imposto pelo banco                     | Baixo: uma migração serve a todos                         | Padrão recomendado; vários times pequenos        |
| B · Um schema por time            | Cada time tem seu schema no mesmo banco                              | Maior, no mesmo servidor                       | Médio: a migração roda N vezes e o código roteia o schema | Poucos times com dados bem distintos             |
| C · Um banco PostgreSQL por time  | Cada time tem seu próprio banco; a identidade fica num banco central | Total, incluindo backup e restauração por time | Alto: N bancos e migração em todos                        | Time com exigência contratual ou de conformidade |

A recomendação é o modelo A agora, porque o RLS faz o próprio banco recusar linhas de outro time mesmo que o código do servidor tenha um erro. Se "separar o banco" for requisito duro desde o início, a escolha é o C, e o custo é real: a migração precisa rodar em todos os bancos e é preciso um banco central só para identidade e para o mapa de time para banco; quem participa de dois times continua com uma conta só.

Para que o C continue possível sem reescrever nada, todo acesso a dados passa por um `TenantContext` e por um resolvedor de `time` para `conexão`. No modelo A ele devolve a mesma conexão para todos; no C, uma conexão por time.

### Autenticação

- **Tudo no código do servidor.** Cadastro, login, recuperação de senha, convites e sessões são implementados no `apps/server`, sem provedor externo de identidade ou de e-mail. Isso responde ao P1-02.
- **Senhas com argon2id**, nunca em texto nem em hash simples. Política mínima de tamanho, limite de taxa por conta e por IP e bloqueio temporário após tentativas seguidas.
- **Sessões no próprio banco.** O login devolve um token opaco e aleatório; o banco guarda só o hash dele, com validade, dispositivo e data de revogação. Sair ou ser removido do time revoga na hora, e é por isso que a escolha é sessão em vez de JWT.
- **A sessão fica no cofre do sistema** (`safeStorage` do Electron), nunca em arquivo solto ou `localStorage`.
- **E-mail por SMTP próprio.** O servidor envia convite e recuperação de senha pelo servidor de e-mail da empresa; em desenvolvimento, um SMTP de teste local captura as mensagens. O envio fica atrás de uma porta `Mailer`, então trocar de SMTP é só configuração.
- **Links de uso único.** Convite e recuperação usam token aleatório com validade curta, guardado como hash e invalidado no primeiro uso. Não há cadastro aberto.
- **Ator e time vêm sempre da sessão.** O servidor ignora qualquer `userId` ou `tenantId` que venha no corpo, no prompt ou na saída de um modelo.
- **Time ativo.** Quem pertence a mais de um time escolhe o ativo no app; o servidor confere o vínculo antes de qualquer outra coisa.
- **Depois, se precisar.** Login corporativo (LDAP ou SSO) entra como outro adaptador de autenticação, sem mudar o modelo de sessão.

### Identidade e time no banco

| Tabela                 | Responsabilidade                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `users`                | A conta: e-mail, hash da senha (argon2id), estado e data do último login                          |
| `sessions`             | Hash do token, usuário, validade, dispositivo e revogação                                         |
| `password_resets`      | Pedidos de recuperação: hash do token, validade e uso                                             |
| `tenants`              | O time: nome, estado e modo de isolamento (compartilhado ou dedicado)                             |
| `memberships`          | Usuário, time e papel (admin do time, gestor ou membro); uma pessoa pode estar em mais de um time |
| `invitations`          | Convites pendentes: hash do token, validade e quem convidou                                       |
| `tenant_settings`      | Nível, ferramentas ativas e regra de aceite; estende `team_preferences` e `team_modules`          |
| `tenant_id` nas demais | Projetos, tarefas, backlog, sprints, check-ins, impedimentos, auditoria e `assistant_requests`    |

O papel de admin do time é novo e cuida de membros e configurações; gestor e membro já existem e continuam decidindo o que cada pessoa pode fazer no filtro de permissões.

### Camadas de defesa

1. **Servidor.** `TenantContext` é obrigatório em todo caso de uso; sem ele o código não compila.
2. **Banco.** RLS em toda tabela com `tenant_id`. O servidor conecta com um papel sem privilégio de administrador e declara time e usuário em cada transação; o Postgres só devolve linhas desse time, então um erro no servidor ainda não lê outro time.
3. **Eventos.** O servidor entrega a cada cliente só os eventos do time ativo. O `LISTEN/NOTIFY` carrega apenas o id e o time, e os dados são relidos com a permissão do usuário.
4. **IA.** A busca de candidatos filtra por time antes de o Laya ver qualquer texto, e cada tool do MCP carrega time e usuário da sessão.
5. **Cache offline.** Um arquivo por usuário e por time, apagado ao sair ou ao ser removido.
6. **Auditoria.** Todo evento registra time, ator e origem (manual ou assistente).

### Ciclo de vida do time

- **Criar:** gera o primeiro admin, com o Núcleo ativo e o nível Básico.
- **Membros:** convidar e remover; o histórico de quem sai continua atribuído a ele, mas o acesso acaba.
- **Exportar:** o admin baixa os dados do time.
- **Arquivar:** preferir arquivar a excluir; a exclusão exige confirmação reforçada.
- **Dados atuais:** o SQLite do MVP vira o primeiro time na migração (P1-07).

### Quando entra no plano

- **M1:** `TenantContext` e `tenantId` no domínio e nos repositórios, ainda sobre SQLite. É barato agora e caro de encaixar depois.
- **M6a:** Postgres em Docker, login, sessões e e-mail próprios, tabelas de identidade, RLS, convites e o resolvedor de time para conexão.
- **M6b:** servidor, Realtime por time, aceite entre membros, cache de leitura e migração.

## Marcos e objetivos

São 15 marcos em cinco ondas. A Onda 1 entrega níveis, ferramentas da equipe e Scrum sem esperar nenhuma decisão aberta; login, multi-tenant e Postgres vêm na Onda 2, e o MCP e a IA ficam na Onda 3.

&#91;embedded content: roadmap · 5 ondas, 15 marcos, 4 portões\]

A Onda 1 está destacada porque é a única que pode começar hoje. Cada portão é uma condição a cumprir, com as decisões na seção Decisões (ADR), e não uma data.

| Marco                                | Objetivo                                                                       | Camadas                                   | Entregas principais                                                                                                                                                                                               | Pronto quando                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 · Estabilizar o MVP               | Base confiável antes de crescer                                                | Entrada, Domínio                          | Semântica de "Minhas tarefas" do gestor; seletor Equipe conectado; arquivar tarefa e projeto; renomear projeto                                                                                                    | Criar, editar, mover e reabrir persistem; nenhuma tela estática                                                                             |
| M1 · Motor de capacidades            | Uma única função decide o que existe, aparece e é permitido, dentro de um time | Identidade e time, Filtros 1–3, Domínio   | Registro de módulos; `resolveModuleSet`; `effectiveCapabilities`; preferências de nível; guard de módulo; `TenantContext` e `tenantId` nos casos de uso e repositórios; estado `winding_down` e prévia de impacto | Testes unitários cobrem dependência, conflito, ciclo e desligamento gradual sem perda de dados; nenhum caso de uso roda sem `TenantContext` |
| M2 · Interface adaptativa            | Cada pessoa vê só o que o time escolheu, no nível do time                      | Entrada, Filtros 1–2                      | Menu por nível; campos avançados ocultos por padrão; tela Ferramentas da equipe com presets, prévia de impacto e aplicação pelo gestor                                                                            | Trocar nível ou preset não perde dados; desativar um módulo com sprint ativa não deixa item órfão; time Básico trabalha sem saber Scrum     |
| M3 · Backlog e critérios             | Tarefas futuras ordenadas e prontas para planejar                              | Domínio, Persistência                     | Prioridade persistida; critérios de aceitação; estimativa em horas (ADR-07) ligada ao custo por hora; telas no Intermediário                                                                                      | Reordenar persiste; backlog separado da coluna `planning`                                                                                   |
| M4 · Sprints                         | Ciclo completo do planejamento ao encerramento                                 | Domínio, Persistência                     | Sprint com `draft`, `active`, `closed`; `sprint_tasks` com histórico; limite de sprints ativas como configuração (ADR-08); encerramento com política para itens abertos                                           | Backlog → planejamento → início → encerramento → replanejamento, com histórico                                                              |
| M5 · Check-ins e impedimentos        | Comunicar avanço e bloqueio em segundos                                        | Domínio, Entrada                          | Check-in assíncrono pela bandeja; resumo sugerido a partir das tarefas movidas; impedimento com estado e responsável                                                                                              | Check-in funciona sem sprint; impedimento resolvido sai da lista                                                                            |
| M6a · Postgres, login e multi-tenant | Saber quem é cada pessoa e separar os dados de cada time                       | Identidade e time, Persistência, Filtro 3 | Postgres em Docker (ADR-01); login, sessões e e-mail próprios (ADR-10); `tenants`, `memberships` e `invitations`; RLS em toda tabela; resolvedor de time para conexão; convites                                   | Uma pessoa de um time não lê nem escreve dados de outro, nem direto no banco                                                                |
| M6b · Servidor central               | Um só dado para a equipe inteira                                               | Persistência, Entrada                     | `apps/server`; adaptador Postgres com Drizzle; eventos por time (LISTEN/NOTIFY e SSE); aceite entre membros das mudanças de ferramentas; cache de leitura em SQLite; migração do SQLite com dry-run               | Dois computadores editam o mesmo projeto sem conflito; a migração reconcilia e tem rollback                                                 |
| M7 · Executor de comandos            | Comandos tipados que funcionam sem IA                                          | Executor                                  | Schemas Zod; resolvedor de tarefas autorizadas; confirmação por risco; diff; idempotência; auditoria com origem                                                                                                   | Comandos executam certo, inclusive com permissão negada e concorrência                                                                      |
| M8 · Servidor MCP interno            | Catálogo de ferramentas usado só pelo Laya                                     | Executor                                  | Tools geradas do catálogo de comandos; lista filtrada por time, ferramentas e permissão; transporte local                                                                                                         | Tool de módulo desligado não aparece nem executa; nenhuma porta MCP exposta na rede                                                         |
| M9 · IA local                        | Atualizar tarefa conversando, com IA 100% local                                | IA local                                  | Laya e orquestrador MCP; `TextModel` trocável (qwen, llama, Gemma); parser de datas e campos; fila e timeouts; chat com prévia e diff                                                                             | Troca de modelo pelo `.env` e pela tela funciona; nenhuma chamada a API externa; nunca confirma gravação inexistente                        |
| T1 · Bateria completa                | Validar o sistema inteiro                                                      | Todas                                     | Ver Fase de testes                                                                                                                                                                                                | Todos os critérios da tabela de testes atendidos                                                                                            |
| T2 · Piloto                          | Medir adoção real                                                              | Todas                                     | Equipe real em presets e níveis diferentes; coleta de feedback                                                                                                                                                    | Metas de uso medidas e escopo da Onda 5 decidido                                                                                            |
| M10 · Fluxo avançado e métricas      | Processo e análise para quem pediu                                             | Domínio, Entrada                          | WIP, subtarefas e dependências sem ciclo; review e retro; burndown, velocity, lead e cycle time                                                                                                                   | Métricas reconciliam com os eventos auditados                                                                                               |
| M11 · Integrações                    | Atualizar tarefas a partir de onde o trabalho acontece                         | Entrada, Executor                         | Commits por webhook (aviso para escolher tarefa); GLPI; Azure DevOps                                                                                                                                              | Falha ou credencial inválida não perde nem duplica atualizações                                                                             |

## Fase de testes (Onda 4)

A bateria completa roda depois do M9, sobre o sistema inteiro, e termina no piloto com a equipe real. Até lá, cada marco só fecha com o portão mínimo da última coluna.

| Tipo                | O que cobre                                                                                                                                | Marcos | Critério de aprovação                                                                 | Portão mínimo no marco        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------- | ----------------------------- |
| Unitário de domínio | Resolvedor de módulos, níveis, transições de sprint, regras de impedimento, contratos de comando                                           | M1–M7  | 100% das regras de dependência e conflito cobertas; nenhuma transição inválida aceita | Sim — obrigatório             |
| Contrato            | Schemas Zod, IPC do Electron, HTTP do servidor, schema das tools MCP                                                                       | M6–M8  | Cliente e servidor validam o mesmo contrato; payload malformado é recusado            | Só schemas novos              |
| Integração          | Banco central, transações, auditoria, migração do SQLite, concorrência entre usuários                                                      | M6–M7  | Migração com dry-run e rollback; nenhuma escrita perdida em edição concorrente        | Não                           |
| E2E                 | Electron real, bandeja, painel, troca de nível, ativação de ferramentas, duas estações sincronizadas                                       | M0–M6  | Fluxos críticos passam no Windows instalado                                           | Não (inclui o M10.3 pendente) |
| Segurança           | Prompt injection, acesso a outro time (API, banco, eventos, chat e MCP), ação em massa, replay, ferramenta desativada chamada via chat/MCP | M6–M9  | Zero acesso fora do escopo; zero chamada a módulo desativado                          | Não                           |
| IA                  | Roteamento rotulado em português, ambiguidade, preservação de fatos, comparação de checkpoints Laya                                        | M9     | Roteamento ≥ 95%; zero alteração silenciosa em tarefa errada                          | Não                           |
| Desempenho          | Laya + 3B na GTX 1050 Ti, fila, P50/P95, internet desligada                                                                                | M9     | Metas definidas no benchmark P0-02                                                    | Não                           |
| Uso (piloto)        | Equipe real nos três níveis e presets de ferramentas                                                                                       | Todos  | Atualização simples em até 15 s; ≥ 80% de usuários ativos por semana                  | Não                           |

Casos de teste específicos da camada de ferramentas da equipe:

- Ativar Sprints sem Backlog ativa os dois, com aviso; nunca deixa Sprints sozinho.
- Desativar Backlog com Sprints ativo é recusado e lista quem depende dele.
- Ativar dois módulos em conflito (estimativa em horas e em pontos) é recusado.
- O registro de módulos não tem ciclo; o teste roda a cada build e falha se alguém criar um.
- Desativar e reativar um módulo devolve os dados intactos.
- Um caso de uso de módulo desativado recusa a chamada no backend, mesmo vindo do chat ou do MCP.

Casos de teste de multi-tenant, mudança de ferramentas e IA configurável:

- Uma pessoa do time A pede uma tarefa do time B por API, por chat e pelo MCP: os três caminhos recusam.
- Consulta ao banco com o papel do servidor e o time A declarado não retorna nenhuma linha do time B (RLS).
- Quem está em dois times vê só o time ativo, e trocar o time ativo não vaza cache nem eventos.
- O fluxo de eventos do time B não entrega nada ao time A.
- Quem é removido do time perde o acesso, o cache offline é apagado e o histórico continua atribuído a ele.
- Uma proposta de mudança de ferramentas só vale com o aceite; silêncio não conta como aceite.
- Desativar Sprints com uma sprint ativa entra em encerramento: nada novo é criado, nada vira órfão, e reativar devolve os dados.
- Trocar o modelo de texto pelo `.env` e pela tela: health check que falha volta ao modelo anterior, pedidos em andamento terminam no antigo, e a tela só oferece modelos instalados.
- Prompt injection numa descrição de tarefa não gera nenhuma chamada de ferramenta, porque a LLM não tem acesso ao MCP.
- Datas e títulos em português ("amanhã", "sexta") são resolvidos pelo parser sem LLM; o que falha vira formulário pré-preenchido.

## Decisões (ADR)

Oito das dez decisões estão fechadas e duas são recomendações para você confirmar. Nenhuma bloqueia a Onda 1; banco e login precisam estar prontos antes do M6a.

| ID     | Decisão                     | Status      | Resultado                                                                                                                                                            | Efeito no plano                                    |
| ------ | --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| ADR-01 | Banco central e offline     | Decidida    | PostgreSQL próprio: em Docker agora e no servidor da empresa, 24/7, depois; nenhuma plataforma externa. SQLite só como cache de leitura, avaliado abaixo             | Adaptador Postgres com Drizzle; M6a e M6b          |
| ADR-02 | Papel do MCP                | Decidida    | MCP interno: o Laya escolhe a ferramenta e o orquestrador a chama; a LLM não acessa o MCP                                                                            | M8 sem clientes externos                           |
| ADR-03 | Roteador de intenção        | Decidida    | Laya local; o POC P0-01 só escolhe o checkpoint                                                                                                                      | M9                                                 |
| ADR-04 | Modelo de texto             | Decidida    | Trocável por injeção de dependência, pelo `.env` ou pela tela de configurações; qwen, llama e Gemma entram no benchmark                                              | M9; detalhes abaixo                                |
| ADR-05 | Quem escolhe as ferramentas | Decidida    | Gestor propõe e a equipe aceita; a mudança roda em etapas para não quebrar tarefas, backlog nem sprints em andamento                                                 | M1, M2 e M6b; fluxo na seção Ferramentas da equipe |
| ADR-06 | Escopo do nível             | Decidida    | Por equipe; simplificação individual fica fora por enquanto                                                                                                          | M2                                                 |
| ADR-07 | Unidade de estimativa       | Decidida    | Horas, que reaproveitam o custo por hora que já existe nas tarefas; pontos ficam como módulo futuro                                                                  | M3                                                 |
| ADR-08 | Sprint ativa única          | Recomendada | Sim, como configuração do módulo Sprints (padrão: uma ativa por projeto), sem travar no banco                                                                        | M4; confirmar com o time                           |
| ADR-09 | Servidor e eventos          | Recomendada | Fastify; eventos entre clientes por LISTEN/NOTIFY do Postgres, entregues pelo servidor via SSE                                                                       | M6b; confirmar                                     |
| ADR-10 | Autenticação e e-mail       | Decidida    | Tudo no código do servidor: senhas com argon2id, sessões e convites no próprio banco, e-mail por SMTP da empresa; nenhum provedor externo de identidade ou de e-mail | M6a; detalhes na camada de autenticação            |

### ADR-01 · PostgreSQL próprio, sem plataforma externa

O plano não depende de nenhum serviço de terceiros: o banco é um PostgreSQL sob seu controle, e login, e-mail e eventos vivem no código do `apps/server`. Isso fecha o P1-02 e o P2-02 e deixa o isolamento por time para o próprio Postgres.

**Como entra na arquitetura**

- O `apps/server` continua sendo o único lugar que grava: casos de uso e executor de comandos rodam nele, e só ele tem acesso ao banco.
- Os desktops falam apenas com o servidor: login, leitura, escrita e avisos de mudança passam pela API dele, nunca direto pelo banco.
- O servidor conecta com um papel de banco sem privilégio de administrador, e cada transação declara o time e o usuário (`SET LOCAL`), que é o que o RLS lê para filtrar as linhas.
- O Drizzle, que já está no projeto, troca o dialeto SQLite pelo Postgres no `packages/infra-postgres`.

**Onde roda**

| Fase   | Onde                                 | Como                                                                                      | Cuidado                                                                          |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Agora  | Docker na máquina de desenvolvimento | Um `docker compose` com Postgres e volume nomeado; migrações rodadas pelo próprio projeto | Backup do volume antes de trocar de versão; é a base de teste e do primeiro time |
| Depois | Servidor da empresa, ligado 24/7     | O mesmo Postgres instalado no servidor, com backup agendado e restauração testada         | Migração por dump e restauração; a conexão vem de variáveis de ambiente          |

O código é o mesmo nas duas fases; só muda a variável de conexão. Como nada depende da internet, o teste "com a internet desligada" da 2.0 passa para o sistema inteiro. O compose também sobe um SMTP de teste que captura os e-mails (algo como o Mailpit), então o fluxo de convite funciona sem rede.

**SQLite para uso offline**

| Opção                                 | O que faz                                                                       | Complexidade                                                                                    | Risco                                              |
| ------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A · Sem offline                       | O app avisa "sem conexão" e bloqueia escrita                                    | Nenhuma                                                                                         | Bandeja inútil fora da rede                        |
| B · Cache de leitura                  | O SQLite guarda o último estado das tarefas do usuário; lê offline, não escreve | Baixa: reaproveita o `infra-sqlite`                                                             | Dado desatualizado; precisa limpar ao sair do time |
| C · Offline-first com fila de escrita | Grava offline e sincroniza depois                                               | Alta: idempotência, conflito de versão e regras de sprint e de ferramentas reaplicadas na volta | Alto: merge e escritas sobre dados velhos          |

A recomendação é a opção B, entregue no M6b, e a C só se o piloto mostrar necessidade real. Com o banco na LAN, estar offline quase sempre significa estar fora da rede, então o ganho de B é pequeno. O cache fica por usuário e por time e é apagado ao sair ou ao ser removido do time. O SQLite continua útil na Onda 1, nos testes e na migração dos dados atuais (P1-07).

### ADR-02 · MCP interno, usado só pelo Laya

O MCP vira o catálogo interno de ferramentas do assistente, sem nenhum cliente externo. Isso reduz o escopo do M8 e deixa a IA com uma única porta de entrada.

- **Laya decide, o orquestrador chama.** O Laya escolhe entre opções tipadas (a ferramenta, a tarefa candidata, sim ou não); o orquestrador é o cliente MCP e faz a chamada. O transporte é local (stdio ou loopback), sem porta aberta na rede.
- **A LLM não enxerga o MCP.** Ela recebe texto e devolve texto (título, descrição, resumo), sempre com diff e confirmação. Como ela lê descrições de tarefas, que são conteúdo não confiável, tirá-la do MCP também tira o poder de agir de um prompt injection.
- **A lista de ferramentas é por sessão.** Ela sai filtrada por time, ferramentas ativas e permissão do usuário. Um time Básico oferece poucas opções ao Laya, o que facilita a classificação.
- **Cada tool é um comando tipado do M7.** O MCP não cria um segundo caminho de escrita: ele só chama o executor.
- **Ponto a validar no POC P0-01.** Sem a LLM para extrair campos, títulos livres e datas como "amanhã" vêm de um parser determinístico em português, e o que ele não resolver vira formulário pré-preenchido para confirmar. Se Laya e parser não bastarem nos testes, o ADR-02 reabre para permitir que o modelo de texto extraia campos com schema estrito.

### ADR-04 · Modelos plugáveis por injeção de dependência

Nenhum código fora de um adaptador sabe qual modelo está rodando; trocar de modelo é trocar uma configuração.

- **Duas portas.** `DecisionRouter` (já existe na 2.0) e `TextModel`, com `rewrite`, `summarize` e `health`. Os adaptadores são registrados por id, como `laya-local` ou `ollama:<modelo>`, e cobrem qwen, llama e Gemma sem tocar nos casos de uso.
- **Ordem de precedência.** A tela de configurações vence o `.env`, que vence o padrão do código. O `.env` define o padrão e a lista de modelos permitidos; a tela troca o modelo ativo dentro dessa lista.
- **Sem campo de URL livre.** A tela lista só os modelos que o servidor realmente tem instalados, o que mantém a regra de que nada sai da máquina (D-03).
- **Quem troca.** O administrador do servidor, já que a GPU é compartilhada por todos os times. Confirmar.
- **Troca segura.** Health check antes de ativar, pedidos em andamento terminam no modelo antigo, e uma falha volta ao modelo anterior.
- **Comparação por dados.** O id do modelo fica registrado em `assistant_requests`, e o mesmo dataset de avaliação roda contra qualquer modelo configurado. A escolha entre qwen, llama e Gemma sai do benchmark P0-02, e os 4 GB de VRAM definem quais variantes cabem.

```bash
AI_ROUTER=laya-local
AI_TEXT_MODEL=ollama:qwen2.5:3b
AI_TEXT_ALLOWED=ollama:qwen2.5:3b,ollama:llama3.2:3b,ollama:<variante-gemma>
AI_OLLAMA_URL=http://127.0.0.1:11434
```

## Próximos passos

- [ ] Copiar este plano para `docs/PLANO-2.0.md` no repositório e referenciá-lo em `PROGRESS.md`.
- [ ] Confirmar ADR-08 (sprint única) e ADR-09 (Fastify, LISTEN/NOTIFY e SSE), a regra de aceite por maioria simples e a escolha de administrador do servidor para trocar modelos.
- [ ] Decidir o modelo de isolamento (A recomendado) e confirmar que organização e time são a mesma coisa.
- [ ] Subir o Postgres em Docker com \`docker compose\` e um SMTP de teste local, para o M6a.
- [ ] M0: corrigir a semântica de "Minhas tarefas" do gestor, conectar o seletor Equipe e adicionar arquivar tarefa e projeto.
- [ ] M1: criar `packages/core/src/modules/registry.ts`, `resolveModuleSet`, `effectiveCapabilities` e o `TenantContext` nos casos de uso.
- [ ] Rodar o POC do Laya (P0-01) em paralelo, incluindo a escolha de ferramenta com lista filtrada e o parser de datas.
