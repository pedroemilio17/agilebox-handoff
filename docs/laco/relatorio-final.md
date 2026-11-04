# Relatório final do laço: Redesign v2, fase B e visão Equipe

Branch `codex/m1-m4`. Base: `0331966`. Commits do laço: de `e5ca8bc` a `2400c16` (ver `git log --oneline 0331966^..HEAD`).

## (a) O que foi feito

| Item                               | O que o usuário passa a ver                                                                                                                                                                            | Commit backend                                                                            | Commit interface |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------- |
| B1 · ID legível                    | Cada tarefa tem um número `AB-118` no card, no detalhe, na bandeja e na busca.                                                                                                                         | `e5ca8bc` (core), `fe4684e` (persistência, aplicação, contrato)                           | `109ffbc`        |
| B3 · Prioridade                    | Campo Normal ou Alta no detalhe, indicador "Prioridade alta" no quadro e filtro por prioridade.                                                                                                        | `275c329`                                                                                 | `90bdd99`        |
| B2 · Bloqueio com motivo           | "Bloquear" pede um motivo (até 280 caracteres); a tarefa mostra o bloqueio no card, no detalhe, na bandeja, no quadro e no dashboard. "Desbloquear" limpa a marca.                                     | `1afcc1e`                                                                                 | `7757a69`        |
| B5 · Subtarefas                    | Lista de subtarefas no detalhe (adicionar, renomear, concluir, reordenar, remover), com progresso no card.                                                                                             | `a54bf2b`                                                                                 | `e657715`        |
| B7 · Comentários e menções         | Comentários no detalhe. Só o autor edita o próprio comentário; ele ou o gestor podem removê-lo. Digitar `@` sugere responsável e apoio. Contador de comentários no card.                               | `ae8da92`                                                                                 | `e403cb8`        |
| B4 · Limite de WIP                 | Medidor de limite no cabeçalho de Desenvolvendo e Revisar; o gestor define o limite; o dashboard mostra as exceções. Passar do limite é aviso, não bloqueio.                                           | `3b2e38a`                                                                                 | `dcdede6`        |
| B9 · Agenda                        | Agendamentos com hora de fim, tipo (reunião, revisão, retro) e repetição semanal. Só o gestor cria e edita; todos veem a agenda.                                                                       | `5a76c92` (core, banco, aplicação, contrato); correção de visibilidade `e0df43a`          | `94cb202`        |
| B6 · Definição de pronto           | Cada projeto tem uma lista de até 20 itens. Ao concluir uma tarefa, o app confere os itens. A lista é editada no diálogo do projeto.                                                                   | `9b5f8de`                                                                                 | `71591f9`        |
| B10 · Combinados da retro          | Agendamentos do tipo Retro têm combinados (até 30 por ocorrência), com responsável, prazo e marca de feito. Só o gestor cria e edita.                                                                  | `804299b`                                                                                 | `2395a66`        |
| B11 · Exportar resumo do dashboard | Botão "Exportar resumo" no dashboard grava o resumo em Markdown ou CSV. Correção posterior neutraliza fórmulas no CSV.                                                                                 | `08a36f0` (core, aplicação, contrato, main e interface num commit só); correção `e328841` | (mesmo commit)   |
| Visão Equipe                       | Seletor "Minhas tarefas / Equipe" no quadro. A Equipe mostra as tarefas dos projetos de que a pessoa participa, só para leitura (sem arrastar, sem "+", sem editar limite; o detalhe abre em leitura). | `2400c16` (único, backend e interface)                                                    | (mesmo commit)   |

Fora deste laço: B8 (horas estimadas), que está na lista do escopo mas não foi pedido.

## (b) Como abrir e ver

1. **Enviar os commits.** O laço não tinha credencial para `git push`. Rode `git push` na branch `codex/m1-m4` quando quiser.

2. **Instalar dependências, se preciso.** Rode `pnpm install` só se o `node_modules` não existir ou se as dependências mudaram. O `package.json` e o `pnpm-lock.yaml` da raiz têm alterações locais não commitadas (ver item f), então a sua instalação decide.

3. **Usar um banco novo (recomendado).** Rode:

   ```bash
   pnpm db:reset && pnpm db:seed
   ```

   Atenção: `db:reset` apaga `.data/agilebox.db` (e os arquivos `-shm` e `-wal`). Não rode se quiser manter os dados atuais.

   Sem o reset, o app aplica as migrações 0001 a 0009 sozinho ao abrir o banco. O seed só roda se o banco estiver vazio, então um banco antigo mantém os dados antigos e não recebe os perfis novos. Para atualizar sem apagar, rode `pnpm db:migrate`, mas o perfil "Colaborador 4" e os dados de demonstração novos só aparecem num banco recriado.

4. **Abrir o app.** Rode `pnpm dev`. O painel abre; a bandeja fica no ícone da barra de tarefas.

5. **Trocar de perfil.** Clique no botão **Conta** (avatar) e escolha **Trocar de perfil**. Os perfis de demonstração são:
   - **Pedro** (colaborador)
   - **Colaborador 2**, **Colaborador 3** e **Colaborador 4** (colaboradores)
   - **Gestor** (gestor: tem o Dashboard, o "Abrir projetos" e a agenda com criação)

   Para ver o que só o gestor faz, troque para **Gestor**. Para ver o que o colaborador vê, use **Pedro**.

6. **Roteiro de 10 passos** (com o perfil indicado):
   1. (Pedro) Abra o **Quadro**. Os cards mostram o número `AB-…`. Busque por um número para achar a tarefa.
   2. (Pedro) Abra uma tarefa. No detalhe, troque a **Prioridade** para Alta e veja o indicador "Prioridade alta" no topo do quadro.
   3. (Pedro) No detalhe, clique em **Bloquear**, escreva o motivo e confirme. O card mostra o bloqueio. Clique em **Desbloquear** para voltar.
   4. (Pedro) No detalhe, use a seção **Subtarefas**: adicione, conclua e reordene itens. O card mostra o progresso.
   5. (Pedro) No detalhe, use a seção **Comentários**. Digite `@` para citar alguém da tarefa. O card mostra a contagem.
   6. (Gestor) No cabeçalho de **Desenvolvendo** ou **Revisar**, use o medidor de limite e clique para definir o limite. Passar do limite só mostra o aviso.
   7. (Gestor) Abra a **Agenda** e clique em **Novo agendamento**. Veja os campos Fim, tipo e **Repetir toda semana**. Depois troque para Pedro: a agenda aparece, com o aviso "Só o gestor cria e edita agendamentos."
   8. (Gestor) Abra **Projetos**, depois o diálogo do **Projeto A** e edite a **Definição de pronto**. (Projeto C fica sem itens, para comparação.) Conclua uma tarefa do Projeto A pelo quadro: o app pede a conferência dos itens.
   9. (Gestor) Na Agenda, abra a reunião **Retrospectiva da entrega** (tipo Retro, sextas-feiras). Adicione um combinado com responsável e prazo. Troque para Pedro: os combinados aparecem como somente leitura para criar ou editar; Pedro só consegue marcar como feito o combinado de que é responsável.
   10. (Gestor) Abra o **Dashboard** e clique em **Exportar resumo**: escolha Markdown ou planilha CSV. Depois, no **Quadro**, troque o seletor para **Equipe** e veja as tarefas dos projetos em leitura.

## (c) Verificações

**`pnpm check` (completo), estado atual, exit code 0:**

- `format:check` (Prettier): sem diferenças.
- `lint` (ESLint com `--max-warnings 0`): sem avisos.
- `typecheck`: passou em todos os pacotes.
- `test` (Vitest): 179 arquivos de teste, 1489 testes, todos passaram.
- `build` (electron-vite do desktop): passou.

**Banco novo do zero:** `pnpm db:reset && pnpm db:seed` não foi rodado. Os scripts usam o caminho fixo `.data/agilebox.db`, sem variável nem argumento para outro caminho. Além disso, o arquivo não existe neste repositório, e rodar o script criaria o banco no lugar do Pedro. Por isso foram rodados os testes já existentes:

- `packages/infra-sqlite/src/client.test.ts` aplica as migrações 0000 a 0009 num SQLite em memória, do zero, e confere as tabelas esperadas. Passou.
- Os testes `migration-*.test.ts` (task-number, task-priority, task-blocked, board-settings, meeting-fields, definition-of-done) passaram.
- `apps/desktop/src/main/actor-session.test.ts` roda o seed sobre SQLite em memória, com as migrações. Passou.

Ressalva: nenhuma migração foi aplicada num arquivo de banco real. O `seed.test.ts` usa repositórios em memória.

**Ressalvas da verificação:**

- As telas **não foram conferidas visualmente** no Electron real. Só foram usados testes automatizados e builds.
- Não foi testado no **Windows**.
- O teste ponta a ponta **M10.3** (Playwright com `_electron`) continua por fazer.
- O arquivo `docs/checklist-windows.md` continua por fazer. Ele ainda não existe no repositório.

## (d) Decisões tomadas pelo laço

O laço seguiu as opções recomendadas no escopo. Confira:

- **D3 (Bloqueado reaberto):** sim. Bloqueio é uma marca na tarefa (motivo e data), não um sexto estado. A tarefa continua no seu estado da lista.
- **D5 (ícones):** SVG próprio, sem biblioteca de ícones.
- **D6 (evento sem hora de fim):** vale 1 hora.
- **D7 (atalhos):** atalhos de uma letra (`N`, `G D`) aceitos, além de `Ctrl K`.
- **Comentários no dashboard:** contam como atividade. Valem para as regras "mudanças desde ontem" e "última edição por pessoa".
- **Agenda para colaboradores:** todos os usuários da organização veem todos os agendamentos (PLANO 6.1). Só o gestor cria e edita.
- **Definição de pronto:** a conferência vale por qualquer caminho de conclusão: pelo quadro, pelo detalhe, pela bandeja, e também ao criar uma tarefa já concluída.
- **Limite de WIP:** é sinal de excesso, não bloqueio.
- **Série semanal:** editar ou excluir afeta a série inteira. Não há exceção por ocorrência.
- **Lista de revisão rápida:** decisão registrada conforme a instrução do laço. Não encontrei o texto de origem nos documentos do repositório nem no diário. O Pedro precisa confirmar o que ficou decidido.

## (e) NÃO implementado: decisão sua pendente

- **Daily assíncrona na bandeja** (cartão "Vamos registrar o que foi feito hoje?" e daily em 3 passos). Motivo: o CLAUDE.md lista o aviso diário como "fora do MVP", o HANDOFF-v2 (seção 4.7) diz "não implementar sem decisão do Pedro", e o PLANO (seção 13, item 6) põe o aviso diário no pós-MVP.
  - Opções: (1) reabrir só a daily local, sem rede, gravada na bandeja; (2) decidir antes se o aviso também aparece no painel.

- **Aviso de commit, commits vinculados e demais plug-ins** (webhooks, GLPI, Azure DevOps, caixa de pendências, aviso de atualização). Motivo: o CLAUDE.md põe Plug-ins como "fora do MVP", e o PLANO (seção 13, item 5) também. Webhooks exigem abrir uma porta de rede no computador, o que muda a superfície de ataque.
  - Opções: (1) manter fora; (2) fazer só integração de saída, chamando APIs externas sem abrir porta; (3) servidor local com token e origem restrita. Decidir a segurança antes de qualquer código.

## (f) Pontos abertos e limitações

**Pendências do Pedro** (de `docs/laco/pendencias-do-pedro.md` e `docs/laco/orquestracao.md`):

- Gestor na Equipe não vê as próprias tarefas: `listTeamBoard` exclui, para o gestor, as tarefas em que ele participa. O PLANO 6.1 diz "todas". Confirmar se a regra muda no servidor.
- Detalhe da Equipe: abre sempre em leitura, também para o gestor. A edição do gestor segue pelo "Abrir projetos" do dashboard, marcada como Gestor.
- Rodapé "Ciclo médio desta semana": não aparece na Equipe, por ser métrica do quadro pessoal.
- Linha do tempo na Equipe: aparece se `timeline.list` devolver eventos de quem não participa. Confirmar se deve aparecer.
- Daily assíncrona: ver seção (e).
- Comentários como "mudança/edição" nas regras do dashboard (`core/rules/recent-changes.ts`). Se não for o desejado, ignorar `comment_added` e `comment_removed` nessas regras.
- Criador da tarefa não é mencionável com `@`: o DTO do detalhe (`GetTaskDto`) traz só participações. Para permitir, o DTO precisa de `createdBy`.

**Outros pontos:**

- Foco do menu de exportação do dashboard: conferir se o foco volta ao botão "Exportar resumo" ao fechar o menu. Não verificado no Electron.
- Indicador "DoD · N" (contador de itens da definição de pronto no card): opcional, não feito.
- Migrações não aplicadas em banco real: nenhum arquivo `.data/agilebox.db` existe neste repositório. Quem tiver o banco antigo deve rodar o passo (b)3.
- `apps/desktop/electron-builder.yml`: `electronDist` tem caminho fixo para `node_modules/.pnpm/electron@45.2.1_supports-color@7.2.0/...`. Isso quebra se a versão do Electron mudar.
- Alterações antigas não commitadas (não fazem parte do laço e não foram commitadas): `.gitignore` (regras do Claude Code), `apps/desktop/electron-builder.yml` (`electronDist`), `package.json` (dependência `electron`) e `pnpm-lock.yaml`.
- Pendências de conferência visual e de decisão provisória de M6 a M10 continuam em `docs/laco/pendencias-do-pedro.md` (ex.: iniciar com o Windows, membros do projeto).

## (g) Convenções do laço que merecem revisão

- **Confirmação antes de cada etapa.** O CLAUDE.md pede que, antes de escrever código de uma etapa nova, o agente explique em poucas linhas o que vai fazer e espere confirmação. Também pede que, havendo mais de uma opção boa, o agente pergunte em vez de decidir sozinho. O laço seguiu a instrução direta de implementar, e as decisões da seção (d) foram tomadas sem essa confirmação.
- **Visão Equipe.** O CLAUDE.md lista a visão Equipe como "fora do MVP" (o seletor fica estático). O REDESIGN-v2-ESCOPO (seção 3) também a deixa fora "até o Pedro reabrir". O laço a implementou porque foi pedido. Vale confirmar que a regra do CLAUDE.md foi atualizada ou que a exceção é intencional.
- **Regras de produto sem registro em `docs/MVP.md`.** O CLAUDE.md manda não inventar requisitos. Algumas regras da seção (d), como a série semanal inteira e o WIP como sinal, não estão em `docs/MVP.md`. Confirmar e registrar em `docs/decisoes/` se valerem.
