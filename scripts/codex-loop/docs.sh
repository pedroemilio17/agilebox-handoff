#!/usr/bin/env bash
# Documentação automática do laço. Carregado por run.sh (usa ROOT, LOOP_DIR e PROGRESS).
# Tudo vai para docs/laco/ e entra no git junto com o passo ou o marco.
#   diario.md              uma entrada por passo concluído
#   relatorio-<marco>.md   um relatório por marco (commits, dependências, testes, cobertura)
#   ocorrencias.md         bloqueios, falhas e paradas
#   RESUMO-FINAL.md        quando não há mais passos
#   pendencias-do-pedro.md escrito pelo Codex: o que só o Pedro pode conferir (não é tocado aqui)

LACO_DOCS="$ROOT/docs/laco"

ensure_docs() {
  mkdir -p "$LACO_DOCS"
  if [[ ! -f "$LACO_DOCS/diario.md" ]]; then
    printf '# Diário do laço\n\nUma entrada por passo concluído, escrita pelo script do laço.\n' > "$LACO_DOCS/diario.md"
  fi
  if [[ ! -f "$LACO_DOCS/ocorrencias.md" ]]; then
    printf '# Ocorrências do laço\n\nBloqueios, falhas e paradas, em ordem de data.\n' > "$LACO_DOCS/ocorrencias.md"
  fi
  [[ -f "$LACO_DOCS/pendencias-do-pedro.md" ]] || printf '# Pendências do Pedro\n\n' > "$LACO_DOCS/pendencias-do-pedro.md"
}

# Formata os documentos gerados para passarem no `format:check`.
format_docs() {
  pnpm exec prettier --write docs/laco PROGRESS.md > /dev/null 2>&1 || true
}

# $1 = texto do passo, $2 = pasta da rodada, $3 = rodadas gastas no passo (precisa de `git add` antes)
append_diary() {
  local text="$1" run_dir="$2" attempts="$3" stamp stat files msg=""
  stamp="$(date '+%Y-%m-%d %H:%M')"
  stat="$(git diff --cached --stat -- . ':!docs/laco' | tail -n 1 | sed 's/^ *//')"
  files="$(git diff --cached --name-only -- . ':!docs/laco' | head -n 40 | sed 's/^/  - `/; s/$/`/')"
  [[ -f "$run_dir/last-message.md" ]] && msg="$(head -n 30 "$run_dir/last-message.md" | sed 's/^/> /')"
  {
    printf '\n## %s · %s\n\n' "$stamp" "$text"
    printf -- '- Alterações: %s\n' "${stat:-nenhuma}"
    printf -- '- Rodadas do Codex neste passo: %s\n' "$attempts"
    printf -- '- Arquivos:\n%s\n' "$files"
    [[ -n "$msg" ]] && printf '\n**Resumo do Codex:**\n\n%s\n' "$msg"
  } >> "$LACO_DOCS/diario.md"
  return 0
}

# $1 = passo/marco, $2 = o que aconteceu
log_incident() {
  ensure_docs
  {
    printf '\n## %s · %s\n\n%s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" "$2"
    if [[ -s "$LOOP_DIR/blocked.md" ]]; then
      printf '\n**Motivo informado pelo Codex:**\n\n'
      sed 's/^/> /' "$LOOP_DIR/blocked.md"
    fi
    if [[ -s "$LOOP_DIR/last-failure.log" ]]; then
      printf '\n**Final da última verificação que falhou:**\n\n```\n'
      tail -n 25 "$LOOP_DIR/last-failure.log"
      printf '```\n'
    fi
  } >> "$LACO_DOCS/ocorrencias.md"
}

# $1 = marco (ex.: M2), $2 = pontos de revisão sugeridos (texto do PARADA)
write_milestone_report() {
  local ms="$1" review="$2" out="$LACO_DOCS/relatorio-$1.md"
  local first base prev commits count tests cover deps
  first="$(git log --reverse --format=%H --grep="^${ms}\\." | head -n 1)"
  base="HEAD"
  [[ -n "$first" ]] && base="$(git rev-parse --verify -q "${first}^" || echo "$first")"
  prev="$(git describe --tags --abbrev=0 --match 'marco-*' 2>/dev/null || true)"
  commits="$(git log --reverse --format='- `%h` %s' --grep="^${ms}\\.")"
  count="$(printf '%s\n' "$commits" | grep -c . || true)"
  tests="$(grep -E 'Test Files|Tests ' "$LOOP_DIR/checks.log" 2>/dev/null | tail -n 2 | sed 's/^ *//' || true)"
  cover="$(tail -n 45 "$LOOP_DIR/coverage.log" 2>/dev/null || true)"
  deps="$(git diff "$base" HEAD -- '*package.json' 2>/dev/null |
    grep -E '^\+ +"[^"]+": "[^"]*[0-9][^"]*",?$' | grep -v '"version"\|workspace:' |
    sed -E 's/^\+ +//; s/,$//' | sort -u || true)"

  {
    printf '# Relatório do marco %s\n\n' "$ms"
    printf -- '- Data: %s\n- Passos concluídos: %s\n- Tag git: `marco-%s`\n' "$(date '+%Y-%m-%d %H:%M')" "$count" "$ms"
    printf -- '- Verificações (`format:check`, `lint`, `typecheck`, `test`): **passaram** no fechamento do marco\n\n'
    printf '## Passos e commits\n\n%s\n\n' "${commits:-_nenhum commit encontrado_}"
    printf '## Testes\n\n```\n%s\n```\n\n' "${tests:-sem saída do Vitest}"
    printf '## Cobertura\n\n```\n%s\n```\n\n' "${cover:-sem saída de cobertura}"
    printf '## Dependências adicionadas neste marco\n\n'
    if [[ -n "$deps" ]]; then printf '```\n%s\n```\n\n' "$deps"; else printf '_nenhuma_\n\n'; fi
    printf '## Arquivos alterados\n\n```\n%s\n```\n\n' "$(git diff --stat "$base" HEAD -- . ':!docs/laco' ':!pnpm-lock.yaml' | tail -n 60)"
    printf '## Pontos de revisão sugeridos\n\n%s\n\n' "${review:-_não definidos_}"
    printf '## Notas dos passos (PROGRESS.md)\n\n'
    awk -v ms="$ms" '
      $0 ~ "^## " ms " " { on = 1; next }
      on && /^## / { exit }
      on && (/^- \[/ || /^  - Nota/) { print }
    ' "$PROGRESS"
    printf '\n## Pendências abertas para o Pedro\n\n'
    sed '1,/^$/d' "$LACO_DOCS/pendencias-do-pedro.md" 2>/dev/null || true
    printf '\n## Como revisar ou desfazer\n\n'
    printf -- '- Ver tudo: `git diff %s marco-%s`\n' "${prev:-<commit-anterior>}" "$ms"
    printf -- '- Ver um passo: `git show <commit>`\n'
    printf -- '- Voltar a este marco: `git switch -c revisao-%s marco-%s`\n' "$ms" "$ms"
    printf -- '- Refazer um passo: `git revert <commit>`, desmarque o `[x]` no `PROGRESS.md` e rode o laço\n'
  } > "$out"
}

write_final_summary() {
  local out="$LACO_DOCS/RESUMO-FINAL.md"
  {
    printf '# Resumo final do laço\n\n- Data: %s\n- Commits da branch: %s\n\n' "$(date '+%Y-%m-%d %H:%M')" "$(git rev-list --count HEAD)"
    printf '## Marcos\n\n'
    git tag --list 'marco-*' --sort=creatordate | while read -r tag; do
      printf -- '- `%s` · [relatório](relatorio-%s.md)\n' "$tag" "${tag#marco-}"
    done
    printf '\n## O que ainda depende do Pedro\n\n'
    sed '1,/^$/d' "$LACO_DOCS/pendencias-do-pedro.md" 2>/dev/null || true
    printf '\n## Onde está o registro\n\n'
    printf -- '- `docs/laco/diario.md`: uma entrada por passo\n- `docs/laco/ocorrencias.md`: bloqueios e falhas\n- `PROGRESS.md`: passos e notas\n'
  } > "$out"
}
