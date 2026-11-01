#!/usr/bin/env bash
# Mostra o estado do laço: rodando ou parado, passo atual, últimos commits, marcos e a saída recente.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

running=""
for pid in $(pgrep -f 'codex-loop/run.sh' || true); do
  [[ "$(readlink "/proc/$pid/cwd" 2> /dev/null || true)" == "$ROOT" ]] && running="$pid"
done

if [[ -n "$running" ]]; then
  echo "Estado: RODANDO (PID $running, há $(ps -o etime= -p "$running" | tr -d ' '))"
else
  echo "Estado: PARADO"
fi

pending="$(grep -m1 -E '^- \[( |!)\] ' PROGRESS.md | cut -c1-90 || true)"
done_count="$(grep -c -E '^- \[x\] ' PROGRESS.md || true)"
todo_count="$(grep -c -E '^- \[ \] ' PROGRESS.md || true)"
echo "Passos: $done_count feitos, $todo_count pendentes"
echo "Próximo/atual: ${pending:-nenhum (acabou)}"
echo
echo "Marcos fechados: $(git tag --list 'marco-*' --sort=creatordate | tr '\n' ' ')"
echo
echo "Últimos commits:"
git log --oneline -5
echo
if [[ -f docs/laco/ocorrencias.md ]]; then
  echo "Última ocorrência:"
  grep -E '^## ' docs/laco/ocorrencias.md | tail -n 1 || true
  echo
fi
if [[ -f .loop/loop.out ]]; then
  echo "Saída recente (.loop/loop.out):"
  tail -n 6 .loop/loop.out | sed 's/\x1b\[[0-9;]*m//g'
fi
