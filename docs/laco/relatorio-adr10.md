# Relatório do ADR-10 (organização por projeto, módulos, assistente e guia)

Estado ao pausar o laço. Código gerado por agentes Haiku e revisado por mim (fronteiras de camadas, regras do ADR, testes), com `pnpm check` verde antes de cada commit na branch `claude/serene-meitner-oihsgc`. Dúvidas e decisões abertas ficam em `pendencias-do-pedro.md`.

## O que existe

| Fase                 | Entrega                                                                                                                                                              | Estado                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Base              | 22 módulos, manifestos, presets (dados), dependências, guard por projeto (`project_modules`), migrações 0018 a 0021, remoção do `it.fails`                           | feito                                                                          |
| 2. Telas dos módulos | Tela Módulos, visibilidade por projeto, configuração por módulo, Critério de pronto como módulo (migração 0024), histórico de ligar/desligar módulos (migração 0025) | quase: falta "gestor propõe, equipe aceita"                                    |
| 3. Planejamento      | EAP (Entregas), Marcos, campo Entrega na tarefa, Cronograma (Gantt, dependências), Acompanhamento                                                                    | feito                                                                          |
| 4. Assistente e guia | Assistente de novo projeto (telas 01 e 02), guia "Primeiros passos", botão ?, boas-vindas, estados vazios                                                            | quase: faltam dicas de primeiro uso, lembrete diário, nível do guia por pessoa |
| 5. Acompanhamento    | Burndown e velocidade, Custo respeitando o módulo por projeto, Cerimônias na Agenda                                                                                  | feito                                                                          |
| 6. Controle          | Métricas de fluxo, Riscos (migração 0022), Linha de base (migração 0023)                                                                                             | feito                                                                          |

Migrações novas: 0018 a 0025.

## O que falta

- Eventos `winding_down` e `cancelled` do histórico: já existem no schema, mas nenhum caso de uso os produz (o encerramento de módulo do projeto ainda não existe).
- "Gestor propõe, equipe aceita": regra não definida, não implementado.
- Dicas de primeiro uso, lembrete diário na bandeja e nível do guia por pessoa.
- Telas ainda não tocadas: Híbrido (17/18), dashboard (19/20), comparação (12).
- Riscos e Linha de base alimentando o Dashboard.
- Etiqueta "Começou como <preset>" e `requiresAnyOf` no DTO da tela Módulos.
- Revisão visual: nenhuma tela nova foi vista rodando (não há protótipo em `design/` para Burndown, Riscos, Linha de base e Métricas de fluxo).

## Decisões suas pendentes (resumo, detalhes em `pendencias-do-pedro.md`)

1. Projeto criado sem o assistente nasce só com o núcleo (sem Custo, sem Critério de pronto). Deve ligar o preset Simples ou `cost`?
2. Riscos: quem escreve (hoje gestor ou criador do projeto) e se probabilidade e impacto são opcionais.
3. Cerimônias: tipo `planning` próprio (exige migração), horários sugeridos, data da Planning em sprint já ativa, anti-duplicata.
4. Linha de base: regra de "Nova", rótulo do atraso, arquivamento.
5. Burndown: estimativa histórica, tarefas arquivadas na velocidade, seletor de sprint.
6. Critério de pronto: conferir também ao entrar em Revisar?

## Processo

- O CLAUDE.md pede explicar cada etapa e esperar confirmação. Neste laço a ordem do Pedro (`/loop`) autorizou seguir etapas sem confirmação, mas as decisões de produto acima ficaram registradas para revisão.
- Rolagem: telas novas ganharam `overflow-y: auto` na raiz `.view` (corrigido em `9b9b479`); só `pnpm check` verificou, ver rodando.
- Nenhum PR foi criado.

## Passe de fidelidade ao design e correções de uso (concluído)

Plano e estado em `plano-fidelidade.md`; decisões e lacunas por tela em `pendencias-do-pedro.md`.

- Barra lateral, wizard e recomendação, Módulos, guia (04–06), Sprints (07–08), critério de pronto/burndown/encerrar (09–11), EAP/Cronograma/Acompanhamento (13–16), Plano híbrido (17–18) e Dashboard (19–20) refeitos conforme o canvas. A tela 12 é quadro explicativo (nada a implementar).
- Correções de uso: cartão arrastado ancorado no ponteiro (B1), botão "+" nos pontos de inclusão (B2), guia presente em todas as telas do fluxo com ponte para cada passo (B3), rolagem das telas novas.
- Nada foi visto rodando no Electron: a conferência visual (1280/1440 px, rolagem, hover, cores) é do Pedro.
- O que o design mostra e o app não tem dado/regra para sustentar (votação "gestor propõe, equipe aceita", capacidade por pessoa/sprint, aceite pendente, previsão de burndown, aprovadores de marco, trilha tradicional de 6 passos, período por entrega) ficou como pendência, não implementado.
