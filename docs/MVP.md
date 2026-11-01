# Plano do MVP

## Objetivo
Um MVP **funcional que o Pedro consiga rodar e testar sozinho** na própria máquina, com dados reais salvos, antes de pensar em multiusuário e integrações.

## Escopo do MVP
**Dentro**
- Projetos (criar, trocar), tarefas (criar, editar, mudar estado, arrastar no kanban).
- Detalhe da tarefa: descrição, estado, prazo, custo (horas × valor/hora), envolvidos, linha do tempo.
- Bandeja: lista (recentes/frequentes), busca, criar tarefa (e abrir detalhes), atualizar tarefa.
- Dashboard do gestor (porcentagens por estado, por colaborador, abrir projetos de um colaborador).
- Agenda (calendário mensal, próximos agendamentos, criar/editar/excluir como gestor).
- Perfis **Colaborador** e **Gestor** com permissões. No começo, troca manual de perfil (como no protótipo); login real vem depois.

**Fora** (não implementar agora)
- Plug-ins, webhooks, integração com commits, avisos de atualização vinda de plug-in, aviso diário.
- Visão "Equipe".
- IA embarcada.

## Fases sugeridas
1. **Fundação**: repositório, stack, banco, dados de exemplo, tema (tokens do `HANDOFF.md`) e componentes base (janela de vidro, controle segmentado, grupo de campos, botões).
2. **Painel**: barra lateral, quadro kanban com dados reais, modal de projetos, detalhe da tarefa com linha do tempo e custo.
3. **Permissões e gestor**: perfis, dashboard, abrir projetos de um colaborador, marcação "Gestor" na linha do tempo.
4. **Agenda**.
5. **Bandeja**: janela separada que lê e grava os mesmos dados (lista, busca, criar → detalhe, atualizar).
6. **Empacotar como aplicativo de Windows** (ícone de bandeja, janelas sem moldura, abrir painel pela bandeja).

Critério de pronto por fase: o Pedro consegue abrir, usar o fluxo e ver os dados persistirem depois de fechar e abrir de novo.

## Modelo de dados (proposta inicial)
- `users`: id, nome, email, iniciais, perfil (`colaborador` | `gestor`)
- `projects`: id, nome
- `tasks`: id, project_id, owner_id, título, descrição, estado, prazo (data, opcional), criada_em, atualizada_em
- `task_people` (envolvidos): task_id, user_id, papel (`Responsável` | `Apoio`), horas, valor_hora
- `task_events` (linha do tempo): id, task_id, quando, user_id, como_gestor (bool), tipo, texto
- `meetings`: id, título, data, hora, criado_por
- `meeting_people`: meeting_id, user_id
- `settings`: último valor/hora digitado (por usuário)
- Futuro (não criar agora): `plugin_events`, `inbox` de pendências.

Observação: o campo "Frequentes" da bandeja ainda não tem regra (no protótipo são tarefas "fixadas"). Veja decisões em aberto.

## Stack: sugestão para discutir (não decidir sozinho)
Como o produto vai ser um aplicativo de Windows com janelas sem moldura e ícone de bandeja, uma boa linha é começar pela interface e pelos dados e só depois empacotar:
- **Interface**: React + TypeScript + Vite, CSS próprio (os tokens de vidro são simples de manter em variáveis CSS).
- **Dados**: SQLite local (por exemplo via `better-sqlite3` ou Prisma), com uma camada de acesso isolada, para trocar por um servidor depois.
- **Empacotamento**: Electron (mais simples para ícone de bandeja, várias janelas e efeito de vidro no Windows) **ou** Tauri (mais leve, usa WebView2). Apresente prós e contras ao Pedro antes de escolher.
- **Testes**: começar com testes das regras (custo, porcentagens, permissões, linha do tempo), que são a parte mais fácil de errar.

## Decisões tomadas (2026-10-31)
A stack, a arquitetura, o modelo de dados revisado e os marcos estão em **`docs/PLANO.md`**, que substitui o "Modelo de dados (proposta inicial)" acima e a "Stack: sugestão".
1. **"Plano"** é outro nome para projeto.
2. **Valor/hora**: cada entidade (envolvido) tem o seu próprio valor/hora padrão; só o gestor vê valores (detalhes em `PLANO.md` 2.3 e 2.4).
3. **Frequentes**: tarefas abertas mais recentemente pelo usuário. Vazio: "Nenhuma tarefa aberta ainda."
4. **Bloqueado**: não existe por enquanto.
5. **Identidade**: pós-MVP, com servidor: Google, Microsoft e login manual. No MVP, troca manual de perfil.
6. **Dados de exemplo**: usar os fictícios do protótipo.
7. **Visão Equipe**: membro do projeto vê em somente leitura as tarefas de que não participa (tela fica para depois).
8. **Dono** da tarefa é quem a criou. Quem participa (criador, Responsável ou Apoio, sempre usuários) vê e edita. Entidades são stakeholders: só identificação, sem permissão.
9. **Responsável** é um usuário; **envolvidos** são entidades da lista do time ("Criar entidade"), com ou sem conta. **Chamado**: ID numérico + link opcional.
10. **Projetos** têm vários membros; só quem criou e o gestor gerenciam membros. Edição de gestor é sempre marcada como Gestor.

## Decisões em aberto
Ver `docs/PLANO.md`, seções 2 (interpretações a confirmar) e 12.

## Contexto para decisões futuras (fora do MVP)
- O time já usa uma plataforma de chamados (GLPI) e controle de versão no Azure DevOps; integrações com eles e com webhooks de commit serão a base dos plug-ins.
- Fluxo planejado para plug-ins: quando chegar uma informação (ex.: commit), a pessoa certa recebe um aviso na tela para indicar a que tarefa pertence; se a mensagem citar a tarefa, vincula sozinho e só avisa; o que ficar "para depois" vai para uma caixa de pendências.
