# AgileBox

Plataforma de organização de tarefas para times de TI, pensada para ser **usada com o mínimo de atrito**: cada pessoa vê só o que precisa, atualiza uma tarefa em poucos toques e ninguém fica "amarrado" por permissões desnecessárias.

Substitui uma plataforma ágil em Odoo que o time quase não usava. O produto é do Pedro (portfólio), construído fora do horário de trabalho.

## Como trabalhar comigo

- Responda em português do Brasil. Textos da interface também em português.
- Antes de escrever código de uma etapa nova, **explique em poucas linhas o que vai fazer e por quê**, e espere eu confirmar. Prefira passos pequenos que eu consiga revisar e entender.
- Quando houver mais de uma boa opção (stack, biblioteca, estrutura), apresente as opções com prós e contras e **pergunte**, em vez de decidir sozinho.
- Não invente requisitos. O que não estiver definido está em `docs/MVP.md`, seção "Decisões em aberto".

## O que é o produto

Duas superfícies que compartilham os mesmos dados:

1. **Bandeja**: janela pequena (aplicativo de Windows, tipo ícone de bandeja) para atualizar ou criar tarefas rapidamente.
2. **Painel principal**: janela de aplicativo (não é site) com barra lateral, quadro kanban, detalhe da tarefa, dashboard do gestor e agenda.

O sistema deve ser disponivel para uso em todos os sistemas operacionais, principalmente windows e fedora linux. O painel e a bandeja são aplicativos de desktop, não páginas web.

## Referências (leia antes de implementar telas)

- `docs/HANDOFF.md`: especificação visual e de comportamento (tokens, componentes, estados, movimento, acessibilidade).
- `docs/MVP.md`: escopo do MVP, fases e decisões tomadas.
- `docs/PLANO.md`: stack, arquitetura (camadas e fronteiras), modelo de dados, regras de acesso, marcos e estrutura de arquivos. **Siga este plano**; mudanças nele são combinadas antes.
- `design/Bandeja.dc.html` e `design/Painel.dc.html`: protótipos do design. **São referência visual, não código para reaproveitar**: usam um formato próprio (`DCLogic`, `<x-dc>`) que não roda fora do editor de design. Leia o CSS e o markup para extrair medidas, cores e comportamento, e reimplemente na stack escolhida.

## Regras de produto que não podem se perder

- Estados da tarefa, nesta ordem: **Planejamento, A fazer, Desenvolvendo, Revisar, Concluído**.
- Toda edição de tarefa gera uma entrada na **linha do tempo** (data e hora, quem editou, o que mudou). Edições feitas pelo gestor são marcadas como **Gestor**.
- Colaborador vê e edita **as tarefas de que participa** (criou, é Responsável ou Apoio). Gestor vê o dashboard, abre os projetos de qualquer colaborador e edita; **toda** edição do gestor é marcada como Gestor. Só o gestor cria e edita agendamentos.
- Custo da tarefa = soma de (horas × valor/hora) por envolvido. Cada usuário e cada entidade tem o **próprio valor/hora padrão**. O gestor vê todos os valores; cada usuário vê só o próprio.
- **Entidades** são stakeholders (só nome, para identificação): nunca dão permissão nem recebem avisos.
- Todo dado pertence a uma **organização** (`organization_id`), preparando o multiempresa.
- As regras de acesso ficam no domínio e na aplicação (`packages/core`, `packages/application`), nunca só na tela.
- A interface é escura, em vidro fosco, no estilo iOS/macOS. Respeite `prefers-reduced-motion`.

## Fora do MVP (não implemente agora)

- Tela e lógica de **Plug-ins** (webhooks, integração com commits). O item existe na barra lateral com a dica "em breve".
- Aviso diário ("Vamos dar uma atualizada do que foi feito hoje?") e aviso de atualização vinda de plug-in.
- Visão **Equipe** (seletor "Minhas tarefas | Equipe" fica estático por enquanto).
- IA embarcada na plataforma.

## Stack

Electron + React + TypeScript + Vite (`electron-vite`), CSS próprio com tokens, SQLite (`better-sqlite3`) + Drizzle, monorepo pnpm workspaces, Clean Architecture com injeção de dependência manual, Vitest, Testing Library e Playwright. Detalhes em `docs/PLANO.md`.

## Convenções

- Código e identificadores em inglês; textos da interface em pt-BR.
- O Pedro roda git, `pnpm install` e comandos de instalação; o Claude foca no código.
- Comandos (na raiz, com Node 22+ e pnpm):
  - `pnpm install`: instala as dependências.
  - `pnpm check`: formatação, lint, tipos e testes, nesta ordem. **Rode antes de dar um passo por concluído.**
  - `pnpm format` aplica o Prettier; `pnpm format:check` só confere.
  - `pnpm lint`: ESLint com zero avisos. Também garante as fronteiras entre camadas (PLANO 3.1).
  - `pnpm typecheck`: `tsc` em cada pacote.
  - `pnpm test`, `pnpm test:watch` e `pnpm coverage`: Vitest.
  - Comandos do banco (`db:*`), do app (`dev`, `build`) e dos testes de ponta a ponta entram nos marcos M4 a M6.
- Fronteiras entre camadas: imports entre pacotes seguem a tabela 3.1 do `docs/PLANO.md`. Import relativo não sai da pasta da camada, e pacotes de runtime (`electron`, `better-sqlite3`, `drizzle-orm`, módulos do Node) só entram onde a tabela permite (`tooling/layers.js`).
- Decisões técnicas registradas em `docs/decisoes/`.
- O código dos marcos é gerado pelo **Codex em laço** (`AGENTS.md`, `PROGRESS.md`, `scripts/codex-loop/`). Ao revisar com o Claude, confira o `PROGRESS.md` (passos feitos, notas e bloqueios) antes de mexer no código.
