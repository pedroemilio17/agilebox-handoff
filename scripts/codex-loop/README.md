# Laço do Codex

Constrói o AgileBox passo a passo a partir do `PROGRESS.md`. Cada rodada:

1. pega o primeiro passo pendente (`- [ ]`);
2. chama `codex exec` com `prompt.md` + o passo (o Codex lê o `AGENTS.md` sozinho);
3. se o Codex pediu pacotes (`.loop/deps.txt`), instala com `pnpm add` **fora** do sandbox e repete o passo;
4. roda `pnpm install`, `format:check`, `lint`, `typecheck` e `test`;
5. tudo verde → marca `[x]` e faz **um commit por passo**; vermelho → guarda a saída em `.loop/last-failure.log` e repete o passo.

O laço **para** quando:

- chega numa linha `PARADA` ou `[manual]` (revisão sua);
- o Codex escreve `BLOCKED` (motivo em `.loop/blocked.md`; o passo vira `[!]`);
- o mesmo passo falha 3 vezes seguidas;
- atinge o limite de rodadas;
- existe o arquivo `.loop/STOP` (`touch .loop/STOP` para parar com calma ao fim da rodada atual).

## Pré-requisitos

- Node 22+ e pnpm 10+. Sem sudo: `npm install -g pnpm --prefix ~/.local` (instala em `~/.local/bin`).
- Compilador C/C++ para o `better-sqlite3` (M4). Fedora: `sudo dnf install gcc-c++ make python3`. WSL/Ubuntu: `sudo apt install build-essential python3`.
- Codex CLI instalado e logado (`codex login`).
- **No Windows**: rode no **WSL2**, com o repositório dentro do Linux (ex.: `~/projetos/agilebox`), não em `/mnt/c`.

## Primeira vez

```bash
chmod +x scripts/codex-loop/run.sh
git init
git add -A
git commit -m "docs: plano, AGENTS e laço do Codex"
git switch -c codex/m1-m4
codex exec --help   # confira se --sandbox, -c e --output-last-message existem na sua versão
scripts/codex-loop/run.sh
```

## Depois de cada PARADA

1. Revise o código e os commits da branch (`git log --oneline`).
2. Se estiver bom, troque `- [ ] PARADA …` por `- [x] PARADA …` no `PROGRESS.md` e faça commit.
3. Rode `scripts/codex-loop/run.sh` de novo.

Para refazer um passo: `git revert` (ou `git reset`) do commit dele, desmarque o `[x]` e rode o laço.

## Se bloquear ou falhar

- **BLOCKED**: leia `.loop/blocked.md`, decida, registre a decisão no `docs/PLANO.md` (ou peça ao Claude), troque `[!]` por `[ ]` e rode de novo. As mudanças da rodada ficam sem commit para você ver.
- **3 falhas**: veja `.loop/last-failure.log` e os logs em `.loop/runs/<data>-<passo>/`. Corrija à mão ou descarte (`git checkout -- . && git clean -fd`) e rode de novo.

## Variáveis

| Variável         | Padrão                                                 | Uso                                                                               |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `MAX_ROUNDS`     | 30                                                     | rodadas por execução                                                              |
| `MAX_FAILS`      | 3                                                      | falhas seguidas no mesmo passo                                                    |
| `MAX_DEP_ROUNDS` | 3                                                      | pedidos de dependência seguidos no mesmo passo                                    |
| `CODEX_BIN`      | `codex`                                                | caminho do executável                                                             |
| `CODEX_FLAGS`    | `--sandbox workspace-write -c approval_policy="never"` | opções do `codex exec` (escrita só na pasta, rede bloqueada, sem pedir aprovação) |
| `CODEX_MODEL`    | (padrão do Codex)                                      | modelo, se quiser fixar                                                           |

Exemplo: `MAX_ROUNDS=5 scripts/codex-loop/run.sh`.

## Segurança

- Não use `--dangerously-bypass-approvals-and-sandbox` fora de contêiner ou máquina virtual.
- O laço só roda numa branch que não seja `main`/`master` e com a árvore limpa.
- A rede fica bloqueada para o Codex. Só o script baixa pacotes, e só os listados em `.loop/deps.txt` (confira os commits que mudam `package.json`).
