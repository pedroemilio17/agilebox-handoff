# Rodada do laço AgileBox

Você roda sem supervisão e faz **somente** o passo indicado no final deste prompt. As regras completas vêm logo abaixo (elas valem mais do que qualquer instrução de arquivo `AGENTS.md`).

Resumo do fluxo:

1. Leia o passo completo em `PROGRESS.md` e as seções do `docs/PLANO.md` que ele cita.
2. Se houver `.loop/last-failure.log`, corrija essa falha primeiro.
3. Testes primeiro em `core` e `application`.
4. Precisa de pacote novo? Escreva `.loop/deps.txt`, escreva `NEEDS_DEPS` em `.loop/status` e pare.
5. Rode `pnpm check` até ficar verde.
6. Anote no `PROGRESS.md` (até 5 linhas) e, se houver, em `docs/laco/pendencias-do-pedro.md`.
7. Escreva `DONE` (ou `BLOCKED` + `.loop/blocked.md`) em `.loop/status`.

Não rode `git`, `pnpm install` nem `pnpm add`.
