#!/usr/bin/env bash
# Laço do Codex: executa um passo do PROGRESS.md por rodada, instala dependências pedidas,
# roda as verificações, documenta (docs/laco/) e faz commit do passo.
# Modo contínuo (padrão): em cada PARADA roda as verificações do marco, escreve o relatório, cria a
# tag `marco-<Mx>` e segue. Só para em BLOCKED, falhas seguidas, [manual] ou fim dos passos.
# STOP_AT_PARADA=1 volta ao modo antigo (parar em cada marco).
# Uso e pré-requisitos: scripts/codex-loop/README.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MAX_ROUNDS="${MAX_ROUNDS:-300}"       # rodadas do Codex nesta execução
STOP_AT_PARADA="${STOP_AT_PARADA:-0}" # 1 = parar em cada PARADA (revisão a cada marco)
MAX_FAILS="${MAX_FAILS:-3}"           # falhas seguidas no mesmo passo antes de parar
MAX_DEP_ROUNDS="${MAX_DEP_ROUNDS:-3}" # pedidos de dependência seguidos no mesmo passo
CODEX_BIN="${CODEX_BIN:-codex}"
# workspace-write: escreve só na pasta do projeto, sem rede. approval_policy=never: nunca para esperando aprovação.
CODEX_FLAGS="${CODEX_FLAGS:---sandbox workspace-write -c approval_policy=\"never\"}"
CODEX_MODEL="${CODEX_MODEL:-}"

LOOP_DIR="$ROOT/.loop"
PROGRESS="$ROOT/PROGRESS.md"
PROMPT_FILE="$ROOT/scripts/codex-loop/prompt.md"
RULES_FILE="$ROOT/scripts/codex-loop/regras.md"
FAILURE_LOG="$LOOP_DIR/last-failure.log"

log()  { printf '\n\033[1;34m[laço]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[laço]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[laço]\033[0m %s\n' "$*" >&2; exit 1; }

# shellcheck source=scripts/codex-loop/docs.sh
source "$ROOT/scripts/codex-loop/docs.sh"

preflight() {
  command -v "$CODEX_BIN" >/dev/null || die "Codex não encontrado ('$CODEX_BIN')."
  command -v pnpm >/dev/null || die "pnpm não encontrado."
  command -v node >/dev/null || die "Node não encontrado."
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  (( node_major >= 22 )) || die "Node 22 ou mais novo é necessário (atual: $(node -v))."

  git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "Isto não é um repositório git. Rode: git init && git add -A && git commit -m 'docs: plano'"
  local branch
  branch="$(git branch --show-current)"
  [[ -n "$branch" && "$branch" != "main" && "$branch" != "master" ]] \
    || die "Rode o laço numa branch separada. Ex.: git switch -c codex/m1-m4"
  [[ -z "$(git status --porcelain)" ]] \
    || die "Há mudanças não commitadas. Faça commit ou descarte antes de iniciar o laço."

  mkdir -p "$LOOP_DIR/runs"
  [[ -f "$RULES_FILE" ]] || die "Falta $RULES_FILE."
  ensure_docs
}

# Imprime "linha<TAB>marca<TAB>texto" do primeiro passo pendente ou bloqueado.
next_step() {
  awk '
    /^- \[( |!)\] / {
      mark = substr($0, 4, 1)
      text = substr($0, 7)
      printf "%d\t%s\t%s\n", NR, mark, text
      exit
    }
  ' "$PROGRESS"
}

set_mark() { # $1 = linha, $2 = nova marca (x ou !)
  sed -i -E "${1}s/^- \[[ !]\] /- [${2}] /" "$PROGRESS"
}

install_deps() {
  local deps_file="$LOOP_DIR/deps.txt"
  [[ -s "$deps_file" ]] || { warn "NEEDS_DEPS sem .loop/deps.txt; nada a instalar."; return 0; }

  declare -A groups=()
  local target kind pkg key
  while read -r target kind pkg _ || [[ -n "${target:-}" ]]; do
    [[ -z "${target:-}" || "$target" == \#* ]] && continue
    [[ "$kind" == "dev" || "$kind" == "prod" ]] || die "Linha inválida em deps.txt: '$target $kind $pkg'"
    key="$target|$kind"
    groups["$key"]="${groups[$key]:-} $pkg"
  done < "$deps_file"

  for key in "${!groups[@]}"; do
    target="${key%%|*}"
    kind="${key##*|}"
    local -a flags=()
    [[ "$kind" == "dev" ]] && flags+=("-D")
    # shellcheck disable=SC2206
    local -a pkgs=(${groups[$key]})
    if [[ "$target" == "root" ]]; then
      log "Instalando na raiz ($kind): ${pkgs[*]}"
      pnpm add -w "${flags[@]}" "${pkgs[@]}"
    else
      log "Instalando em $target ($kind): ${pkgs[*]}"
      pnpm --filter "$target" add "${flags[@]}" "${pkgs[@]}"
    fi
  done
  rm -f "$deps_file"
}

run_checks() {
  [[ -f "$ROOT/package.json" ]] || return 0
  {
    pnpm install --prefer-offline &&
    pnpm run --if-present format:check &&
    pnpm run --if-present lint &&
    pnpm run --if-present typecheck &&
    pnpm run --if-present test
  } > "$LOOP_DIR/checks.log" 2>&1
}

build_prompt() { # $1 = linha, $2 = texto do passo
  cat "$PROMPT_FILE"
  printf '\n'
  cat "$RULES_FILE"
  printf '\n## Passo desta rodada\n\n`%s` (linha %s do PROGRESS.md). Leia o bloco completo do passo, com os subitens.\n' "$2" "$1"
  if [[ -s "$FAILURE_LOG" ]]; then
    printf '\n## Atenção\n\nA rodada anterior deste passo falhou nas verificações. A saída está em `.loop/last-failure.log`. Corrija isso primeiro.\n'
  fi
}

# Fecha um marco: verifica tudo, escreve o relatório, marca a PARADA, comita e cria a tag.
checkpoint() { # $1 = linha, $2 = texto da PARADA
  local ms
  [[ "$2" =~ PARADA\ (M[0-9]+) ]] || die "Linha de PARADA sem marco: $2"
  ms="${BASH_REMATCH[1]}"
  local review
  review="$(sed -E 's/^[[:space:]]+//' <<< "${2#*:}")"
  log "Fechando o marco $ms: verificações finais, cobertura e relatório"

  if ! run_checks; then
    cp -f "$LOOP_DIR/checks.log" "$FAILURE_LOG"
    log_incident "Marco $ms" "As verificações finais do marco falharam. Nada foi marcado; corrija e rode o laço de novo."
    die "As verificações finais do marco $ms falharam (veja .loop/checks.log)."
  fi
  if ! pnpm run --if-present coverage > "$LOOP_DIR/coverage.log" 2>&1; then
    cp -f "$LOOP_DIR/coverage.log" "$FAILURE_LOG"
    log_incident "Marco $ms" "A cobertura mínima do marco não foi atingida (ou o comando falhou)."
    die "Cobertura do marco $ms falhou (veja .loop/coverage.log)."
  fi

  write_milestone_report "$ms" "$review"
  set_mark "$1" "x"
  format_docs
  git add -A
  git commit -q -m "docs(laço): relatório do marco $ms" -m "Gerado pelo script do laço (scripts/codex-loop)."
  git tag -f "marco-$ms" > /dev/null
  log "Marco $ms fechado. Relatório: docs/laco/relatorio-$ms.md · tag marco-$ms"
}

main() {
  preflight

  local round=0 fails=0 dep_rounds=0 attempts=0 last_step=""
  while (( round < MAX_ROUNDS )); do
    [[ -f "$LOOP_DIR/STOP" ]] && { log "Arquivo .loop/STOP encontrado. Parando."; rm -f "$LOOP_DIR/STOP"; exit 0; }

    local info line mark text step_id
    info="$(next_step)"
    if [[ -z "$info" ]]; then
      write_final_summary
      format_docs
      git add -A
      git diff --cached --quiet || git commit -q -m "docs(laço): resumo final" -m "Gerado pelo script do laço (scripts/codex-loop)."
      log "Nenhum passo pendente. Fim. Resumo: docs/laco/RESUMO-FINAL.md"
      exit 0
    fi
    IFS=$'\t' read -r line mark text <<< "$info"
    step_id="${text%% *}"

    if [[ "$mark" == "!" ]]; then
      die "Passo bloqueado: $text. Veja .loop/blocked.md, resolva e troque [!] por [ ] no PROGRESS.md."
    fi
    if [[ "$text" == *"[manual]"* ]]; then
      log "Passo manual: $text"
      log "Faça o que o passo pede, marque a linha como [x] no PROGRESS.md, faça commit e rode o laço de novo."
      exit 0
    fi
    if [[ "$text" == *PARADA* ]]; then
      if [[ "$STOP_AT_PARADA" == "1" ]]; then
        log "Parada para revisão: $text"
        log "Revise, marque a linha como [x] no PROGRESS.md, faça commit e rode o laço de novo."
        exit 0
      fi
      checkpoint "$line" "$text"
      continue
    fi

    if [[ "$step_id" != "$last_step" ]]; then
      fails=0; dep_rounds=0; attempts=0; rm -f "$FAILURE_LOG"; last_step="$step_id"
    fi

    round=$((round + 1))
    attempts=$((attempts + 1))
    local run_dir="$LOOP_DIR/runs/$(date +%Y%m%d-%H%M%S)-$step_id"
    mkdir -p "$run_dir"
    rm -f "$LOOP_DIR/status" "$LOOP_DIR/deps.txt" "$LOOP_DIR/blocked.md"

    log "Rodada $round/$MAX_ROUNDS · $text"
    local -a codex_flags=()
    read -r -a codex_flags <<< "$CODEX_FLAGS"
    [[ -n "$CODEX_MODEL" ]] && codex_flags+=("--model" "$CODEX_MODEL")

    local codex_ok=1
    "$CODEX_BIN" exec "${codex_flags[@]}" \
      --output-last-message "$run_dir/last-message.md" \
      "$(build_prompt "$line" "$text")" 2>&1 | tee "$run_dir/codex.log" || codex_ok=0

    local status=""
    [[ -f "$LOOP_DIR/status" ]] && status="$(tr -d '[:space:]' < "$LOOP_DIR/status")"
    log "Status informado pelo Codex: ${status:-<nenhum>}"

    # Codex saiu com erro sem escrever status: problema de execução (opção inválida, login, limite),
    # não do código. Repetir só gastaria rodadas.
    if (( codex_ok == 0 )) && [[ -z "$status" ]]; then
      die "O Codex não conseguiu rodar (veja $run_dir/codex.log). Confira CODEX_FLAGS, o login e os limites da conta."
    fi

    case "$status" in
      NEEDS_DEPS)
        dep_rounds=$((dep_rounds + 1))
        (( dep_rounds <= MAX_DEP_ROUNDS )) || die "Muitos pedidos de dependência seguidos em $step_id."
        install_deps
        pnpm install
        continue
        ;;
      BLOCKED)
        set_mark "$line" "!"
        cp -f "$LOOP_DIR/blocked.md" "$run_dir/" 2>/dev/null || true
        log_incident "$text" "O Codex bloqueou o passo. As mudanças da rodada ficaram sem commit."
        die "Codex bloqueou em $step_id. Leia .loop/blocked.md. As mudanças ficaram sem commit para você revisar."
        ;;
    esac

    if (( codex_ok == 1 )) && [[ "$status" == "DONE" ]] && run_checks; then
      set_mark "$line" "x"
      rm -f "$FAILURE_LOG"
      git add -A
      append_diary "$text" "$run_dir" "$attempts"
      format_docs
      git add -A
      git commit -q -m "$text" -m "Gerado pelo Codex no laço automático (scripts/codex-loop)."
      log "Passo $step_id concluído e commitado."
      continue
    fi

    fails=$((fails + 1))
    {
      echo "Passo: $text"
      echo "Codex terminou sem erro: $codex_ok · status: ${status:-<nenhum>}"
      echo
      [[ -f "$LOOP_DIR/checks.log" ]] && cat "$LOOP_DIR/checks.log"
    } > "$FAILURE_LOG"
    cp -f "$FAILURE_LOG" "$run_dir/"
    warn "Falha $fails/$MAX_FAILS em $step_id (detalhes em .loop/last-failure.log)."
    if (( fails >= MAX_FAILS )); then
      log_incident "$text" "$MAX_FAILS falhas seguidas nas verificações. As mudanças da rodada ficaram sem commit."
    fi
    (( fails < MAX_FAILS )) || die "Parando: $MAX_FAILS falhas seguidas em $step_id. As mudanças ficaram sem commit."
  done

  log "Limite de $MAX_ROUNDS rodadas atingido. Rode de novo para continuar."
}

main "$@"
