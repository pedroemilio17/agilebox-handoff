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
