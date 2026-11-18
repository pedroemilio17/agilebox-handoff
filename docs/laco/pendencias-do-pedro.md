- [ ] M6.1 · CONFERIR: abrir o painel e comparar barra lateral recolhida/expandida, navegação, barra de título e placeholder de Ajustes com `design/Painel.dc.html`.
- [ ] M6.1 · DECIDIR: DECISÃO PROVISÓRIA (12.3): confirmar o placeholder "Em breve" em Ajustes; alternativa: remover o item da barra lateral.
- [ ] M6.2 · CONFERIR: abrir o painel, abrir o seletor de projetos e comparar título, seta, lista, seleção e campo de criação com `design/Painel.dc.html`.
- [ ] M6.3 · CONFERIR: abrir o painel, trocar entre Todos os projetos e um projeto, e comparar cinco colunas, cards, prazos, iniciais e estados vazios com `design/Painel.dc.html`.
- [ ] M6.3 · DECIDIR: DECISÃO PROVISÓRIA (12.6): confirmar esqueleto e mensagem curta de erro no quadro; alternativa: usar um estado estático sem esqueleto e oferecer ação explícita para tentar de novo.
- [ ] M6.4 · CONFERIR: abrir o painel, arrastar um card entre colunas e confirmar o destaque azul da coluna de destino e a atualização do estado.
- [ ] M6.4 · DECIDIR: DECISÃO PROVISÓRIA (12.2): confirmar mudança apenas de estado com ordenação por `updated_at` mais recente primeiro; alternativa: permitir reordenar cards manualmente dentro da coluna.
- [ ] M6.5 · CONFERIR: abrir o painel, criar uma tarefa em cada projeto disponível, confirmar que o projeto selecionado vem pré-selecionado, que título vazio não permite criar e que a tarefa criada abre com opção de voltar ao quadro.

- [ ] M6 · CONFERIR: abrir uma tarefa, editar descrição, prazo, horas e valor/hora, mudar o estado e conferir a linha do tempo; comparar com `design/Painel.dc.html`.
- [ ] M7 · CONFERIR: trocar de perfil pela Conta (colaborador: sem Dashboard e sem R$; gestor: Dashboard, "Abrir projetos" e marca Gestor na linha do tempo).
- [ ] M7.5 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.1): o botão "Membros" aparece para o projeto selecionado, só para o gestor e para quem criou o projeto.

- [ ] M9 · CONFERIR: abrir a bandeja pelo botão ↙ do painel; buscar, alternar Recentes/Frequentes, abrir uma tarefa, salvar, criar uma nova e redimensionar pela barrinha (setas, Home, duplo clique); conferir que o painel atualiza sem recarregar.
- [ ] M9.5 · PENDENTE: botão redondo de 52 px ao fechar a bandeja e animações de saída/altura (entram com o ícone de bandeja do M10.1).

- [ ] M8 · CONFERIR: como gestor, criar, editar e excluir um agendamento; como colaborador, ver a agenda e o aviso "Só o gestor cria e edita agendamentos."; comparar o calendário com `design/Painel.dc.html`.
- [ ] M8.3 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.5): os participantes do agendamento são só usuários (sem entidades).

- [ ] M10.1 · CONFERIR (Linux): instalar a extensão AppIndicator do GNOME, ver se o ícone aparece, e então decidir se o fechar do painel também recolhe no Linux (hoje `shouldHideOnClose` é falso no Linux).
- [ ] M10.1 · TESTAR-NO-WINDOWS: ícone na bandeja, clique abre/fecha a bandeja no canto certo (barra de tarefas em qualquer borda, vários monitores), fechar o painel recolhe e "Sair" encerra.
- [ ] M10.1 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.7): o app não inicia sozinho com o Windows.

- [ ] M10.2 · TESTAR-NO-WINDOWS: `pnpm --filter @agilebox/desktop dist:win`, instalar o `.exe`, abrir, trocar de perfil, fechar e reabrir (os dados persistem) e desinstalar.
- [ ] M10.2 · DECIDIR: DECISÃO PROVISÓRIA: o app empacotado cria dados de demonstração na primeira execução até existir cadastro/login.

## ADR-10 (organização por projeto)

- [ ] ADR-10 · DECIDIR: Cerimônias (`reviewRetro`) hoje **exige** a Agenda no catálogo, mas o ADR a lista como dependência suave ("aproveita"). Mantido como está (módulo existente não muda sem combinar). Alternativa: trocar `requires` por `enhances` e ajustar os testes.
- [ ] ADR-10 · DECIDIR: nomes na interface. O design usa "Atualização diária" e "Cerimônias"; o catálogo atual usa `MODULE_LABELS` "Check-ins" e "Review e retro". O manifesto já traz os nomes do design; `MODULE_LABELS` ficou igual até as telas de Módulos.
- [ ] ADR-10 · DECIDIR: níveis do design (N1/N2/N3) valem, mas `minLevel` (básico/intermediário/avançado) ainda esconde telas em `capabilities.ts`. A troca do significado do nível entra na fase 4 (guia), junto com as telas.
- [ ] ADR-10 · DECIDIR: textos de tutorial e estado vazio dos módulos sem trilha no ADR (Custo, WIP, Critério de pronto, Burndown, Métricas, Linha de base, Riscos e herdados) foram escritos a partir do ADR e do design; revisar a redação.
- [ ] ADR-10 · CONFERIR: `DEFAULT_TEAM_MODULE_IDS` virou lista fixa (13 ids) para a migração 0012 continuar igual e os módulos novos nascerem desligados.
- [ ] ADR-10 · DECIDIR: `ProjectModulesRepository.save` não checa se o projeto está arquivado, e `list` de projeto inexistente devolve lista vazia. Decidir na fase 2 se arquivado recusa mudança de módulos.
- [ ] ADR-10 · DECIDIR: a linha do tempo atual é por tarefa. Mudança de módulo do projeto ("entra na linha do tempo do projeto") não é registrada ainda. Criar um registro de eventos do projeto (nova tabela) ou reaproveitar `team_tools_audit` com `project_id`?
- [ ] ADR-10 · DECIDIR: "gestor propõe, equipe aceita" ainda não existe. Hoje só o gestor muda os módulos do projeto, direto.
- [ ] ADR-10 · LACUNA: `projectModules.*` ainda não tem canal IPC nem handler no desktop (o `api.test.ts` exige os dois juntos). Entra com as telas da fase 2.
- [ ] ADR-10 · LACUNA: não há caso de uso para gravar a configuração de módulo do projeto (ex.: limites de WIP), só o da equipe. Módulo `winding_down` conta como desligado ao calcular o plano.
- [x] ADR-10 · DEFEITO do guard: corrigido (o guard lê `project_modules`; `it.fails` removido; PLANO 3.8).
- [x] ADR-10 · PLANO do guard por projeto: aprovado pelo Pedro (projeto manda; resolve por `projectId`/`taskId`/`sprintId`/`impedimentId`) e implementado.
- [ ] ADR-10 · DECIDIR: a trilha do guia é gerada pela ordem de dependência e desempata pela ordem do catálogo, então pode divergir da ordem escrita à mão no ADR (ex.: no Tradicional, Estimativa pode vir antes de Marcos). Opções: (a) aceitar a ordem gerada; (b) as dependências suaves (`enhances`) também ordenam; (c) um campo `order` por passo no manifesto. A (b) cobre a maior parte dos casos sem texto novo.
- [ ] ADR-10 · CONFERIR (guard por projeto): casos de uso sem projeto (agenda, check-ins, limites do quadro, impedimentos da organização, retro) valem se o módulo estiver ligado em pelo menos um projeto não arquivado; organização sem projeto ativo cai nas ferramentas da equipe (compatibilidade). Confirmar a regra.
- [ ] ADR-10 · LACUNA: não existe caso de uso que ponha um módulo do projeto em `winding_down` nem que o conclua (`teamTools.completeWindDown` só vale para a equipe). `sprint-wind-down.test.ts` grava o estado direto pelo repositório, e o passo que conferia a auditoria da equipe ficou só com "changedBy = gestor". Módulos do projeto ainda não têm trilha de auditoria. Decidir junto com a linha do tempo do projeto.
- [ ] ADR-10 · DECIDIR: telas e casos de uso de ferramentas da **equipe** (`teamTools.*`) não governam mais o guard quando há projeto. Manter como estão até a tela Módulos do projeto, ou aposentar?
- [ ] ADR-10 · CONFERIR: leituras passivas migradas para o projeto (impedimento e sprint no cartão, `carry_over`, `flowMetrics` do dashboard) e o custo de consulta (`impediment-refs` faz um `tasks.findById` por tarefa; `sprint-refs` uma leitura de módulo por sprint). Medir se o quadro ficar lento.
- [ ] ADR-10 · CONFERIR (`projects.createWithSetup`): sem `modules` e sem `startedFromPreset`, o conjunto vem de `recommendPreset(answers)` (inclui os extras das respostas: marcos, estimativa, custo). Com `startedFromPreset` explícito e sem `modules`, vale só o preset. A tela deve enviar `modules` explícito depois dos interruptores. Nome repetido devolve o projeto existente sem aplicar o assistente. Falta teste de falha em ponta a ponta no SQLite (a atomicidade foi testada só com o fake).
- [ ] ADR-10 · CONFERIR (wizard, tela 01): (a) o contador é dinâmico, "Pergunta N de 6" no caminho com fim e "de 4" no contínuo (o canvas mostra sempre "de 6"); (b) P4 e P5 ganharam "Não sei" (o ADR diz que todas têm, mas a tabela lista só Sim/Não); vira ausência de resposta; (c) os textos de apoio das perguntas 1, 2, 4 e 5 foram escritos por nós, só o da P3 veio do canvas: revisar a redação; (d) "Pular" é botão com aparência de link; (e) perguntas puladas aparecem no trilho como "Não se aplica".
- [ ] ADR-10 · CONFERIR (recomendação, tela 02): (a) há uma seção "Desligados" que o protótipo não tem, para religar um módulo desligado na tela; (b) extras de nível 3 ficam fora da lista com experiência "Nunca" e aparecem só na nota "entram quando a equipe já trabalha com ..."; mudar a experiência liga ou desliga esses extras; (c) os bullets de intensidade são texto fixo (`guideIntensity` do core não traz os textos); (d) foram omitidos o rótulo "Pergunta 6 de 6" (o total varia no contínuo) e o link "Ver todos" (a tela Módulos ainda não existe).
- [ ] ADR-10 · CONFERIR (wizard ligado ao painel): (a) "Criar" no `ProjectDialog` agora abre o assistente; o campo de nome inline continua como porta de entrada, e o teste `App.test.tsx` "cria projeto e seleciona" passou a clicar em "Pular e criar no modo Simples" (mudança intencional, sem assert removido); (b) a prop `ref` foi acrescentada ao `Button` de `@agilebox/ui` (React 19) para devolver o foco; (c) o diálogo de projetos fica oculto enquanto o assistente está aberto (sem modais aninhados); (d) a invalidação é só `projects.list`.
- [ ] ADR-10 · DECIDIR (backend do guia): (a) a tabela `guide_progress` não guarda o instante da dispensa do card (`dismissCard` recebe `at` e não o usa): quer uma coluna `dismissed_at`?; (b) `recordGuideEvent` grava mesmo em projeto arquivado: deveria ignorar?; (c) a experiência do guia só vem do projeto (`project_setup.guide_level`); o nível por pessoa não existe ainda (ADR: o do projeto prevalece e o da pessoa vale quando o projeto não definiu); (d) módulos `winding_down` não entram na trilha, só `active`. A dispensa do card usa a chave reservada `__card__` em `guide_progress`.
- [ ] ADR-10 · DECIDIR (eventos do guia): (a) `meeting.created` (Agenda) e `daily.answered` (Atualização diária) não emitem: reunião e daily não têm projeto nos argumentos. Opções: gravar o evento em todos os projetos do ator com o passo pendente; ou dar um projeto opcional à reunião; ou aceitar que esses dois passos não concluem sozinhos; (b) `recordGuideEvent` roda sem try/catch dentro da transação, então uma falha de infraestrutura no guia derruba o caso de uso (não há SAVEPOINT na porta da UnitOfWork); (c) `ChangeTask.change` passou a ter 9 parâmetros posicionais: migrar para objeto de opções numa etapa separada.
- [ ] ADR-10 · CONFERIR NA TELA (card "Primeiros passos"): o card ainda não foi visto rodando no Electron (nem a 1100 e 1280 px); comparar com a tela 04 do canvas. Decisões: (a) aparece também na visão "Equipe" quando há projeto selecionado (uma linha em `App.tsx` para esconder); (b) recolher e dispensar reiniciam ao trocar de projeto (a chave do componente é o projeto); (c) erro de carga: o card não aparece; (d) o passo "Atualização diária" não tem botão ("Pela bandeja, no fim do dia").
- [ ] ADR-10 · CONFERIR NA TELA (botão "?" e painel "Como funciona", tela 05; não foi visto rodando): (a) Backlog e Sprints usam o projeto do seletor da própria tela; Agenda e Impedimentos usam o projeto selecionado no App; (b) módulo em encerramento (`winding_down`) aparece como Desligado; (c) rótulos "Nunca / Algumas vezes / Sempre" em "Seu guia": só "Algumas vezes" vem do protótipo; (d) "Requer" mostra "Núcleo" em quase todo módulo: ocultar?; (e) o painel escurece a janela inteira e fecha ao clicar no véu (o protótipo escurece só a área à direita da barra lateral); (f) a Agenda não tem título, e o "?" ficou na linha de controles; (g) FICOU DE FORA: o glossário "Palavras que você vai ver" (não existe nos manifestos) e "Mudar para mim" (não existe nível por pessoa); `tutorial.next` não é mostrado.
- [ ] ADR-10 · DECIDIR (boas-vindas, tela 06): (a) o protótipo mostra uma trilha de boas-vindas PRÓPRIA ("Conheça o quadro da sprint", "Abra suas 3 tarefas", "Atualize pela bandeja", "Veja a próxima cerimônia") e cartões "Agora" (sprint), "Com você" (tarefas) e "Meta"; nada disso existe no ADR nem nos manifestos. A tela vai listar a trilha REAL do projeto e mostrar só nome, preset e quantidade de módulos; decidir se a trilha própria e os cartões entram; (b) `resolveWelcome` exige ser membro (gestor não-membro recebe recusa); (c) `moduleCount` conta só módulos `active`.
- [ ] ADR-10 · CONFERIR NA TELA (boas-vindas, tela 06; não foi vista rodando): (a) a janela só aparece na visão Quadro (junto do card): quem escolhe o projeto estando em Backlog ou Sprints só a vê ao voltar ao Quadro; (b) o texto de erro "Não foi possível salvar sua resposta. Tente de novo." é nosso; (c) se a gravação falha, a janela volta, mas "Ver a trilha" já abriu o card; (d) o nome da pessoa vem de `listUsers` (a sessão só traz o id); (e) o véu não fecha ao clicar (resposta explícita).
- [ ] ADR-10 · DECIDIR (estados vazios): o estado vazio que ensina foi aplicado só ao **Backlog**. Em **Sprints** foi revertido: o texto do manifesto é do módulo ("Nenhuma sprint."), mas cada aba tem um vazio próprio ("Nenhuma sprint ativa", "Nenhum rascunho") e trocar pelo do módulo engana quando existem rascunhos. Opções: (a) mostrar o do módulo só quando o projeto não tem NENHUMA sprint; (b) manifesto com entradas por aba (muda o ADR-10); (c) manter como está. Agenda e Impedimentos também ficaram sem estado vazio do guia.
- [x] (resolvida: visibilidade pelo projeto, ver abaixo) ADR-10 · LACUNA IMPORTANTE (tela Módulos, tela 03): os itens da barra lateral (Backlog, Sprints, Agenda, Impedimentos) e as "capacidades" do painel ainda vêm das ferramentas da **equipe** (`teamTools`), não dos módulos do projeto. Ligar Sprints na tela Módulos não faz o item "Sprints" aparecer na barra. Próximo passo do loop: derivar a visibilidade dessas telas dos módulos do projeto selecionado.
- [ ] ADR-10 · CONFERIR (tela Módulos): (a) a etiqueta "Começou como <preset>" foi omitida (o preset não sai em `projects.list` nem em `guide.get`; falta expô-lo); (b) a dependência do Burndown mostra só "Requer Sprints" porque o DTO não traz `requiresAnyOf` (horas OU pontos); (c) o desligamento com sprint ativa mostra o aviso e não grava nada (o agendamento do protótipo não existe no backend); (d) não foi vista rodando; (e) o painel de proposta e a votação da equipe ficaram de fora (decisão sua).
- [ ] ADR-10 · DECIDIR (visibilidade pelo projeto): a barra e as telas de módulo agora seguem os módulos do projeto selecionado (sem projeto: o melhor estado entre os projetos ativos; sem projeto ativo: a equipe), e o **nível não esconde mais a tela**. Efeito: no nível Básico aparecem Backlog, Sprints e Impedimentos no menu, e no detalhe da tarefa o Histórico, os Critérios e a Estimativa (testes reescritos: `App.scrum-basic`, `App.impediments`, `App.backlog`, `App.sprints`, `BlockControl.impediments`, snapshot de `App.tools-audit`). INCONSISTÊNCIA: `can(...)` e `canFetch(...)` ainda seguem o nível, então ações (bloquear, resolver, subtarefas), medidor de WIP, fluxo e cartão do daily seguem escondidos no Básico enquanto a tela aparece. Confirmar se é isso (ADR: "o nível define a profundidade, não esconde tela") ou se tudo deve seguir só o módulo. Além disso, `shared/capabilities` importa `panel/hooks/use-project-modules` (cruza pastas): mover o hook para `shared` se preferir.
- [ ] ADR-10 · PENDENTE (configuração por projeto): backend pronto (`projectModules.setConfig`; o limite de sprints ativas lê o projeto e herda da equipe), mas NÃO há tela para editá-la no projeto, e `teamTools.get` segue mostrando só a config da equipe. `setConfig` não publica no `changeNotifier` e sempre grava (atualiza `changedBy`/`changedAt` mesmo sem mudança real), como `projectModules.change`.
- [ ] ADR-10 · CONFERIR (fase 3, A1: EAP e Marcos no core e no banco): (a) título da entrega limitado a 200 caracteres (sem precedente no código); (b) `setTaskDeliverable` não recusa tarefa arquivada (as outras alterações recusam); (c) gravar tarefa com entrega de outro projeto/organização lança VALIDAÇÃO; (d) `delete` de entrega com filhos, tarefas ou marcos ligados lança CONFLITO no repositório; (e) `saveMany` depende da transação do UnitOfWork para ser atômico; (f) o progresso da entrega será horas concluídas ÷ horas totais (o protótipo usa % por tarefa, que não existe: as tarefas têm 5 estados); (g) o "Prazo final" do projeto (cabeçalho das telas 13 e 14) não existe no modelo: criar campo `projects.deadline`?; (h) o marco do protótipo tem "quem aprova" (entidades) e status (cumprido, em risco, no prazo): o ADR só diz nome, data, entrega e critério; aprovação por entidades e status calculado ficam como decisão.
- [ ] ADR-10 · DECIDIR/CONFERIR (fase 3, A2: casos de uso de EAP e Marcos): (a) quem edita a EAP e os marcos = gestor ou quem criou o projeto (mesma regra de arquivar e de membros; `canEditProjectStructure`); o ADR não define; (b) ligar tarefa a entrega gera o evento `deliverable_changed` na linha do tempo da tarefa; recusa tarefa arquivada e projeto arquivado (outras edições de tarefa não checam projeto arquivado); (c) o `TaskDto` ganhou `deliverableId`; (d) as mutações devolvem a visão completa (`WbsViewDto`); (e) no rollup, as **horas** vêm das estimativas e o **custo** dos apontamentos (`total` de cada participação): duas bases diferentes na mesma linha, confirmar; (f) o progresso é horas estimadas concluídas ÷ horas totais; (g) `wbs.get` mostra a qualquer membro todas as tarefas ativas do projeto, o mesmo que `canViewTask` já permite ao membro; custo nulo para quem não é gestor; (h) a pendência A1(b) ("setTaskDeliverable não recusa arquivada") ficou resolvida.
- [ ] ADR-10 · CONFERIR NA TELA (Entregas, tela 13; não vista rodando; tabela com largura mínima de 880 px e rolagem interna): (a) o passo do guia "Liste as entregas principais" conclui ao criar a **primeira** entrega (manifesto: `deliverable.created`), mas o texto do protótipo diz "2 entregas ou mais": confirmar; (b) tarefas mostram o estado no lugar do progresso e custo "—" (o DTO de tarefa da EAP não traz esses valores); (c) a coluna Período, o "Prazo final" e "Importar de planilha" ficaram de fora; (d) foi acrescentado o aviso "N tarefas ainda não estão em nenhuma entrega"; (e) o passo 1 do estado vazio continua aberto depois da primeira criação até "Fechar passo"; (f) falta o teste "cai no Quadro com o módulo desligado" (o fallback existe em `App.tsx`).
- [ ] ADR-10 · CONFERIR (fase 3, A3b: campo Entrega e tela Marcos; não vistos rodando): (a) o campo "Entrega" do detalhe da tarefa decide pelo módulo `wbs` do **projeto da tarefa** (não pelo projeto selecionado); (b) `milestones.list` existe porque o módulo Marcos pode estar ligado sem a EAP; ao criar marco sem a EAP ligada, a entrega vai nula, e ao editar a entrega atual é mantida; (c) "hoje" para marco com data de hoje foi acréscimo nosso; (d) `milestones.list` faz um `findById` por marco ligado a entrega (N+1; ok para listas pequenas); (e) o teste de guia "marcos ainda não têm botão" virou "marcar os marcos leva à tela de marcos" (o pedido exigia o botão); (f) falta teste de integração do `TaskDetailView` com o campo Entrega.
- [ ] ADR-10 · CONFERIR/DECIDIR (fase 3, A4: início, dependências e leitura do cronograma): (a) o intervalo do cronograma usa o menor início e o maior prazo entre as tarefas que têm as DUAS datas (nulo se nenhuma); (b) `schedule.get` inclui tarefas de backlog (só as arquivadas ficam de fora) e devolve `deliverableCode` só com `wbs` ligado; (c) predecessora arquivada é recusada com CONFLITO, e o conflito compara o prazo da predecessora com o início da sucessora; (d) criar dependência exige poder editar a SUCESSORA; a predecessora só precisa existir no mesmo projeto; (e) `schedule.opened` é gravado em transação própria dentro de try/catch dentro de `schedule.get` (falha do guia não derruba a leitura); (f) add/removeDependency devolvem o cronograma completo; (g) `task.scheduled` dispara quando a edição deixa a tarefa com início e prazo e muda uma das datas (vale para `setStart` e para o prazo via `tasks.update`); (h) `setStart` e as dependências NÃO checam projeto arquivado (como `tasks.update`); só a leitura marca `canEdit=false`; (i) `setDeadline` passou a recusar prazo anterior ao início.
- [ ] ADR-10 · CONFERIR NA TELA (Cronograma, tela 14; não visto rodando; falta ver a 1280 e 1440 px, a escala Meses e o contraste dos tokens nas barras): (a) a permissão de editar datas e dependências usa o `canEdit` de cada TAREFA (como o servidor valida), e o formulário de dependência só lista como sucessora as tarefas editáveis; (b) o bloco "Dependências" tem dois selects (sucessora e predecessora); (c) a legenda ganhou "Futura"; (d) início e prazo gravam ao escolher uma data válida, e limpar o campo só grava ao sair dele; (e) os marcos aparecem num grupo "Marcos" no fim do Gantt (o DTO de marco do cronograma não traz a entrega); (f) com a EAP ligada mas sem entregas, a lista fica plana; (g) entregas sem nenhuma tarefa são omitidas; (h) o alerta usa o primeiro conflito calculado pelo servidor; (i) FICOU DE FORA: o interruptor e a barra de "Linha de base", o status "Atrasada em relação à base" e o botão "Ver acompanhamento" (módulo de nível 3 e tela do A6).

## Acompanhamento (ADR-10, fase 3, A6, tela 15)

- Módulo: `tracking.get` fica no módulo `schedule`. Marcos só aparecem com `milestones` não desligado; a entrega do marco só com `wbs`.
- Concluído = horas estimadas das tarefas concluídas ÷ horas estimadas (como na EAP). Arquivadas ficam fora.
- Custo realizado e previsto só para o gestor; os demais veem "—" e a legenda "Só o gestor vê os valores" (acréscimo do agente; tirar se não quiser).
- Marco sem tarefas ativas na entrega nunca é "Cumprido".
- Dúvida: custo previsto ignora tarefa sem estimativa, sem Responsável ou com valor/hora zero, sem aviso. Quer um aviso na tela?
- Dúvida: conflito de dependência do marco só conta quando as duas pontas estão na entrega. Incluir predecessora de outra entrega que atrasa o marco? (uma linha em `hasScopeConflict`)
- Semana atual/total: semanas de calendário do intervalo, travada em 1 antes do início e no total depois do fim.
- Processo: o agente seguiu a especificação detalhada sem a confirmação que o CLAUDE.md pede por etapa; revisado por mim.

## Burndown e velocidade (ADR-10, fase 5, B1)

- Não há tela de Burndown em `design/`: a tela foi feita a partir do ADR e do padrão do Acompanhamento. DECIDIR/CONFERIR visualmente (não foi vista rodando).
- Dia de conclusão vem da linha do tempo (`status_changed` para `done`); reabrir devolve as horas ao restante. Fuso do sistema, como em flowMetrics.
- Escopo da sprint: tarefas não arquivadas com alguma linha que não seja `removed`. Dúvida: tarefa arquivada depois de concluída some da velocidade. Aceitar?
- Estimativa usada é a atual (não há histórico): mudar a estimativa no meio da sprint muda o gráfico. Aceitar?
- Tarefa concluída antes do início da sprint, mas no escopo, aparece como queda no dia 1. Correto?
- A tela mostra a sprint ativa, ou a última encerrada; sem seletor de sprint. Confirmar.
- Velocidade = horas estimadas concluídas por sprint encerrada; média das últimas até 3. Tarefa sem estimativa conta zero e a tela avisa quantas são.
- Leitura de linha do tempo por tarefa (N+1), como no dashboard. Aceitável no MVP.
- Processo: agente seguiu escopo fechado sem a confirmação do CLAUDE.md; revisado por mim.

## Custo como módulo (ADR-10, fase 5, B2)

- Regra: custo visível se `moduleStateOf(cost) !== 'disabled'` (encerrando ainda mostra). Some em `wbs.get`, `tracking.get`, `tasks.getDetail` e nas respostas de `participations.*`; DTOs ganharam `costEnabled`. A migração liga `cost` em todos os projetos existentes.
- DECIDIR: projeto criado pelo caminho simples (`projects.create`, sem wizard) não grava módulos e, portanto, nasce SEM custo (mudança de comportamento; segue o ADR "projeto novo começa só com o núcleo"). Esse caminho deveria gravar o preset Simples ou ligar `cost`?
- DECIDIR: desligar `cost` só esconde a leitura; `participations.add/setHours/setRate` seguem no núcleo e continuam gravando.
- Detalhe da tarefa sem custo: o cartão fica só com as horas (título "Horas").
- Valor/hora padrão de usuário e entidade é global, não por projeto: não alterado.
- Testes existentes ajustados só para ligar `cost` no setup; nenhuma asserção removida.

## Cerimônias na Agenda (ADR-10, fase 5, B3)

- Na aba Ativa da sprint, o gestor agenda Planning, Review e Retrospectiva com 1 clique (usa `meetings.create`; só aparece com `reviewRetro` e `agenda` ligados; servidor já exige gestor).
- DECIDIR: Planning não tem tipo próprio (usa `meeting`, identificada pelo título). Um tipo `planning` exige migração do CHECK de `meetings.kind`. Quer?
- DECIDIR: horários sugeridos 09:00/10:00/11:00 são provisórios.
- DECIDIR: Planning sugere o início da sprint, que numa sprint já ativa costuma estar no passado. Sugerir hoje?
- Anti-duplicata só em memória: sair da tela e voltar permite agendar a mesma cerimônia de novo (checar títulos existentes mudaria o comportamento; combinar).

## Rolagem das telas

- CONFERIR: telas novas (Módulos, EAP, Marcos, Cronograma, Acompanhamento, Burndown, Ajustes) não rolavam porque a raiz `.view` não tinha `overflow-y: auto`; adicionei (como Backlog/Dashboard já faziam). Verificado só por `pnpm check` (jsdom não mede rolagem); veja rodando e me avise se alguma tela ainda não rolar.

## Métricas de fluxo (ADR-10, fase 6, C1)

- Tela por projeto (`flowMetrics.get`): lead time, cycle time e vazão das últimas 8 semanas; reaproveita as regras do dashboard (extraí `flowSeries`, dashboard inalterado). Arquivadas e backlog ficam fora.
- CONFERIR: textos da nota de amostra (< 5 tarefas concluídas) e do estado vazio, ícone e glifo ▁ são escolhas do agente; visual não visto rodando.
- Tarefa concluída, reaberta e concluída em semanas diferentes aparece em duas barras e conta uma vez no total (regra existente do dashboard).

## Riscos (ADR-10, fase 6, C2)

- Módulo `risks` por projeto: migração 0022 (`risks`), casos de uso `risks.list/create/update/delete`, tela com faixa em texto (Baixo/Médio/Alto) e pontuação = probabilidade × impacto. Guard ganhou a resolução `riskId`.
- DECIDIR: escrita segue a regra dos marcos (gestor ou criador do projeto). O pedido falava em "gestor e participantes"; participantes hoje não escrevem. Mudar? (uma linha em `writableProject`)
- DECIDIR: probabilidade e impacto são obrigatórios (1 a 3, formulário em "Média"); o ADR diz que campos de módulo são opcionais, mas a pontuação precisa dos dois.
- Dono precisa ser membro do projeto; entrega precisa ser do mesmo projeto e exige `wbs` ligado.
- Não vi protótipo de Riscos em `design/`: UI feita do manifesto e do ADR. CONFERIR visualmente.
- "Alimenta o Dashboard" não foi feito.

## Linha de base (ADR-10, fase 6, C3)

- Módulo `baseline` por projeto: migração 0023 (`baselines` e `baseline_tasks`), casos de uso `baseline.get` e `baseline.take` (só gestor), tela com cartões, tabela de desvios e confirmação antes de gravar. Não há commit.
- DECIDIR: "Nova" vale só para tarefa criada depois da foto. Tarefa antiga que não tinha datas na foto fica fora da comparação, mesmo que ganhe datas depois, até a próxima foto. Confirmar.
- DECIDIR: a foto grava só tarefas ativas com início ou fim. Horas e custo entram junto; tarefa sem data não entra.
- DECIDIR: "Atrasada N d" usa o maior atraso entre início e fim. Tarefa que começou atrasada e terminou no prazo aparece como atrasada. Quer só o fim?
- DECIDIR: o nome da foto é automático ("Linha de base de DD/MM/AAAA"). Não há campo de nome na tela.
- DECIDIR: projeto arquivado não aceita foto nova (mesma regra da EAP e dos riscos).
- Custo: sem o módulo `cost` na foto, a comparação de custo fica vazia. Ligar `cost` depois não recalcula a foto antiga. `costVisible` diz se quem lê vê valores; resumo sem nenhum valor conhecido vira "—", não zero.
- Não há tela ou teste visual rodando: a apresentação foi feita a partir do ADR e do padrão do Acompanhamento. CONFERIR na tela, em 1280 e 1440 px, e com a tabela em tela estreita.

## Critério de pronto como módulo (ADR-10, fase 2)

- `projects.definitionOfDone.*` agora exige o módulo `definitionOfDone` do projeto. Com o módulo desligado: editor some, a conclusão não exige conferência e a contagem vem zero; os itens ficam guardados. Encerrando ainda vale (como `cost`).
- Migração 0024 liga o módulo nos projetos que já tinham itens (sem ela esses projetos perderiam a regra).
- DECIDIR: projeto criado pelo caminho simples (sem wizard) nasce sem o módulo; o gestor precisa ligar "Critério de pronto" em Módulos. O preset Simples deveria ligá-lo?
- DECIDIR: a conferência só vale ao entrar em Concluído; o ADR fala em "Concluído/Revisar". Manter?
- `ListProjects` lê o módulo por projeto (N+1 pequeno).

## Histórico de módulos do projeto (ADR-10, fase 2)

- Migração 0025 (`project_module_events`): cada ligar/desligar grava um evento por módulo, na mesma transação, com quem fez (marca "Gestor") e `auto` quando foi por cascata ("junto com X"). Leitura: `projectModules.history`; tela Módulos ganhou a seção "Histórico".
- Coluna extra `related_module_id` (não estava no pedido) para mostrar "junto com".
- DECIDIR: manter `scheduled_disable` no histórico mesmo sem mudança de estado (texto: "nada foi desligado")? Mudança só de configuração não gera evento.
- `winding_down` e `cancelled` existem no schema, mas nenhum caso de uso os produz (encerramento de módulo do projeto ainda não existe).
- A parte "ligar/desligar" das pendências "linha do tempo do projeto" e "trilha de módulo" pode ser marcada como resolvida; "gestor propõe, equipe aceita" continua aberta.

## Barra lateral conforme o design (F1 do plano de fidelidade)

- Barra reestruturada no padrão do `Modulos.dc.html`: Início, Agenda e Dashboard no topo; seção "Projeto" com a metodologia de partida à direita; subitens do projeto; "Outros projetos" com "Todos os projetos", "Novo projeto" e Ajustes/usuário no rodapé. Recolher continua em 52 px.
- A metodologia usa o preset de partida (`startedFromPreset`), agora exposto em `ProjectDto` por `projects.list`. Projeto criado sem o assistente não mostra rótulo.
- DECIDIR: a ordem dos subitens. Os mockups não concordam entre si (Ágil põe Quadro primeiro; Tradicional põe Quadro depois de Acompanhamento). Adotei: Quadro, Backlog, Sprints (S4), Burndown, Entregas (EAP), Marcos, Cronograma, Acompanhamento, Linha de base, Métricas de fluxo, Riscos, Impedimentos, Módulos (contagem), Plug-ins.
- DECIDIR: sem projeto selecionado, Backlog, Sprints e Impedimentos (telas da organização, hoje alcançáveis) aparecem em "Todos os projetos". O design não mostra esse estado.
- DECIDIR: a contagem de tarefas por projeto saiu da barra (o design mostra a metodologia no lugar). Restaurar, se quiser.
- DECIDIR: a linha de projeto selecionado leva ao quadro dele. Os mockups não definem essa ação.
- Divergências deliberadas: o fundo da barra usa o token translúcido `--color-rail-bg` (o mockup usa `#0d0c11` sólido), por causa do vidro; os quadradinhos seguem a cor derivada do id (`ProjectSwatch`), porque o projeto não guarda cor, e o rosa `#e58fd0` do mockup não tem token (usei o mais próximo da paleta); o rótulo "Entregas" virou "Entregas (EAP)", como no design; "Navegação principal" ficou como nome do menu, em vez de "Principal".
- Alvos: os itens seguem as medidas do mockup (36 px de topo, 34 px de subitem), abaixo dos 44 px do token de toque. Confirmar se quer 44 px.
- Não há tela para "Plano" (`HibPlano`) nem para o gerenciamento de metodologia; ficou fora.
- DECIDIR: o rodapé mostra só o papel ("Gestor"). O design pede "Gestor · Time".

## Arrastar cartões (B1)

- Causa: o `DragOverlay` do dnd-kit é `position: fixed` dentro de ancestrais com `backdrop-filter` e animações com `fill-mode: both` (que mantêm `transform`), então o cartão saía deslocado do ponteiro. Correção: overlay em portal no `body`, origem da rotação no ponto do clique, animações `windowOpen`/`viewEnter`/`cardEnter` com `backwards`.
- CONFERIR rodando: cartão sob o ponteiro com rolagem e janela de vários tamanhos; cartões da coluna agora devem abrir espaço ao arrastar (antes `cardEnter both` anulava o transform do dnd-kit).
- DECIDIR: a inclinação de 2° do cartão arrastado não está no design (lá só `opacity: .45`); mantida, remover se não quiser.
- Outros `position: fixed` dentro de `.window` (menus, tooltips) podem sofrer do mesmo backdrop-filter; não vi sintoma.
