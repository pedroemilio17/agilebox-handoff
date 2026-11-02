# Handoff Spec v2: redesign do AgileBox

> Fonte: protótipos em `design/v2/` (formato do editor de design, **referência visual, não código**).
> Tokens: `packages/ui/src/styles/tokens-v2.css`. Escopo e fases: `docs/REDESIGN-v2-ESCOPO.md`.
> Este documento **complementa** o `docs/HANDOFF.md`: o que não estiver aqui (redimensionar a bandeja,
> movimento de janelas, toasts, foco) continua valendo como está lá.

## 1. Por que mudar

O MVP funciona, mas tudo está no mesmo cinza translúcido e com o mesmo peso: nada se destaca, e o app
parece limitado. As telas também mostram dados sem mostrar problemas. A v2 resolve as duas coisas:

1. **Hierarquia**: fundo de conteúdo sólido em degraus, uma única cor de ação, cor forte só para sinais.
2. **Exceções em vez de porcentagens**: o gestor vê o que está parado, bloqueado ou vencido, e não só a
   distribuição por estado.

Princípio que continua: **foco por padrão, tudo a um clique**.

## 2. Linguagem visual

### 2.1 Tema

"Quente, preciso, sem atrito." Base escura levemente violeta (não cinza neutro), três degraus de
superfície, bordas finas (`--color-hairline`) em vez de sombras, e uma cor de ação verde-lima.

### 2.2 Onde entra o vidro (mudança importante, ver ADR 0004)

| Superfície | v1 (MVP) | v2 |
| --- | --- | --- |
| Janela da bandeja | vidro | **vidro** (é uma camada flutuante) |
| Barra lateral do painel | vidro da janela | **vidro da janela** (`--color-rail-bg` translúcido, deixa o Acrylic ou o Liquid Glass aparecer, como a barra lateral do macOS) |
| Área de conteúdo do painel | vidro da janela | **sólida** `--surface-canvas` |
| Cartões, colunas, seções | `--glass-group` | **sólidos** (`--surface-card`, `--surface-panel`) |
| Painel de detalhe, paleta Ctrl+K, menus, modais | `--glass-popover` | **vidro CSS** (`--glass-popover` + `--shadow-popover`) sobre o conteúdo |

Motivo: com vidro em tudo, nada parece vidro. O vidro passa a significar "isto flutua".
As estratégias de janela do ADR 0001 (`native`, `compositor`, `css`, `opaque`) continuam iguais.

### 2.3 Tipografia

| Papel | Família | Uso | Tamanhos |
| --- | --- | --- | --- |
| Display | Bricolage Grotesque | títulos de tela (24), título do detalhe (24), saudação da bandeja (30), números grandes do dashboard (40 e 72) | peso 600–650, `letter-spacing: -0.02em` |
| Interface | Geist | todo o resto | 12,5 / 13,5 / 14 / 16; peso 400–600 |
| Dados | Geist Mono | IDs (`AB-118`), horários, datas curtas (`sex 06`), métricas (`4,2d`, `3/3`), teclas (`Ctrl K`), rótulos de seção em caixa alta (11 px, `letter-spacing: 0.08em`) | 10,5–13; 28 nas métricas |

Fontes via `@fontsource-variable/*` (o app precisa funcionar offline). Nada de Google Fonts por rede.

### 2.4 Cor

- **Ação**: `--color-primary-bg` (lima). Só no botão primário, no item ativo da barra lateral (ponto de 6 px),
  em menções e no foco. **Texto sobre ela é escuro** (`--color-on-primary`): ajustar `Button.module.css`.
- **Estados**: sempre como ponto de 8 px + rótulo. Nunca como barra larga ou fundo de cartão.
- **Sinais**: vermelho (`--color-signal-danger-*`) para bloqueada e vencida; âmbar (`--color-signal-warning-*`)
  para parada, WIP no limite e prioridade alta. São a única cor forte na tela.
- **Gestor**: selo violeta neutro (antes era vermelho, que agora significa alarme).
- Contraste: todos os pares de texto passam 4,5:1. Os sinais nunca dependem só da cor: sempre têm ícone ou texto.

### 2.5 Raios e espaço

Cartão 12, seção 16, painel de detalhe 18, janela 22, botão 10, campo 10, chip 8, selo 6.
Espaçamento em degraus de 4 (`--space-*`). Cartões: padding 11×12, gap interno 8.

### 2.6 Ícones

Traço de 1,8–2 px, cantos arredondados, 14–16 px na interface. Sem emoji. Botão só com ícone tem
`aria-label`. Sugestão: `lucide-react` (perguntar ao Pedro antes de adicionar a dependência).

## 3. Componentes

### 3.1 Componentes existentes que mudam (`packages/ui`)

| Componente | O que muda |
| --- | --- |
| `Button` | primário lima com texto escuro, altura 36–40, raio 10, peso 600; mostra atalho opcional à direita (`kbd`). Secundário: `--surface-card` + borda `--color-hairline-strong`. |
| `IconButton` | 28–32 px visuais, alvo de toque mantido em 44 px (área invisível). |
| `SegmentedControl` | fundo `--surface-panel`, item ativo `--color-control-segment-selected`, altura 28–32. |
| `StatusChip` | vira **ponto + rótulo** (sem fundo colorido). Variante compacta: só o ponto, com `title`. |
| `StatusMenu` | lista com ponto + rótulo; o item atual tem marca de seleção. |
| `Avatar` | 22 px (cartão), 26–28 (listas), 30 (conta). Fundo `--color-avatar-bg`, iniciais em 600. |
| `ReadOnlyBadge` | deixa de parecer aba. Vira selo com cadeado: "Somente leitura". |
| `GlassSurface` | variantes `window` (bandeja), `popover` (detalhe, paleta, menus). Remover o uso em cartões. |
| `GroupedList` / `FieldRow` | no detalhe vira **lista de propriedades**: grade `120px 1fr`, linhas de 34 px, rótulo em `--color-text-subtle`. |
| `Modal` | fundo de cobertura `--color-focus-overlay`; corpo em vidro `popover`. |
| `EmptyState`, `Skeleton`, `Toast`, `Tooltip` | só tokens. |

### 3.2 Componentes novos

| Componente | Onde | Descrição |
| --- | --- | --- |
| `Kbd` | botões, paleta, rodapés | tecla em mono 10,5 px, borda interna `rgba(255,255,255,.14)`, raio 5. |
| `SignalBadge` | cartão, detalhe, dashboard | variantes `blocked`, `aging`, `overdue`, `wip`; ícone + texto; cores de sinal. |
| `TaskCard` | quadro | ver 4.2. |
| `ProjectSwatch` | barra lateral, cartão, paleta | quadradinho de 8–10 px com a cor do projeto. |
| `Drawer` | detalhe da tarefa | painel em vidro ancorado à direita (ver 4.3). |
| `CommandPalette` | global | ver 4.6. |
| `MetricTile` | dashboard | rótulo com ponto, número em display 40, legenda em `--color-text-subtle`; é um link. |
| `Sparkline` / `BarChart` | dashboard | SVG simples, sem biblioteca; último ponto ou barra na cor de ação. |
| `WipMeter` | dashboard (equipe) | N quadradinhos de 14 px: preenchidos = em andamento, vazios = vaga, apagados = acima da capacidade. |
| `Eyebrow` | rótulos de seção | mono 11 px, caixa alta, `--letter-spacing-eyebrow`. |

## 4. Telas

### 4.1 Barra lateral do painel (`layout/PanelShell.tsx`)

- Expandida **232 px** (era 204), recolhida 52 px (mantém o comportamento atual de recolher).
- Topo: marca (quadrado lima 26 px + "AgileBox" em display 17).
- Botão "Buscar ou criar" com `Ctrl K` (abre a paleta, 4.6), 36 px.
- Itens de 36 px com ícone + rótulo **sempre visíveis quando expandida**: Início (abre a bandeja),
  Quadro, Dashboard (só gestor), Agenda, Plug-ins (desabilitado, "em breve").
  Ativo: fundo `--color-rail-selected`, texto primário e ponto lima de 6 px à direita.
- Seção "Projetos" (eyebrow) com os projetos do usuário: `ProjectSwatch` + nome + contagem em mono.
  Clicar filtra o quadro. **Substitui o modal de projetos como caminho principal** (o modal continua
  para criar projeto e gerenciar membros).
- Base: Ajustes; conta com avatar 30, nome e "Gestor · Área" ou "Colaborador · Área".

### 4.2 Quadro (`board/`) · protótipo `Quadro.dc.html`

Cabeçalho (padding 16×24):
- Título "Quadro" (display 24) + seletor "Todos os projetos ▾" (um título só, sem duplicar).
- `SegmentedControl` "Minhas | Equipe" (Equipe segue estático até a fase C).
- À direita: aviso "Edições aparecem como gestor" com cadeado (só quando o gestor está no quadro de outra pessoa;
  substitui o `ManagerBanner` atual) e botão primário "Nova tarefa" com `Kbd` N.

Faixa de filtros (chips de 30 px, borda inferior hairline):
- Pessoas (avatares empilhados), Área, Prioridade (fase B).
- Chips de exceção com contagem: "Bloqueadas · 1" (fase B), "Paradas · 2", "Vencidas · 1". Clicar filtra.
- À direita, em mono: "11 tarefas · atualizado há 4 min".

Colunas: grade de 5, `minmax(210px, 1fr)`, gap 12, rolagem horizontal abaixo de 1100 px.
- Cabeçalho da coluna (30 px): ponto de estado, nome em 13/600, contagem em mono. Quando houver limite de
  WIP (fase B), a contagem vira `3/3` num selo: neutro abaixo do limite, âmbar no limite, vermelho acima.
- Botão "+" de 26 px no cabeçalho: cria tarefa já naquele estado.
- Rodapé de "Concluído": "Ciclo médio desta semana: 4,2d".

`TaskCard` (`--surface-card`, raio 12, padding 11×12, gap 8):
1. Linha 1: ID em mono 11 (`--color-text-subtle`), ícone de prioridade alta (fase B), `ProjectSwatch` à direita.
2. Título 13,5/500, até 3 linhas.
3. Se bloqueada (fase B): faixa vermelha com ícone e motivo.
4. Rodapé: prazo em mono (vermelho se vencido, com texto "venceu há N dias"), `SignalBadge` "parada Nd",
   subtarefas `☐ 2/4` (fase B), avatar do responsável à direita.
- Selecionado (detalhe aberto): anel de 1,5 px na cor de ação e fundo `--surface-raised`.
- Arrastar: mantém `@dnd-kit` e as regras atuais. O cartão arrastado ganha `--shadow-popover`.
- Cartões em Concluído: título em `--color-text-subtle`.

ID visível: **`AB-` + número sequencial por organização**. Precisa de coluna nova (`tasks.number`), ver escopo.

### 4.3 Detalhe da tarefa em painel (`task-detail/`) · protótipo `Quadro.dc.html`

**Muda de tela inteira para painel lateral (`Drawer`)**, sem sair do quadro.

- Posição: `top/right/bottom: 12px`, largura `min(468px, 100% - 24px)`, raio 18, vidro popover.
  Entra deslizando da direita (`--motion-duration-drawer`, `--ease-ios`); sem animação com `prefers-reduced-motion`.
- `Esc` fecha e devolve o foco ao cartão. Botão "Abrir em tela cheia" mantém a tela atual como opção.
- Clicar em outro cartão troca o conteúdo do painel sem fechá-lo.
- Cabeçalho (44 px): ID em mono + projeto; ações: copiar link, tela cheia, fechar.
- Corpo rolável (padding 12×20, gap 18), nesta ordem:
  1. Título editável em display 24 (grava ao sair do campo, regra 6.4 do PLANO).
  2. **Alerta de parada** (se aplicável): caixa âmbar "Parada há N dias em {estado}. Algo está travando?"
     com "Marcar bloqueio" (fase B; na fase A mostrar só "Segue em andamento", que registra um evento)
     e "Segue em andamento".
  3. **Lista de propriedades** (grade 120 / 1fr, linhas de 34 px): Status (menu), Responsável, Envolvidos
     (avatares + "Apoio", botão +), Prazo (`sex, 06 nov · em 5 dias`), Prioridade (fase B),
     Chamado GLPI (`#4821 ↗`), Horas e custo (respeita a política: colaborador não vê R$).
  4. Descrição (eyebrow + texto em `--color-text-body`).
  5. Subtarefas com barra de progresso fina (fase B).
  6. Definição de pronto, linha recolhida "0/3 · conferida ao concluir" (fase B).
  7. Commits vinculados (fase C).
  8. **Atividade**: abas "Tudo | Comentários" (comentários na fase B). Eventos do mesmo autor em sequência
     são **agrupados** ("Gestor moveu esta tarefa 4 vezes hoje · ver"). Selo de gestor violeta.
     Campo "Comentar — @ para mencionar" com `Kbd` Ctrl Enter (fase B).
- Somente leitura: campos desabilitados e selo "Somente leitura" no cabeçalho.

O layout de duas colunas atual (Detalhes, Prazo, Custo | Envolvidos, Linha do tempo) deixa de existir;
os cartões viram seções da coluna única.

### 4.4 Dashboard do gestor (`dashboard/`) · protótipo `Dashboard.dc.html`

Cabeçalho: "Dashboard" + seletor "Semana 45 · 03–07 nov ▾"; à direita "dados do quadro · atualizado há N min"
e "Exportar resumo" (fase B).

Linha 1, grade `auto-fit, minmax(300px, 1fr)`, gap 16:
- **Quadro em dia** (cartão `--surface-panel`): eyebrow, número em display 72 com `%` menor, `Sparkline`
  das últimas 6 semanas, legenda "das tarefas ativas foram atualizadas nas últimas 48h · +12 pts vs.
  semana passada". É a métrica principal do produto (adesão).
- Quatro `MetricTile` 2×2, cada um é link para o quadro já filtrado: Bloqueadas (fase B), Paradas há +N dias,
  Vencidas, Acima do limite (fase B). Quando zero: número em `--color-text-subtle` e ícone de ok.

Linha 2:
- **Fluxo · 6 semanas**: três números em mono 28 (tempo de ciclo médio, do pedido à entrega,
  concluídas nesta semana) + `BarChart` de concluídas por semana (barra atual na cor de ação, demais
  `--color-avatar-bg`, valor em mono acima, rótulo `S40` abaixo).
- **Mudou desde ontem**: até 5 eventos (avatar, ID em mono, frase, horário) + ponto com a cor do estado ou sinal.

Linha 3, **Equipe** (substitui `CollaboratorTable`): grade `2fr 1.3fr 1.6fr 1.2fr 1.2fr`, linhas de 12 px de padding.
Pessoa (avatar, nome, área), Em andamento (`WipMeter` + `2/3`), Sinais (`SignalBadge` ou "—"),
Daily de hoje (fase C; na fase A, omitir a coluna), Última atualização (mono; âmbar se há mais de 2 dias).
A linha inteira é link para o quadro daquela pessoa (comportamento atual).
Abaixo de 860 px a grade rola na horizontal dentro do cartão.

Linha 4 (fase B): **Combinados da última retro**, faixa com até 3 itens numerados e link para a próxima retro.

`StackedBar` e os 5 `StatCard` de porcentagem saem da tela. A distribuição por estado continua disponível
no `WipMeter`/tooltip por pessoa, se o Pedro quiser manter.

### 4.5 Agenda (`agenda/`) · protótipo `Agenda.dc.html`

- **Visão padrão vira Semana** (seg a dom). Segmentado "Dia | Semana | Mês"; Mês é a visão atual.
- Cabeçalho: setas anterior/próxima (32 px), "02 – 08 de novembro", "semana 45" em mono, opção
  "Mostrar prazos de tarefas" (ligada por padrão).
- Calendário em `--surface-panel`, raio 16:
  - Cabeçalho de dias: dia da semana 12 + número em display 20. Sáb e dom com número apagado e coluna mais escura.
  - **Faixa "prazos"** (altura mínima 44): cada tarefa com prazo naquele dia vira um chip de 24 px
    (ponto do estado, ID em mono, título truncado). Clicar abre o detalhe da tarefa.
  - Grade de horas 08–18, 52 px por hora, linhas finas. Eventos posicionados pela hora de início e duração,
    fundo translúcido conforme o tipo (reunião violeta, revisão turquesa, retro lima, trabalho azul).
- Painel direito: `flex: 1 1 290px`, `max-width: 340px` (o mínimo de 260 px do HANDOFF continua).
  - "Próximos": cartões com dia (sigla + número em display) e título, horário em mono, recorrência e participantes.
    Quando o formulário abre, a lista **encolhe para 2 itens + "+ N mais"** (comportamento "expande no lugar" atual).
  - Formulário "Novo agendamento" (só gestor): título, tipo segmentado (Reunião | Revisão | Retro | Prazo, fase B),
    dia + início + **fim** (fase B), participantes, "Repetir toda semana" (fase B),
    "Gerar lista de combinados ao final" (só para Retro, fase B), Cancelar / Criar. `Esc` fecha.

### 4.6 Paleta de comandos `Ctrl K` (nova) · protótipo `Comandos.dc.html`

- Atalho global no painel: `Ctrl K` (e `Cmd K` no macOS). Também pelo botão "Buscar ou criar" da barra lateral.
  Na bandeja, o campo de nova tarefa usa o mesmo interpretador.
- Diálogo de 680 px, centrado a 110 px do topo, vidro popover, raio 20, fundo coberto por `--color-focus-overlay`.
- Campo de 17/500. Abaixo, **tokens interpretados** como chips enquanto a pessoa digita:
  - `@pessoa` → responsável (busca por nome ou iniciais);
  - `#projeto` → projeto;
  - datas em português: "hoje", "amanhã", "sexta", "dia 12", "12/11" → prazo;
  - `!alta` → prioridade (fase B);
  - Chip final: "entra em **A fazer**" (estado inicial).
- Seções: **Ações** (Criar tarefa "…" com `Enter`; Criar e abrir detalhes com `Shift Enter`),
  **Tarefas parecidas** (busca existente: evita duplicata), **Ir para** (Dashboard `G D`, Agenda `G A`, Quadro `G Q`).
- Rodapé: `↑↓` navegar, `Tab` completar, legenda dos símbolos.
- Teclado: setas movem a seleção (`aria-activedescendant`), `Esc` fecha e devolve o foco.
- O interpretador é uma função pura (`core/rules/quick-add-parser.ts`), com testes para cada formato.

### 4.7 Bandeja (`tray/`) · protótipo `Bandeja.dc.html`

Mantém largura, altura automática, redimensionar e controles do HANDOFF v1. Muda:

- Cabeçalho: marca 22 px + "AgileBox" 13/600 + controles (abrir painel, minimizar, fechar).
- **Saudação** em display 30: "Boa tarde, Pedro." + linha "Sexta, 01 nov · 3 em andamento · 1 parada" (números em mono).
- Lista "Em foco" (eyebrow + link "Ver quadro (N)"): no máximo 2 itens em cartões `--glass-group`
  com ID, ponto de estado ou `SignalBadge`, título, prazo e projeto. Os segmentos Recentes | Frequentes
  continuam como estão, acima da lista.
- Campo de nova tarefa fixo no rodapé (46 px), placeholder "Nova tarefa — use @pessoa e #projeto", `Kbd` N,
  usando o mesmo interpretador da paleta.
- **Fase C** (fora do MVP hoje): cartão "Vamos registrar o que foi feito hoje?" (fundo `--color-accent-soft`,
  borda `--color-accent-border`), a tela de daily em 3 passos e o aviso de commit. Estão no protótipo
  para referência; não implementar sem decisão do Pedro.

## 5. Estados

| Situação | Comportamento |
| --- | --- |
| Carregando | `Skeleton` com a forma do conteúdo (cartões, linhas da tabela), sem spinner. |
| Coluna vazia | texto 12 em `--color-text-subtle`: "Nada aqui." + botão "+" já visível no cabeçalho. |
| Quadro vazio | `EmptyState`: "Nenhuma tarefa ainda" + botão "Nova tarefa". |
| Dashboard sem dados da semana | métricas mostram "—" e a legenda "sem movimentação nesta semana". |
| Zero exceções | `MetricTile` em tom neutro com ícone de ok: o calmo também é informação. |
| Erro ao salvar | mantém `SaveError` atual, agora em `--color-signal-danger-*`. |
| Somente leitura | campos desabilitados, cadeado no cabeçalho do painel de detalhe. |

## 6. Movimento

- Painel de detalhe: desliza da direita 24 px + opacidade, 420 ms `--ease-ios`.
- Paleta: escala 0,98 → 1 + opacidade, 280 ms.
- Cartão recém-movido ou criado: destaque com anel na cor de ação que some em 600 ms (o highlight atual).
- Barras e sparkline do dashboard: crescem de 0, 500 ms, só na primeira renderização.
- Tudo desligado com `prefers-reduced-motion` (hook `useReducedMotion` já existe).

## 7. Acessibilidade

- Contraste 4,5:1 em todo texto, inclusive rótulos de 11 px (`--color-text-subtle` passa).
- Sinal nunca só por cor: sempre ícone + texto.
- Alvo de toque mínimo de 44 px (área clicável), mesmo quando o visual é menor.
- Barra lateral com `aria-current="page"`; segmentados com `aria-pressed`; painel de detalhe com
  `role="dialog"` não modal e `aria-label` com o ID e o título; paleta com `role="dialog"` modal + `useFocusTrap`.
- Gráficos com `role="img"` e `aria-label` que descreve os valores.
- Atalhos de uma letra (`N`, `G D`) só quando o foco não está em campo de texto.
