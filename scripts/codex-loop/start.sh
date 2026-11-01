#!/usr/bin/env bash
# Inicia o laço desacoplado do terminal: continua rodando se você fechar o terminal ou o editor.
# Aceita as mesmas variáveis do run.sh (MAX_ROUNDS, ON_BLOCKED, CODEX_FLAGS...).
# Acompanhar: scripts/codex-loop/status.sh   ou   tail -f .loop/loop.out
# Parar com calma (ao fim do passo atual): touch .loop/STOP
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mkdir -p .loop

loop_pid() { # imprime o PID do laço deste projeto, se estiver rodando
  local pid
  for pid in $(pgrep -f 'codex-loop/run.sh' || true); do
    if [[ "$(readlink "/proc/$pid/cwd" 2> /dev/null || true)" == "$ROOT" ]]; then
      echo "$pid"
      return 0
    fi
  done
  return 1
}

if existing="$(loop_pid)"; then
  echo "O laço já está rodando (PID $existing). Veja: scripts/codex-loop/status.sh" >&2
  exit 1
fi

command -v setsid > /dev/null || { echo "setsid não encontrado (pacote util-linux)." >&2; exit 1; }

{
  echo "=== laço iniciado em $(date '+%F %T') ==="
} >> .loop/loop.out
setsid nohup "$ROOT/scripts/codex-loop/run.sh" "$@" >> .loop/loop.out 2>&1 < /dev/null &

# Se o laço morrer logo ao iniciar (árvore suja, branch errada, Codex ausente...), mostra o motivo agora.
sleep 3
if pid="$(loop_pid)"; then
  echo "Laço iniciado (PID $pid), desacoplado do terminal."
  echo "Acompanhar:  scripts/codex-loop/status.sh   ou   tail -f .loop/loop.out"
  echo "Parar:       touch .loop/STOP   (para ao fim do passo atual)"
else
  echo "O laço NÃO ficou rodando. Últimas linhas de .loop/loop.out:" >&2
  tail -n 8 .loop/loop.out | sed 's/\x1b\[[0-9;]*m//g' >&2
  exit 1
fi
