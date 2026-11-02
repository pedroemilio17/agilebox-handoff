# 0004 · "Minhas tarefas" do gestor

- **Data**: 2026-11-02 (M0.1)
- **Estado**: aceito

## Contexto

O seletor "Minhas tarefas | Equipe" estava estático e não estava definido o que o gestor vê em "Minhas tarefas".

## Decisão

"Minhas tarefas" tem a mesma regra para todos, gestor incluído: tarefas de que a pessoa participa (criou, é Responsável ou Apoio). "Equipe" mostra as tarefas da organização que a pessoa pode ver (gestor: todas; colaborador: só as suas).

## Consequências

- `listTasks` recebe o escopo `mine | team`.
- Edições do gestor em tarefas alheias continuam marcadas como Gestor.
