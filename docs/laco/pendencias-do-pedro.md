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
- [ ] ADR-10 · DEFEITO/DECIDIR (importante): o guard de módulos (`module-guard.ts`, `assertModuleUsable`) lê só as ferramentas da **equipe** e nunca `project_modules`. Com Sprints ligada na equipe, um projeto sem Sprints ainda aceita criar sprint, o que contradiz "projeto sem módulo = só núcleo". O teste `it.fails` em `simple-project.test.ts` mostra isso. Regra proposta: a equipe é o teto e o projeto também precisa ter o módulo ligado. Confirmar antes de corrigir; a correção exige que os casos de uso de módulo recebam o `projectId`.
- [ ] ADR-10 · PLANO A APROVAR (guard por projeto): hoje `forTenant` roda o guard só com a organização, antes do caso de uso. Proposta: `ModuleUsePolicy` ganha um resolvedor opcional do projeto (`projectOf(args)`: lê `projectId` direto, ou `taskId`/`sprintId` pelo repositório) e `assertModuleUsable` passa a ler `project_modules` do projeto no lugar de `team_modules` (o ADR diz que as ferramentas por equipe "deixam de ser usadas"). Casos de uso sem projeto (agenda, daily, impedimentos da organização) precisam de regra: seguir só o núcleo, ou ler o projeto da tarefa. Mexe em ~95 casos de uso e em `docs/PLANO.md`; fica para depois da sua aprovação. Enquanto isso o loop faz passos independentes (wizard, `recomendarPreset`).
- [ ] ADR-10 · DECIDIR: a trilha do guia é gerada pela ordem de dependência e desempata pela ordem do catálogo, então pode divergir da ordem escrita à mão no ADR (ex.: no Tradicional, Estimativa pode vir antes de Marcos). Opções: (a) aceitar a ordem gerada; (b) as dependências suaves (`enhances`) também ordenam; (c) um campo `order` por passo no manifesto. A (b) cobre a maior parte dos casos sem texto novo.
