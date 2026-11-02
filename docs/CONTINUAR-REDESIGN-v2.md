# Continuação do redesign v2

## Pedido e estado

Pedro aprovou a implementação conforme os documentos e pediu encerrar esta rodada, priorizando o que já estava em andamento. **O redesign não está concluído.** Não marcar o objetivo completo com base apenas nos testes.

Leia este arquivo e a seção “Redesign v2” de `PROGRESS.md` antes de continuar. Fontes de verdade:

- `design/design_two/agilebox-redesign-v2/docs/HANDOFF-v2.md`
- `design/design_two/agilebox-redesign-v2/docs/REDESIGN-v2-ESCOPO.md`
- ADR 0004 no mesmo diretório, tokens-v2.css e protótipos v2.
- `docs/HANDOFF.md`, `docs/PLANO.md`, `docs/MVP.md` e `AGENTS.md` para comportamento e arquitetura preservados.

A implementação feita cobre a fase A. Recursos de fases B/C continuam fora: prioridade, bloqueio, subtarefas, limites de WIP, comentários, recorrência, daily, commits e visão Equipe. Não criar dados ou capacidades que não existem no modelo.

## O que já está implementado

- Tokens v2 e três fontes offline instaladas: Geist, Geist Mono e Bricolage Grotesque. Build empacota as fontes.
- Componentes base ajustados; componentes novos de indicadores, gráficos, Drawer e CommandPalette. Controles base têm área clicável de 44 px e tamanho visual separado por CSS.
- Barra lateral 232 px, projetos reais com contagens e filtro, marca, conta, busca/paleta e início da bandeja; Plug-ins desabilitado.
- Quadro com superfícies sólidas, cartões v2, sinais/filtros Paradas e Vencidas, cabeçalho consolidado, aviso compacto de gestor e criação pelo + de cada coluna.
- Detalhe não modal sobre o quadro, seleção de cartão, troca de tarefa, tela cheia, Esc/retorno de foco, propriedades em coluna única e atividade agrupada sem remover eventos.
- Alerta de parada e confirmação “Segue em andamento”. Evento `progress_confirmed`, sem mudar o estado ou reiniciar a regra de parada. Permissões e marca Gestor mantidas.
- Regras puras de parada, vencimento, fluxo, semanas, snapshots históricos, mudanças recentes e parser de criação rápida.
- Dashboard de gestor com adesão, exceções, fluxo semanal, mudanças recentes e equipe. Seletor altera fluxo/adesão; exceções/equipe/mudanças são atuais. Sparkline mantém lacunas de semanas sem dados. PLANO 6.5 atualizado.
- Agenda Dia/Semana/Mês, Semana padrão, prazos clicáveis, consultas que atravessam meses, eventos com 1h na fase A, sobreposições lado a lado e lista de horários fora de 08–18. Próximos com participantes e limite de dois itens ao abrir formulário. Estados de carga/erro e permissões.
- Paleta Ctrl/Cmd K, tokens, busca existente, Enter/Shift Enter, navegação por setas, Tab completar e foco. Atalhos N e G Q/A/D fora de campos/modais, Dashboard só gestor.
- Criação atômica com prazo/responsável/estado, tarifa padrão própria e histórico. Bandeja tem saudação, Em foco, sinais, rodapé com parser e criação rápida; formulário anterior também interpreta metadados.

### Última implementação desta rodada

`tasks.getBoardFlow` foi adicionado ao contrato, cliente IPC, registro de handlers e casos de uso. Compartilha `scopedBoard` com `listBoard`, respeitando organização, projeto, participação e filtro por pessoa exclusivo do gestor. Calcula ciclo semanal com `flowMetrics` e mostra no rodapé de Concluído; ausência de histórico é “—”, erro é informado. A alteração não depende do dashboard e não altera o banco.

Testes específicos provaram ciclo de 3 dias, exclusão de tarefas alheias, recusa de filtro por outro usuário ao colaborador e exibição de `4,2d` no rodapé. Não remover a sanitização dos campos opcionais no handler IPC (`exactOptionalPropertyTypes`).

## Pendências importantes, em ordem sugerida

1. **Revisar visualmente as telas reais do desktop**, incluindo bandeja em 360 px e alturas automáticas/mínima, quadro em 1280/1100, detalhe, dashboard, agenda e paleta. A galeria sozinha não comprova essas telas.
2. Repetir a captura da galeria após os últimos ajustes em controles, fundo e dica. Conferir os três tamanhos de fonte e as famílias efetivamente carregadas. Não aplicar regras genéricas da skill que contrariem vidro, violeta, mono e sombras explicitamente definidos no handoff.
3. Auditar A1–A11 requisito por requisito. Os registros “em andamento” são intencionais. Conferir medidas e estados, alvos clicáveis dos chips da agenda, contraste, textos, reduced-motion e layouts pequenos. Conferir tamanho visual dos itens da barra e dos segmentados próprios do cabeçalho.
4. Completar o que faltar no quadro: indicador de atualização, estado global vazio e filtros previstos compatíveis com o modelo. **Área não existe no DTO/modelo atual; não inventar áreas.** O rodapé de ciclo foi implementado nesta rodada.
5. **Copiar link da tarefa ainda não implementado.** Não existe protocolo de deep link no aplicativo. Não gerar um link fictício; resolver explicitamente o destino e a abertura antes de considerar esse requisito pronto.
6. Revisar bandeja: saudação/busca/segmentados/lista precisam caber com rolagem acima do rodapé sem alterar a fórmula de altura especificada. Conferir N, criação por Enter, escolha de projeto, transições e atualização entre janelas.
7. Rodar verificações completas após qualquer correção e, quando possível, testar Electron real/Windows/Fedora. E2E/instalador e pendências antigas do MVP não foram declarados concluídos por este redesign.

## Verificação e ambiente

- A suíte completa anterior à última consulta de ciclo passou com **918 testes**. Verificação global de tipos, lint, formatação e build também passou nessa rodada anterior.
- Após adicionar a consulta de ciclo: **169 testes de contrato/aplicação/main** passaram, **29 testes específicos de listas/painel** passaram e a checagem global de tipos passou antes dos últimos testes adicionados. A verificação final desta rodada passou: **921 testes em 116 arquivos**, formatação global, lint global, checagem global de tipos e build electron-vite. Não somar execuções sobrepostas.
- Os testes de UI (37) e painel/gestor (29) passaram após ajustes de controles/cabeçalho na rodada anterior.
- `eslint.config.js` ignora `.agents/**`, que contém código externo da skill. As regras do código do aplicativo foram preservadas.
- `panel/main.tsx` passou a inicializar IPC apenas no app; a galeria pode abrir no navegador sem a ponte Electron.
- Capturas/relatório da galeria: `/tmp/agilebox-gallery-v2`. A primeira captura vazia foi superada; a seguinte renderizou componentes. Foi inspecionada a imagem de 1440 px. Overflow da dica em 800 px foi corrigido depois, mas ainda requer nova medição. Os avisos genéricos da skill não equivalem à aprovação do handoff.
- O servidor de revisão foi encerrado ao final da rodada. Ele havia sido iniciado em `http://127.0.0.1:5178/panel/index.html?gallery&glass=opaque`. Revalidar se ainda está ativo antes de reutilizar. Não usar o navegador comum como prova dos fluxos IPC de Electron.

## Comandos para retomar

Pedro executa instalação e git; não houve commit desta implementação. Usar os scripts documentados (`pnpm check`, `pnpm dev`) sem reinstalar dependências automaticamente. Nesta sessão, ferramentas foram chamadas diretamente para evitar instalação implícita do pnpm:

```sh
node node_modules/prettier/bin/prettier.cjs --check .
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node node_modules/typescript/bin/tsc -p tsconfig.eslint.json
node node_modules/vitest/vitest.mjs run
```

Build, a partir de `apps/desktop`:

```sh
node node_modules/electron-vite/bin/electron-vite.js build
```

Os scripts normais também conferem ABI do `better-sqlite3`; se houver incompatibilidade ao alternar Node/Electron, seguir `scripts/ensure-native.mjs` e a documentação existente.

Há alterações preexistentes do Pedro em `.gitignore`, movimentação dos protótipos (`design/design_one` / `design/design_two`), arquivos antigos removidos e skill instalada. **Não desfazer nem confundir essas alterações com o trabalho do redesign.** Verificar o worktree atual; não fazer reset ou commit automático.
