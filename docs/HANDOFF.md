# Handoff Spec: AgileBox, Bandeja e Painel principal

> Fonte: protótipos em `design/`. Valores abaixo foram extraídos do CSS dos protótipos. Onde houver conflito, o protótipo vence, mas me avise.

## Overview
Dois aplicativos de desktop (Windows) com a mesma linguagem visual:
- **Bandeja** (360 px de largura por padrão): lista curta de tarefas, busca, criar tarefa, atualizar tarefa.
- **Painel principal** (janela grande): barra lateral, quadro kanban por projeto, detalhe da tarefa, dashboard do gestor, agenda.

Princípio: **foco por padrão, tudo a um clique**. Cada pessoa abre vendo só o que é seu, sem bloqueios desnecessários.

## Layout

### Bandeja
- Janela flutuante, ancorada no canto inferior direito, `border-radius: 22px`, largura padrão **360 px** (mín. 340, máx. 400).
- Altura **automática por tela** (anima com `height .45s`):
  - Início: `246 + max(min(nº de tarefas visíveis, 2), 1) × 64` px.
  - Atualizar/detalhes: 560 px.
  - Nova tarefa: 316 px.
  - Mínimo manual 260 px, máximo 600 px.
- Redimensionável pela "barrinha" no topo (arrastar para cima/esquerda aumenta). Setas do teclado ajustam em passos de 24 px; duplo clique ou tecla Home volta ao automático.
- Estrutura vertical: cabeçalho 52 px, conteúdo rolável, rodapé com botão primário (padding 16 px).
- **Início**: busca (44 px), controle segmentado Recentes | Frequentes (44 px), lista agrupada com **no máximo 2 linhas visíveis** (64 px cada) e rolagem por barra de **3 px**, botão "Nova tarefa".
- **Atualizar tarefa / detalhes**: título e projeto, campo "O que será feito", grupo com Status (menu), Prazo (data), Responsável, Envolvidos, Chamado.
- **Nova tarefa**: título, escolha de projeto (segmentado de 3), botão "Criar tarefa".

### Painel principal
- Janela de aplicativo em vidro, `border-radius: 22px`. Protótipo em 1280×780 com a janela inset 48/40 px.
- **Barra lateral**: 52 px recolhida, 204 px expandida (`width .42s`). Itens de 44 px: Expandir/Recolher, Dashboard (só gestor), Projetos, Agenda, Plug-ins (em breve), Ajustes; Conta (avatar com iniciais) na base.
- **Barra de título** (64 px): nome, controle segmentado "Minhas tarefas | Equipe · somente leitura" (estático), botão "Nova tarefa", controles de janela.
- **Quadro**: título do projeto com seta (abre o modal de projetos), 5 colunas iguais, gap 12 px, cards arrastáveis.
- **Detalhe da tarefa**: cabeçalho (voltar + título editável), coluna esquerda (Detalhes, Prazo, Custo, proporção 1.15) e coluna direita (Envolvidos, Linha do tempo, proporção 1), gap 16 px.
- **Dashboard**: barra empilhada de estados, 5 cards de porcentagem, tabela por colaborador.
- **Agenda**: calendário mensal (6 semanas × 7 dias, semana começa no domingo) + painel direito de **20% da largura (mín. 260 px)** com "Próximos agendamentos" e formulário que expande no lugar.

## Design Tokens Used
| Token | Valor | Uso |
|-------|-------|-----|
| `font-family` | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif` | Tudo (Inter é a reserva no Windows) |
| `text-primary` | `#F5F5F7` | Texto principal |
| `text-muted` | `#AEAEB2` | Rótulos, metadados |
| `text-placeholder` | `#9A9AA0` | Placeholders, desabilitado |
| `accent-text` | `#64A8FF` | Links, voltar, item selecionado |
| `primary-bg` | `rgba(11,102,228,.9)` (hover `rgba(30,118,238,.94)`) | Botão primário, texto branco |
| `glass-window` | `linear-gradient(150deg, rgba(255,255,255,.12), transparent 45%), rgba(30,33,42,.5)` + `backdrop-filter: blur(32px) saturate(170%)` | Bandeja e janela do painel |
| `glass-window-border` | `1px solid rgba(255,255,255,.14)` + realce interno `inset 0 1px 0 rgba(255,255,255,.24)` | Contorno |
| `shadow-window` | `0 28px 64px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)` | Elevação |
| `glass-group` | `rgba(255,255,255,.07)`, borda `rgba(255,255,255,.08)` | Grupos, cards, listas |
| `glass-control` | `rgba(255,255,255,.12)`, blur 8 px, borda `rgba(255,255,255,.16)` | Botões secundários (mais opacos, menos desfoque) |
| `glass-popover` | `rgba(48,52,64,.9)` + blur 20 px | Menus, modal, tooltip |
| `field-bg` | `rgba(118,118,128,.24)` | Inputs, busca, controle segmentado |
| `rail-bg` | `rgba(0,0,0,.18)` | Barra lateral |
| `status-planejamento` | `#BF5AF2` | Estado |
| `status-afazer` | `#C7C7CC` | Estado |
| `status-desenvolvendo` | `#64A8FF` | Estado |
| `status-revisar` | `#FF9F0A` | Estado |
| `status-concluido` | `#32D74B` | Estado |
| `manager` | texto `#FF8FA6`, fundo `rgba(255,100,130,.2)`, ponto `#FF6482` | Marca "Gestor" na linha do tempo |
| `danger` | `#FF6B60` (fechar em hover: `rgba(255,69,58,.9)`) | Excluir, fechar janela |
| `radius-window` / `-group` / `-field` / `-button` / `-chip` | 22 / 14 / 10–12 / 14 / 10 px | |
| `space` | 4, 8, 12, 16, 20, 24 px | Escala de espaçamento |
| `type` | 11 (chip), 12 (rótulo em caixa alta), 13–14, 15 (corpo), 17 (título/botão), 20, 24 (mês), 26–28 (títulos) | |
| `ease-ios` | `cubic-bezier(.32, .72, 0, 1)` | Todas as transições |
| `touch-target` | mínimo 44 px | Botões e linhas clicáveis |

## Components
| Componente | Variantes | Notas |
|-----------|-----------|-------|
| `WindowControls` | minimizar, expandir/recolher, fechar | 40×44 px cada. Na bandeja: minimizar recolhe para o cabeçalho (52 px), **expandir abre o painel**, fechar some com animação e deixa um botão redondo de 52 px (ícone de bandeja) para reabrir. No painel: o botão do meio **recolhe para a bandeja**. |
| `SegmentedControl` | 2 ou 3 opções | A seleção é um "polegar" que desliza (`transform .38s`). |
| `TaskRow` (bandeja) | normal, nova/atualizada | 64 px; título + chip de estado + projeto + "há quanto tempo". Linha nova entra com destaque azul. |
| `StatusChip` | 5 estados | Contorno e texto na cor do estado. |
| `GroupedList` / `FieldRow` | rótulo + controle | Linhas de 48 px, separadores de 1 px. |
| `StatusMenu` | aberto/fechado | Abre sob o campo, 224 px, itens de 44 px, check no atual. |
| `Toast` | sucesso | Aparece acima do rodapé, ✓ desenhado, some em ~2,6 s. |
| `Rail` / `RailItem` | recolhida, expandida | Tooltip só quando recolhida. Item ativo com fundo `rgba(255,255,255,.14)`. |
| `AccountMenu` | Colaborador / Gestor | **Só para demonstração no protótipo**: troca o perfil. No produto, o perfil vem do login. |
| `ProjectTitle` + `ProjectDialog` | lista, criando | Modal centrado com lista, check no atual, botão "Novo projeto" que vira campo + "Criar". Nome repetido apenas seleciona o existente. |
| `KanbanColumn` / `TaskCard` | normal, alvo de soltura, arrastando | Coluna de destino fica azulada. Card é um botão (abre detalhe) dentro de um contêiner arrastável. |
| `TaskDetail` | cards: Detalhes, Prazo, Custo, Envolvidos, Linha do tempo | Veja regras abaixo. |
| `StackedBar` | geral, por pessoa | Segmentos animam largura (`.5s`). |
| `StatCard` | 5 estados | Porcentagem grande + contagem. |
| `Calendar` / `DayCell` | normal, hoje, selecionado, fora do mês | Até 2 eventos por célula + "+N mais". Hoje: círculo azul no número. |
| `UpcomingList` | item clicável (gestor) | Dia · hora, título, iniciais dos participantes. |
| `MeetingForm` | recolhido, novo, edição | Expande no lugar (`grid-template-rows 0fr→1fr`), a lista encolhe. |

## States and Interactions
| Elemento | Estado | Comportamento |
|---------|--------|---------------|
| Botão primário | hover / active / disabled | Escurece levemente / escala .97 / cinza translúcido, sem sombra |
| Linha da lista | hover / active | Fundo +6% / +12% de branco |
| Busca da bandeja | digitando | Filtra por título e projeto; lista encolhe até 1 linha (mostra "Nenhuma tarefa encontrada.") |
| Aba Frequentes | sem itens | "Nada fixado ainda." |
| Criar tarefa | clique em "Criar tarefa" | **Cria e já abre o detalhe da nova tarefa** (título "Nova tarefa"). Salvar ou voltar leva à lista com o aviso "Tarefa criada" e a linha destacada. |
| Atualizar tarefa | Salvar | Volta à lista com "Atualização salva"; tarefa sobe para o topo de Recentes. |
| Coluna do kanban | cartão arrastado sobre ela | Contorno e fundo azulados; ao soltar, muda o estado e registra na linha do tempo ("moveu de X para Y"). |
| Detalhe: campos | só leitura (colaborador em tarefa alheia) | Campos desabilitados + selo "Somente leitura" |
| Custo | editar horas/valor | Subtotal e total recalculam na hora; valor/hora digitado (> 0) vira o novo padrão para envolvidos adicionados depois |
| Linha do tempo | qualquer edição | Nova entrada no topo (data e hora, quem, o quê). Texto, descrição, horas e valor/hora são registrados **ao sair do campo** (não a cada tecla). |
| Gestor vendo outro colaborador | quadro aberto via Dashboard | Faixa "Tarefas de X · editando como Gestor" + botão "Voltar às minhas" |
| Calendário | clicar num dia | Seleciona o dia e define a data do formulário (não abre o formulário) |
| Agenda: "Adicionar evento" / "Novo agendamento" | clique | Abre o formulário no painel direito com a data do dia selecionado |
| Agenda: item da lista (gestor) | clique | Abre o formulário em modo edição, com "Excluir" |
| Agenda (colaborador) | | Botões desabilitados + "Só o gestor cria e edita agendamentos." |

## Regras de negócio
- **Estados** (ordem do fluxo): Planejamento, A fazer, Desenvolvendo, Revisar, Concluído. "Bloqueado" foi removido; se for necessário, será uma marca, não um estado.
- **Permissões**: colaborador vê e edita apenas tarefas em que é o responsável. Gestor: tudo, mais Dashboard e agenda. Item "Dashboard" só aparece para o gestor.
- **Custo**: `subtotal = horas × valor_hora` (aceitar vírgula decimal); `total = Σ subtotais`; moeda BRL (`pt-BR`).
- **Prazo**: texto auxiliar "Em N dias", "Vence hoje", "Vence amanhã", "Venceu há N dias", "Concluída" (se concluída) ou "Sem prazo definido".
- **Dashboard**: porcentagem de itens em cada estado (todos os projetos e colaboradores), barra empilhada, e por colaborador: nº de itens, barra de estados, % concluído e botão "Abrir projetos".
- **Linha do tempo**: tipos registrados hoje: criar tarefa, mudar estado (incluindo por arrastar), mudar prazo, renomear, editar descrição, ajustar horas, ajustar valor/hora, adicionar/remover envolvido. Cada entrada guarda `quem`, `como_gestor (bool)`, `quando`, `texto`.

## Responsive Behavior
Aplicativos de desktop. Não há breakpoints de celular.
| Janela | Mudanças |
|--------|----------|
| Bandeja 340–400 px | Conteúdo rola dentro da janela se a altura for reduzida; o rodapé fica fixo |
| Painel ≥ 1100 px | Layout de referência |
| Painel menor | Barra lateral fica recolhida (52 px); colunas do kanban encolhem (títulos quebram em 2 linhas) |

## Edge Cases
- **Vazio**: coluna "Sem tarefas"; projeto novo sem tarefas; "Nada marcado." na lista de agendamentos; "Sem atualizações ainda." onde houver lista de recentes.
- **Texto longo**: títulos da bandeja e da barra de título cortam com reticências; eventos no calendário cortam com reticências (a célula **nunca** cresce com o conteúdo).
- **Muitos itens**: lista da bandeja rola (barra de 3 px); calendário mostra "+N mais"; linha do tempo rola.
- **Prazo vencido**: texto "Venceu há N dias".
- **Datas**: usar data local do usuário; semana começa no domingo; formatar `Qui, 05 nov`.
- **Sem suporte a `backdrop-filter`**: usar fundo sólido `rgba(30,33,42,.92)` como alternativa.
- **Carregando / erro / offline**: ainda não desenhados; usar esqueleto de linhas e mensagem curta no mesmo padrão de vidro, e confirmar comigo.

## Animation / Motion
| Elemento | Gatilho | Animação | Duração | Easing |
|---------|---------|----------|---------|--------|
| Janela (bandeja/painel) | abrir | sobe 18 px, escala .96→1, desfoque 6→0 px | 600 ms | ease-ios |
| Tela da bandeja | avançar / voltar | desliza 30 px da direita / da esquerda + fade | 450 ms | ease-ios |
| Altura/largura da bandeja | mudar de tela / arrastar | transição de `height`/`width` (sem transição durante o arraste) | 450 ms | ease-ios |
| Polegar do segmentado | trocar opção | `translateX` | 380 ms | ease-ios |
| Linha nova | criar/atualizar | desce 14 px com destaque azul que some | 600 ms | ease-ios |
| Toast | salvar | sobe 14 px + ✓ desenhado (traço) | 500 ms (+200 ms de atraso no ✓) | ease-ios / ease |
| Menu de status | abrir | escala .92→1 a partir do canto | 280 ms | ease-ios |
| Seta do projeto/menu | abrir | gira 180° | 320 ms | ease-ios |
| Bandeja fechando | fechar | desce 16 px, escala .96, some | 320 ms | ease-ios |
| Visão do painel | trocar de tela | sobe 10 px + fade | 450 ms | ease-ios |
| Cards do kanban | aparecer / hover | sobe 8 px / sobe 2 px | 450 ms / 250 ms | ease-ios |
| Modal de projetos | abrir | fundo escurece + desfoca; caixa sobe 14 px e escala .95→1 | 300 / 420 ms | ease / ease-ios |
| Formulário de agendamento | abrir/fechar | altura de 0 a auto | 500 ms | ease-ios |
| Barra empilhada | mudar dados | largura | 500 ms | ease-ios |
| Todos | `prefers-reduced-motion` | animações e transições praticamente desligadas | | |

## Accessibility Notes
- **Ordem de foco**: barra lateral → barra de título → conteúdo → rodapé. Modais prendem o foco e fecham com Esc ou clique no fundo; devolver o foco ao botão que abriu.
- **Alvos de toque/clique** ≥ 44 px.
- **Contraste**: texto ≥ 4,5:1 sobre o vidro. Estados nunca dependem só da cor (sempre há rótulo de texto).
- **Rótulos**: botões só com ícone têm `aria-label` (voltar, fechar, mês anterior/próximo, controles de janela, remover envolvido). Campos têm `<label>` ou `aria-label`.
- **Papéis**: segmentado e abas com `aria-pressed`; menu de status com `role="menu"` + `menuitemradio`; modal com `role="dialog"` e `aria-modal`; toast com `role="status"`; polegar do segmentado é decorativo (`aria-hidden`).
- **Teclado**: barrinha de redimensionar responde às setas e à tecla Home; calendário e cards acessíveis por Tab; arrastar cards precisa de alternativa por teclado (mudar o estado no detalhe da tarefa já existe).
- **Foco visível**: contorno de 2 px azul (`#64A8FF`) com offset 2 px.
