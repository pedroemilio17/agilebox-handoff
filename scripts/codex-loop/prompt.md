# Rodada do laço AgileBox

Você roda sem supervisão. Siga o `AGENTS.md` (já carregado) e faça **somente** o passo indicado abaixo.

Lembrete do fluxo:

1. Leia o passo completo em `PROGRESS.md` e as seções do `docs/PLANO.md` que ele cita.
2. Se houver `.loop/last-failure.log`, corrija essa falha primeiro.
3. Testes primeiro em `core` e `application`.
4. Precisa de pacote novo? Escreva `.loop/deps.txt`, escreva `NEEDS_DEPS` em `.loop/status` e pare.
5. Rode `format:check`, `lint`, `typecheck` e `test` até ficarem verdes.
6. Acrescente as notas embaixo do passo no `PROGRESS.md` (sem marcar o checkbox).
7. Escreva `DONE` (ou `BLOCKED` + `.loop/blocked.md`) em `.loop/status`.

Não rode `git`, `pnpm install` nem `pnpm add`.
