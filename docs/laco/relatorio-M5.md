# Relatório do marco M5

- Data: 2026-11-01 10:18
- Passos concluídos: 11
- Tag git: `marco-M5`
- Verificações (`format:check`, `lint`, `typecheck`, `test`): **passaram** no fechamento do marco

## Passos e commits

- `e2c8570` M5.1 Electron, Vite e ferramentas de teste de interface
- `441b0a3` M5.2 Tokens, estilos base e fonte
- `549197b` M5.3 Componentes de base I
- `7bb46f4` M5.4 Componentes de base II
- `8d1a5f1` M5.5 Componentes de base III
- `ef10ce6` M5.6 Galeria de componentes (só desenvolvimento)
- `bf0d9cb` M5.7 Main: composition root, sessão e notificador de mudanças
- `6a5ecd6` M5.8 Main: IPC com validação
- `520b85a` M5.9 Preload e camada de dados do renderer
- `a2f5368` M5.10 Janelas, vidro e ciclo de vida
- `d9a22b0` M5.11 Painel esqueleto ponta a ponta

## Testes

```
Test Files  86 passed (86)
Tests  710 passed (710)
```

## Cobertura

```
 ...c/repositories |   82.28 |    58.33 |   85.96 |   88.38 |
  ...positories.ts |   88.23 |    71.42 |   93.33 |   93.54 | 94-99
  ...repository.ts |   93.02 |     62.5 |     100 |     100 | 53-122
  ...positories.ts |   75.51 |    54.54 |   77.41 |   81.39 | ...04,114-135,175
 ...ite/src/schema |    27.9 |      100 |       0 |    27.9 |
  contributors.ts  |   33.33 |      100 |       0 |   33.33 | 9-16
  index.ts         |       0 |        0 |       0 |       0 |
  ...l-settings.ts |     100 |      100 |     100 |     100 |
  ...rticipants.ts |      25 |      100 |       0 |      25 | 10-15
  meetings.ts      |      25 |      100 |       0 |      25 | 11-21
  organizations.ts |     100 |      100 |     100 |     100 |
  ...ct-members.ts |      20 |      100 |       0 |      20 | 10-19
  projects.ts      |      25 |      100 |       0 |      25 | 11-19
  task-events.ts   |      25 |      100 |       0 |      25 | 11-20
  task-opens.ts    |      25 |      100 |       0 |      25 | 10-17
  ...icipations.ts |      20 |      100 |       0 |      20 | 13-21
  tasks.ts         |      20 |      100 |       0 |      20 | 13-32
  users.ts         |   33.33 |      100 |       0 |   33.33 | 11-19
 ...qlite/src/seed |   96.55 |    92.85 |      80 |   96.29 |
  data.ts          |     100 |      100 |     100 |     100 |
  seed.ts          |   96.49 |    92.85 |      80 |   96.22 | 49-51
 ui/src            |       0 |        0 |       0 |       0 |
  index.ts         |       0 |        0 |       0 |       0 |
 ui/src/components |   96.87 |     82.6 |   95.12 |   96.59 |
  Avatar.tsx       |     100 |      100 |     100 |     100 |
  Button.tsx       |     100 |      100 |     100 |     100 |
  EmptyState.tsx   |     100 |       50 |     100 |     100 | 17
  Fields.tsx       |     100 |      100 |     100 |     100 |
  GlassSurface.tsx |     100 |      100 |     100 |     100 |
  GroupedList.tsx  |     100 |      100 |     100 |     100 |
  IconButton.tsx   |     100 |      100 |     100 |     100 |
  Modal.tsx        |     100 |       75 |     100 |     100 | 20-27,38
  ...OnlyBadge.tsx |     100 |      100 |     100 |     100 |
  ...edControl.tsx |     100 |      100 |     100 |     100 |
  Skeleton.tsx     |     100 |      100 |     100 |     100 |
  StatusChip.tsx   |     100 |      100 |     100 |     100 |
  StatusMenu.tsx   |    87.5 |    66.66 |   85.71 |   86.66 | 50-51
  Toast.tsx        |   92.85 |      100 |   85.71 |    90.9 | 35
  Tooltip.tsx      |     100 |      100 |     100 |     100 |
  ...wControls.tsx |     100 |       50 |     100 |     100 | 31-34
 ui/src/hooks      |    90.9 |    86.66 |   92.85 |   94.73 |
  ...focus-trap.ts |    92.3 |    90.47 |     100 |    91.3 | 25-26
  ...ced-motion.ts |    90.9 |      100 |      80 |     100 |
  ...tore-focus.ts |   85.71 |    71.42 |     100 |     100 | 5-9
-------------------|---------|----------|---------|---------|-------------------
```

## Dependências adicionadas neste marco

```
"date-fns": "^4.4.0"
"electron": "^45.2.1"
"electron-vite": "^6.0.0"
"@fontsource-variable/inter": "^5.3.0"
"react": "^19.3.1"
"react-dom": "^19.3.1"
"@tanstack/react-query": "^5.105.0"
"@testing-library/jest-dom": "^7.0.1"
"@testing-library/react": "^16.3.3"
"@testing-library/user-event": "^14.6.8"
"@types/node": "^26.6.6"
"@types/react": "^19.3.0"
"@types/react-dom": "^19.3.0"
"vite": "^8.3.5"
"@vitejs/plugin-react": "^6.1.2"
```

## Arquivos alterados

```
 packages/ui/src/components/EmptyState.test.tsx     |  15 ++
 packages/ui/src/components/EmptyState.tsx          |  21 ++
 packages/ui/src/components/Fields.module.css       |  46 ++++
 packages/ui/src/components/Fields.test.tsx         |  33 +++
 packages/ui/src/components/Fields.tsx              |  68 ++++++
 packages/ui/src/components/GlassSurface.module.css |  36 +++
 packages/ui/src/components/GlassSurface.test.tsx   |  17 ++
 packages/ui/src/components/GlassSurface.tsx        |  14 ++
 packages/ui/src/components/GroupedList.module.css  |  32 +++
 packages/ui/src/components/GroupedList.test.tsx    |  21 ++
 packages/ui/src/components/GroupedList.tsx         |  37 +++
 packages/ui/src/components/IconButton.module.css   |  22 ++
 packages/ui/src/components/IconButton.test.tsx     |  12 +
 packages/ui/src/components/IconButton.tsx          |  15 ++
 packages/ui/src/components/Modal.module.css        |  21 ++
 packages/ui/src/components/Modal.test.tsx          |  61 +++++
 packages/ui/src/components/Modal.tsx               |  59 +++++
 .../ui/src/components/ReadOnlyBadge.module.css     |  11 +
 packages/ui/src/components/ReadOnlyBadge.test.tsx  |  12 +
 packages/ui/src/components/ReadOnlyBadge.tsx       |  10 +
 .../ui/src/components/SegmentedControl.module.css  |  47 ++++
 .../ui/src/components/SegmentedControl.test.tsx    |  53 +++++
 packages/ui/src/components/SegmentedControl.tsx    |  54 +++++
 packages/ui/src/components/Skeleton.module.css     |  24 ++
 packages/ui/src/components/Skeleton.test.tsx       |  14 ++
 packages/ui/src/components/Skeleton.tsx            |  16 ++
 packages/ui/src/components/StatusChip.module.css   |  26 +++
 packages/ui/src/components/StatusChip.test.tsx     |  18 ++
 packages/ui/src/components/StatusChip.tsx          |  18 ++
 packages/ui/src/components/StatusMenu.module.css   |  31 +++
 packages/ui/src/components/StatusMenu.test.tsx     |  52 +++++
 packages/ui/src/components/StatusMenu.tsx          |  62 +++++
 packages/ui/src/components/Toast.module.css        |  20 ++
 packages/ui/src/components/Toast.test.tsx          |  41 ++++
 packages/ui/src/components/Toast.tsx               |  37 +++
 packages/ui/src/components/Tooltip.module.css      |  22 ++
 packages/ui/src/components/Tooltip.test.tsx        |  23 ++
 packages/ui/src/components/Tooltip.tsx             |  21 ++
 .../ui/src/components/WindowControls.module.css    |  24 ++
 packages/ui/src/components/WindowControls.test.tsx |  35 +++
 packages/ui/src/components/WindowControls.tsx      |  47 ++++
 packages/ui/src/hooks/use-focus-trap.test.tsx      |  25 ++
 packages/ui/src/hooks/use-focus-trap.ts            |  39 ++++
 packages/ui/src/hooks/use-reduced-motion.test.tsx  |  31 +++
 packages/ui/src/hooks/use-reduced-motion.ts        |  20 ++
 packages/ui/src/hooks/use-restore-focus.test.tsx   |  19 ++
 packages/ui/src/hooks/use-restore-focus.ts         |  14 ++
 packages/ui/src/index.ts                           |  45 +++-
 packages/ui/src/styles/base.css                    |  70 ++++++
 packages/ui/src/styles/fallback.css                |  10 +
 packages/ui/src/styles/motion.css                  | 251 +++++++++++++++++++++
 packages/ui/src/styles/tokens.css                  |  88 ++++++++
 packages/ui/src/styles/tokens.test.ts              |  87 +++++++
 packages/ui/tsconfig.json                          |   2 +-
 packages/ui/vite-env.d.ts                          |   1 +
 packages/ui/vitest.setup.ts                        |   1 +
 tooling/eslint-boundaries.test.ts                  |   2 +-
 tsconfig.eslint.json                               |   3 +-
 vitest.config.ts                                   |  38 ++++
 124 files changed, 3929 insertions(+), 25 deletions(-)
```

## Pontos de revisão sugeridos

Pedro roda `pnpm dev` (no Windows e no Linux), confere a galeria e o painel esqueleto, e decide o vidro (0001-vidro.md).

## Notas dos passos (PROGRESS.md)

- [x] M5.1 Electron, Vite e ferramentas de teste de interface
  - Nota: Configurado o Electron/Vite 6.0.0 com entradas main/preload e páginas painel/bandeja; dependências internas ficam empacotadas. Adicionados tipos, scripts desktop/raiz e projetos Vitest para main/preload (Node) e renderer (jsdom), com jest-dom no setup.
  - Nota: `pnpm check` passou (654 testes). O build do desktop gerou as três saídas; `native:electron` não baixou o binário por indisponibilidade de rede, portanto a execução do app não foi verificada. O typecheck agregado usa `skipLibCheck` para ignorar declarações externas incompatíveis/faltantes, mantendo as verificações do código-fonte.
- [x] M5.2 Tokens, estilos base e fonte
  - Nota: Tokens, reset, foco visível, rolagem de 3 px e fonte Inter local foram ligados às entradas do painel e da bandeja.
  - Nota: Animações do HANDOFF, `prefers-reduced-motion`, fallback de vidro e hooks de foco/movimento estão implementados e cobertos.
  - Nota: O projeto Vitest de UI resolve `?raw` de CSS por plugin de teste, pois o resolver padrão retornava string vazia; o teste verifica todos os tokens.
  - Nota: `pnpm check` passou (658 testes); conferir visualmente a fonte, o foco, a rolagem e movimento reduzido, inclusive no Windows.
- [x] M5.3 Componentes de base I
  - Nota: Implementados os oito componentes com CSS Modules, exportações públicas e testes específicos por componente para rótulos, estados e acessibilidade.
  - Nota: `pnpm check` passou (64 arquivos, 671 testes); conferir o acabamento visual na galeria quando M5.6 estiver disponível.
- [x] M5.4 Componentes de base II
  - Nota: Implementados os componentes e exportações públicas; testes cobrem rótulos, seleção por teclado, estados acessíveis e entrada decimal com vírgula.
  - Nota: `pnpm check` passou (67 arquivos, 676 testes); conferir visualmente os componentes na galeria M5.6.
- [x] M5.5 Componentes de base III
  - Nota: Implementados os cinco componentes com CSS Modules, exportações públicas e testes de teclado, foco, papéis ARIA e duração do aviso.
  - Nota: `pnpm check` passou (72 arquivos, 684 testes); conferir visualmente menu, modal, toast, tooltip e controles na galeria M5.6.
- [x] M5.6 Galeria de componentes (só desenvolvimento)
  - Nota: A galeria apresenta todos os componentes exportados, incluindo segmentado de 2 e 3 opções, campo desabilitado e estados interativos; `?gallery` continua condicionado a `import.meta.env.DEV`.
  - Nota: Testes cobrem renderização, acessibilidade dos exemplos, troca de opção e abertura/fechamento do modal. `pnpm check` passou (73 arquivos, 686 testes), sem dependências novas.
- [x] M5.7 Main: composition root, sessão e notificador de mudanças
  - Nota: Composition root conecta SQLite, relógio, gerador de IDs, sessão e broadcaster; semeia banco vazio apenas fora de produção.
  - Nota: Sessão começa em Pedro e persiste a troca de usuário em `local_settings`; broadcaster envia mudanças a todas as janelas abertas.
  - Nota: `pnpm check` passou (77 arquivos, 690 testes). `skipLibCheck` no desktop contorna declarações incompletas de dependências opcionais do Drizzle.
- [x] M5.8 Main: IPC com validação
  - Nota: O handler valida antes da execução, injeta o ator da sessão e converte erros tipados em `Result`; exceções inesperadas retornam mensagem genérica com `CONFLICT`, único código contratual disponível para esse caso.
  - Nota: Os 33 canais da API estão ligados explicitamente aos respectivos casos de uso; testes cobrem validação, erros, origem do ator e registro integral.
  - Nota: `pnpm check` passou (79 arquivos, 695 testes).
- [x] M5.9 Preload e camada de dados do renderer
  - Nota: Preload expõe a ponte tipada e removível para eventos; o cliente desembrulha os resultados e converte falhas em `ApiError`.
  - Nota: API Context, Query Client, chaves, invalidação por mudança IPC, capacidades da sessão e fake-api implementados.
  - Nota: Contrato anterior tipava a API do renderer com `ApiResult`; ajustado para refletir o PLANO 3.5: só o transporte IPC usa envelope.
  - Nota: Formatadores pt-BR e testes de IPC, sincronização e datas adicionados; `pnpm check` passou (705 testes).
- [x] M5.10 Janelas, vidro e ciclo de vida
  - Nota: Implementados o seletor puro de vidro, a posição por área útil, o gerenciador e as janelas sem moldura; inicialização registra handlers após a composição e mantém instância única.
  - Nota: Decisão provisória deste passo: vidro CSS por padrão; Acrylic é opção no Windows 11 via `AGILEBOX_GLASS=native`, documentada em `docs/decisoes/0001-vidro.md` com risco R1.
  - Nota: A bandeja usa 360×640 px conforme protótipo/HANDOFF; pendente comparar os dois modos de vidro no Windows 11.
  - Nota: `pnpm check` passou (85 arquivos, 709 testes) e o build do desktop gerou main, preload e renderers; o binário Electron não pôde ser baixado sem rede, então a recompilação nativa foi ignorada.
- [x] M5.11 Painel esqueleto ponta a ponta
  - Nota: Painel ligado à API IPC com providers e lista de tarefas; bandeja recebeu uma casca mínima.
  - Nota: Teste do App confirmou chamada a `tasks.listBoard` e exibição de título, estado e projeto.
  - Nota: `pnpm check` passou (86 arquivos, 710 testes) e o build gerou main, preload e renderers; binário Electron não baixou sem rede.
  - Nota: A edição pela bandeja citada na conferência depende da tela de edição do M9; a casca deste passo ainda não edita tarefas.
- [ ] PARADA M5: Pedro roda `pnpm dev` (no Windows e no Linux), confere a galeria e o painel esqueleto, e decide o vidro (0001-vidro.md).

## Pendências abertas para o Pedro

O Codex acrescenta uma linha por item, no formato `- [ ] <passo> · <TIPO>: <texto>`.
Tipos: `CONFERIR`, `TESTAR-NO-WINDOWS`, `RODAR-E2E`, `DECIDIR`.

- [ ] M1 · CONFERIR: abrir `tooling/layers.js` e confirmar que as fronteiras entre camadas refletem a tabela 3.1 do PLANO.
- [ ] M2.9 · CONFERIR: ler os testes de `access-policy` (matriz de acesso, PLANO 6.1) e confirmar que cada linha reflete a regra desejada.
- [ ] M3.4 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.5) — a agenda aceita participantes usuários conforme o modelo da seção 5; confirmar se entidades sem conta também devem poder participar antes do M8.
- [ ] M3.14 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.4) — a tabela do dashboard inclui o gestor quando ele tiver tarefas; confirmar essa regra antes do M7 (alternativa: exibir somente colaboradores).
- [x] M3.10 · DECIDIR: tarifa inicial de entidade. **Decidido:** valor padrão 0 = "não definido"; criação só com nome (PLANO 6.2).
- [ ] M4.8 · TESTAR-NO-WINDOWS: executar `pnpm native:electron` e depois `pnpm native:node` no Windows; confirmar que ambas as recompilações terminam e que a aplicação/testes carregam o addon no ABI correspondente.
- [ ] M5.2 · CONFERIR: abrir painel e bandeja e comparar com `design/Painel.dc.html` e `design/Bandeja.dc.html`; conferir fonte Inter, foco azul com offset, scrollbar de 3 px, fallback de vidro e animações reduzidas pelo sistema.
- [ ] M5.2 · TESTAR-NO-WINDOWS: abrir o app sem rede no Windows 11 e confirmar que a fonte Inter local carrega e que vidro e foco continuam legíveis com movimento reduzido ativo.
- [ ] M5.3 · CONFERIR: quando a galeria M5.6 estiver disponível, comparar GlassSurface, Button, IconButton, Avatar, StatusChip, Skeleton, ReadOnlyBadge e EmptyState com o HANDOFF; conferir variantes, contraste e alvos de toque.
- [ ] M5.4 · CONFERIR: quando a galeria M5.6 estiver disponível, comparar SegmentedControl, GroupedList/FieldRow e campos de texto, data e número com o HANDOFF; conferir deslize, separadores, rótulos, foco e alvos de toque.
- [ ] M5.5 · CONFERIR: Na galeria M5.6, conferir StatusMenu (largura e itens), Modal (foco/fechamento), Toast (posição e duração), Tooltip e WindowControls (alvos de 40×44 px) contra o HANDOFF.
- [ ] M5.6 · CONFERIR: quando o painel estiver disponível em desenvolvimento, abrir com `?gallery` e comparar todas as seções/estados da galeria com `design/Painel.dc.html` e as medidas/cores do HANDOFF; confirmar que sem o parâmetro a galeria não aparece.
- [ ] M5.10 · TESTAR-NO-WINDOWS: no Windows 11, abrir o app uma vez com `AGILEBOX_GLASS=css` e outra com `AGILEBOX_GLASS=native`; comparar bandeja e painel quanto a desfoque, cantos e tremor ao abrir/redimensionar a bandeja e registrar a escolha final em `docs/decisoes/0001-vidro.md`.
- [ ] M5.10 · DECIDIR: DECISÃO PROVISÓRIA deste passo — manter CSS como padrão e Acrylic opt-in via `AGILEBOX_GLASS=native`; após o teste no Windows, confirmar ou escolher Acrylic como padrão.
- [ ] M5.11 · CONFERIR: rodar `pnpm dev` e confirmar que o painel lista as tarefas do seed; quando a edição da bandeja existir no M9, editar uma tarefa nela e confirmar que o painel atualiza sem recarregar.

## Como revisar ou desfazer

- Ver tudo: `git diff marco-M4 marco-M5`
- Ver um passo: `git show <commit>`
- Voltar a este marco: `git switch -c revisao-M5 marco-M5`
- Refazer um passo: `git revert <commit>`, desmarque o `[x]` no `PROGRESS.md` e rode o laço
