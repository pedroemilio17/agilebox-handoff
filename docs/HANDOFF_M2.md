# AgileBox — handoff de design (M2)

Fonte visual: https://claude.ai/artifact/TX9ZfHP66SNXsxH4RftMaQ
Cada quadro é um arquivo `project/<Nome>.dc.html` do artefato. Em caso de dúvida de espaçamento ou cor, o quadro vence este texto.

## 1. Quadros

| #   | Quadro      | Cobre                          |
| --- | ----------- | ------------------------------ |
| 00  | Main        | Sistema visual (tokens abaixo) |
| 01  | Bandeja     | Bandeja e daily assíncrona     |
| 02  | Quadro      | Kanban com detalhe em painel   |
| 03  | Dashboard   | Dashboard do gestor            |
| 04  | Agenda      | Agenda semanal                 |
| 05  | Comandos    | Ctrl+K: criar e buscar         |
| 06  | Ferramentas | Decisões 2, 4, 5, 6 do M2      |
| 07  | Níveis      | Decisão 3 do M2                |
| 08  | Ações       | M0.9b e M0.11                  |

## 2. Tokens

**Superfícies:** tinta `#111015` · barra lateral `#0d0c11` · painel `#17161c` · cartão `#1d1c23` · elevado `#26252d` · selecionado `#2a2932`
**Texto:** `#f2f0f6` · secundário `#b3b0bd` · terciário `#8d8a97`
**Ação (única cor forte):** `#c8f03c` (texto sobre ela `#15160c`). Opções de tema: `#ff7a4d`, `#9d8cff`, `#4fd0c4`.
**Bordas:** `rgba(255,255,255,.07)` padrão · `.10` controles · `.12–.14` realce.
**Estados (pontos de 9px, nunca barras):** planejamento `#a99cf7` · a fazer `#8d8a97` · desenvolvendo `#6cb4ff` · revisar `#4fd0c4` · concluído `#6fd39a`.
**Sinais (só quando exige ação):** erro/bloqueio fundo `rgba(255,107,125,.14)` texto `#ff8a98` · atenção fundo `rgba(242,180,90,.14)` texto `#f4c27a`.
**Vidro (só camadas flutuantes: menus, toasts, painel de prévia):** `background:rgba(38,37,46,.72); backdrop-filter:blur(20px); box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 0 0 1px rgba(255,255,255,.09),0 24px 50px rgba(0,0,0,.55)`.
**Tipografia:** Bricolage Grotesque (títulos, números grandes) · Geist 13–15px (interface) · Geist Mono (IDs, horários, métricas, atalhos; rótulos em caixa alta 11px, `letter-spacing:.08em`).
**Raios:** botão/campo 10 · cartão 12–14 · painel 16–18 · chip 8.
**Alvos de toque:** mínimo 44px. Interruptor é `<button role="switch" aria-checked>`; menu é `role="menu"` com `role="menuitem"`.

## 3. Decisões do M2 (propostas, aguardam confirmação)

1. **Dependências:** check-ins, impedimentos e retro dependem de Sprints; aceite depende de Backlog; Agenda e Integrações são independentes. Integrações começa desligada.
2. **Tela Ferramentas** (quadro 06): cartões por ferramenta com interruptor, dependência, sinal de estado; painel de prévia em vidro à direita com Aplicar/Cancelar. Item "Ferramentas" na barra lateral, visível só para gestor.
3. **Níveis** (quadro 07). Nomes provisórios: Essencial, Padrão (sugerido), Avançado. Menu: Essencial = Início, Quadro, Agenda · Padrão = + Backlog, Sprints, Dashboard · Avançado = + Impedimentos, Integrações, Ferramentas (só gestor). Campos da tarefa: Essencial = título, estado, prazo · Padrão = + responsáveis, estimativa, linha do tempo, e "Campos avançados" recolhido · Avançado = + custo por hora, dependências, critérios de aceite, etiquetas, sempre visíveis. Regra: item de menu aparece só se o nível libera **e** a ferramenta está ligada. Subir de nível não perde dados.
4. **Presets:** Quadro simples (Backlog + Quadro) · Scrum do time (+ Sprints, check-ins, impedimentos, retro) · Completo (tudo, com Integrações). Presets que citam módulos do M10 ficam fora até o M10 existir.
5. **Encerramento gradual:** a prévia mostra o que sai junto e o destino por tipo de item. Proposto: check-ins e retros arquivados em somente leitura; impedimentos abertos viram tarefa no Backlog; tarefas permanecem no Quadro. Fica no histórico do time com data e autor. **Os destinos por tipo precisam ser confirmados contra o PROGRESS_2.md.**
6. **Aviso de nível:** texto "Vale para o time inteiro. Os outros times não mudam." (escopo é o time, não o projeto).
7. **M0.9b/M0.11:** renomear no lugar (clique no título ou F2, Enter salva, Esc cancela); Arquivar no menu "⋯" do cabeçalho da tarefa (atalho E); mesmo menu para projeto na barra lateral (aparece ao passar o mouse). Sem confirmação. Desfazer em toast de vidro no canto inferior esquerdo por 8s, com barra de tempo e atalho Ctrl Z. Projeto arquivado volta por Ajustes; arquivar tarefa não apaga a linha do tempo.

## 4. Ordem sugerida de implementação

1. Tokens e componentes base (botão, secundário, segmentado, campo, cartão, chip de sinal, interruptor, menu de vidro, toast).
2. Barra lateral com item Ferramentas e filtro por nível + ferramentas ligadas.
3. Tela Ferramentas ligada a `GetTeamModules` e à prévia de `ChangeTeamModules`.
4. Campos da tarefa por nível.
5. Renomear, Arquivar e Desfazer (cobre M0.9b e M0.11).

## 5. Acessibilidade

Texto 4.5:1 mínimo. Estado nunca só por cor: sempre texto ou ícone junto. Botões de ícone com `aria-label`. Toast com `role="status"`. Respeitar `prefers-reduced-motion`.
