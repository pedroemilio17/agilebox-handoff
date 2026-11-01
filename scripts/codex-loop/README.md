# Laço do Codex

Constrói o AgileBox passo a passo a partir do `PROGRESS.md` (M1 a M10), **sem parar a cada marco**, e documenta tudo.

## O que cada rodada faz

1. Pega o primeiro passo pendente (`- [ ]`).
2. Chama `codex exec` com `prompt.md` + `regras.md` + o passo. As regras vêm no prompt; não dependem do `AGENTS.md`.
3. Se o Codex pediu pacotes (`.loop/deps.txt`), o script instala com `pnpm add` **fora** do sandbox e repete o passo.
4. Roda `pnpm install` e as verificações (`format:check`, `lint`, `typecheck`, `test`; a partir do M5.11 também o build).
5. Verde: marca `[x]`, **escreve a entrada no `docs/laco/diario.md`** e faz **um commit por passo**. Vermelho: guarda a saída em `.loop/last-failure.log` e repete o passo.

## Em cada PARADA (fim de marco)

O modo padrão **não para**: o script faz o fechamento do marco e segue.

1. roda as verificações completas e a cobertura (`pnpm coverage`);
2. escreve `docs/laco/relatorio-<marco>.md` (commits, testes, cobertura, dependências novas, notas dos passos, pontos de revisão, como desfazer);
3. marca a PARADA, comita e cria a tag `marco-<Mx>`.

Se as verificações do marco falharem, o laço para (e registra em `docs/laco/ocorrencias.md`). Para parar de verdade em cada marco, use `STOP_AT_PARADA=1`.

## O laço só para quando

- o Codex escreve `BLOCKED` (decisão de produto não definida ou falha que não resolve; motivo em `.loop/blocked.md` e em `docs/laco/ocorrencias.md`; o passo vira `[!]`);
- o mesmo passo falha 3 vezes seguidas;
- as verificações finais de um marco falham;
- encontra um passo `[manual]`;
- atinge `MAX_ROUNDS` (padrão 300; rode de novo para continuar);
- existe o arquivo `.loop/STOP` (`touch .loop/STOP` para parar ao fim da rodada atual);
- acabam os passos: escreve `docs/laco/RESUMO-FINAL.md` e termina.

## Documentação gerada (`docs/laco/`)

| Arquivo                  | Quem escreve | Conteúdo                                          |
| ------------------------ | ------------ | ------------------------------------------------- |
| `diario.md`              | script       | uma entrada por passo concluído                   |
| `relatorio-<marco>.md`   | script       | relatório do marco                                |
| `ocorrencias.md`         | script       | bloqueios, falhas e paradas                       |
| `RESUMO-FINAL.md`        | script       | marcos e pendências ao final                      |
| `pendencias-do-pedro.md` | Codex        | o que só o Pedro pode conferir, testar ou decidir |

Mais: notas por passo no `PROGRESS.md`, decisões em `docs/decisoes/` e as tags `marco-*`.

## Pré-requisitos

- Node 22+ e pnpm 10+ (sem sudo: `npm install -g pnpm --prefix ~/.local`).
- Compilador C/C++ para o `better-sqlite3` (M4). Fedora: `sudo dnf install gcc-c++ make python3`. WSL/Ubuntu: `sudo apt install build-essential python3`.
- Codex CLI instalado e logado (`codex login`).
- No Windows: rode no **WSL2**, com o repositório dentro do Linux, não em `/mnt/c`.
- Git com a árvore limpa, numa branch que não seja `main`/`master`.

## Rodar

```bash
scripts/codex-loop/run.sh                   # modo contínuo, até o fim
STOP_AT_PARADA=1 scripts/codex-loop/run.sh  # para em cada marco
MAX_ROUNDS=20 scripts/codex-loop/run.sh     # limita a execução
```

Para deixar rodando sem prender o terminal: `nohup scripts/codex-loop/run.sh > .loop/loop.out 2>&1 &` e acompanhar com `tail -f .loop/loop.out` ou `git log --oneline`.

## Se parar

- **BLOCKED**: leia `docs/laco/ocorrencias.md`, decida, registre a decisão no `docs/PLANO.md` (ou peça ao Claude), troque `[!]` por `[ ]` e rode de novo. As mudanças da rodada ficam sem commit.
- **3 falhas**: veja `.loop/last-failure.log` e `.loop/runs/<data>-<passo>/`. Corrija à mão ou descarte (`git checkout -- . && git clean -fd`) e rode de novo.
- **Marco falhou**: corrija o que o `.loop/checks.log` apontar, faça commit e rode de novo.

## Variáveis

| Variável         | Padrão                                                 | Uso                                            |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `MAX_ROUNDS`     | 300                                                    | rodadas por execução                           |
| `MAX_FAILS`      | 3                                                      | falhas seguidas no mesmo passo                 |
| `MAX_DEP_ROUNDS` | 3                                                      | pedidos de dependência seguidos no mesmo passo |
| `STOP_AT_PARADA` | 0                                                      | 1 = parar em cada PARADA                       |
| `CODEX_BIN`      | `codex`                                                | executável                                     |
| `CODEX_FLAGS`    | `--sandbox workspace-write -c approval_policy="never"` | opções do `codex exec`                         |
| `CODEX_MODEL`    | (padrão do Codex)                                      | modelo, se quiser fixar                        |

## Segurança

- Nunca use `--dangerously-bypass-approvals-and-sandbox` fora de contêiner ou máquina virtual.
- A rede fica bloqueada para o Codex. Só o script baixa pacotes, e só os listados em `.loop/deps.txt`. Confira os commits que mudam `package.json` (os relatórios de marco listam as dependências novas).
- Não edite arquivos do projeto enquanto o laço roda: o script faz `git add -A` a cada passo.
