# Plano: fidelidade ao design e correções de uso (feedback do Pedro)

Fonte do design: as 20 telas do canvas https://claude.ai/artifact/44oUTvqBoCHF7hgrBZ4LRz, já baixadas em
`/tmp/claude-0/-home-user-agilebox-handoff/6806f754-dce0-5bb5-abb0-33baa9a0be29/scratchpad/canvas/project/*.dc.html`
(se sumirem: reler pelo Artifact `read` com `paths`). `canvas.json` dá número e título de cada tela.
Os `.dc.html` são só referência visual: ler o markup e o CSS inline para extrair medidas, cores, textos e estrutura; reimplementar na stack.

## Problemas relatados (por prioridade)

1. **URGENTE · Fidelidade ao design.** Boa parte das telas não segue o canvas. Cada tela deve ficar exatamente como desenhada: estrutura, textos, medidas, cores, tipografia, estados.
   Divergência já vista: a barra lateral do app é uma lista plana; o design (ex.: `Modulos.dc.html`) tem Início/Agenda/Dashboard no topo, seção "Projeto" com o nome do projeto + rótulo da metodologia (Ágil/Kanban/Trad.) e subitens (Quadro, Backlog, Sprints com "S4", Burndown, Módulos com contagem), seção "Outros projetos", "Novo projeto", Ajustes e usuário.
2. **Guia estático.** Não faz a ponte entre as funcionalidades que descreve e some fora do quadro. Deve aparecer em todas as telas em que estiver guiando passo a passo, até o fim do fluxo, com ação que leva à tela do passo.
3. **Botão "+" explícito** para incluir Backlog, Subtarefa, Critério (de pronto/aceite) etc.: hoje só há rótulo, sem botão que deixe claro como incluir.
4. **Cartões ao arrastar ficam fora do ponteiro.** O cartão deve ficar ancorado no ponto em que o usuário clicou.

## Ordem de trabalho (um agente Haiku por passo, revisar, `pnpm check` verde, commit e push)

- [x] F1 Barra lateral conforme o design (estrutura do projeto, subitens, rótulos, contagens, ícones, medidas).
- [x] B1 Arrastar cartões ancorados no ponto do clique (item 4).
- [x] B2 Botão "+" nos pontos de inclusão (item 3).
- [x] B3 Guia em todas as telas do passo a passo, com ponte entre funcionalidades (item 2).
- [ ] F2a Textos do domínio conforme o design nas telas 01/02: propósito do preset e motivo por módulo gerados pelas respostas (como em Recomendacao.dc.html), nomes "Estimativa" e "Burndown", nota "Os outros N ficam em Módulos" com link "Ver todos", regra de "Algumas vezes" (extras fora da lista, só na nota). Mexe no `core`: manter testes, atualizar só o que o design exigir.
- [ ] F2.. Auditoria e ajuste tela a tela contra o canvas, na ordem 01, 02, 03, 04, 05, 06, 07 ... 20. Cada passo: comparar markup do `.dc.html` com a tela do app (medidas, textos, estados), listar divergências, corrigir, atualizar testes sem enfraquecê-los.
  - [x] 01 wizard · [x] 02 recomendação (estrutura e medidas; textos do core em F2a) · [ ] 03 módulos (inclui painel "Proposta" lateral, que depende da regra "gestor propõe, equipe aceita" ainda indefinida: registrar, não inventar) · [ ] 04 primeiros passos · [ ] 05 botão ? · [ ] 06 boas-vindas
  - [ ] 07 planejar sprint · [ ] 08 sprint ativa · [ ] 09 critério de pronto ao concluir · [ ] 10 burndown · [ ] 11 encerrar sprint/retro · [ ] 12 comparação
  - [ ] 13 EAP · [ ] 14 cronograma · [ ] 15 acompanhamento · [ ] 16 guia tradicional · [ ] 17 híbrido plano · [ ] 18 híbrido sprint
  - [ ] 19 dashboard do gestor · [ ] 20 atualizações filtradas

## Regras

- Responder em pt-BR. Seguir `CLAUDE.md` (camadas, tokens, `prefers-reduced-motion`) e `docs/PLANO.md`.
- Não inventar requisito: o que o design mostra e o app ainda não tem (ex.: votação da equipe) vira pendência em `pendencias-do-pedro.md`, não código especulativo.
- Onde o design e o ADR-10 divergem, o design vale (decisão anterior do Pedro).
- Registrar dúvidas e divergências deliberadas em `pendencias-do-pedro.md`.
