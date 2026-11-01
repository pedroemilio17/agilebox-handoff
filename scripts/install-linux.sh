#!/usr/bin/env bash
# Instala (ou atualiza) o AgileBox no Linux a partir dos Releases do GitHub.
#
#   curl -fsSL https://raw.githubusercontent.com/pedroemilio17/agilebox-handoff/HEAD/scripts/install-linux.sh | bash
#
# Opções:  --no-launch   não abre o app no fim
#          --uninstall   remove o app, o atalho e o ícone (mantém os dados)
#          --purge       com --uninstall, apaga também os dados
set -euo pipefail

REPO="pedroemilio17/agilebox-handoff"
APP_DIR="$HOME/Applications"
APP="$APP_DIR/AgileBox.AppImage"
DESKTOP_FILE="$HOME/.local/share/applications/agilebox.desktop"
ICON_FILE="$HOME/.local/share/icons/hicolor/256x256/apps/agilebox.png"
DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/@agilebox/desktop"

LAUNCH=1
UNINSTALL=0
PURGE=0
for arg in "$@"; do
  case "$arg" in
    --no-launch) LAUNCH=0 ;;
    --uninstall) UNINSTALL=1 ;;
    --purge) PURGE=1 ;;
    *) echo "Opção desconhecida: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1;34m›\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Pergunta mesmo quando o script chega por `curl | bash` (lê do terminal, não do pipe).
ask() {
  local answer=""
  if [[ -r /dev/tty ]]; then read -r -p "$1 [s/N] " answer < /dev/tty || true; fi
  [[ "$answer" =~ ^[sSyY]$ ]]
}

stop_running() {
  pkill -f "$APP" 2> /dev/null || true
}

refresh_menu() {
  command -v update-desktop-database > /dev/null && update-desktop-database -q "$(dirname "$DESKTOP_FILE")" || true
  command -v gtk-update-icon-cache > /dev/null && gtk-update-icon-cache -q -t "$HOME/.local/share/icons/hicolor" 2> /dev/null || true
}

if [[ "$UNINSTALL" == 1 ]]; then
  say "Removendo o AgileBox"
  stop_running
  rm -f "$APP" "$DESKTOP_FILE" "$ICON_FILE"
  refresh_menu
  if [[ "$PURGE" == 1 ]]; then
    rm -rf "$DATA_DIR"
    say "Dados apagados ($DATA_DIR)."
  else
    say "Dados mantidos em $DATA_DIR (use --uninstall --purge para apagar)."
  fi
  exit 0
fi

command -v curl > /dev/null || fail "O curl é necessário (sudo dnf install curl)."

# 1. FUSE: o AppImage é montado como um disco e precisa da libfuse 2.
if ! ldconfig -p 2> /dev/null | grep -q 'libfuse\.so\.2'; then
  say "O AppImage precisa da libfuse 2, que não está instalada."
  if command -v dnf > /dev/null; then pkg=(sudo dnf install -y fuse fuse-libs)
  elif command -v apt-get > /dev/null; then pkg=(sudo apt-get install -y libfuse2)
  else pkg=(); fi
  if [[ ${#pkg[@]} -gt 0 ]] && ask "Instalar agora com: ${pkg[*]}?"; then
    "${pkg[@]}"
  else
    fail "Instale o suporte a FUSE 2 e rode este instalador de novo."
  fi
fi

# 2. Versão mais nova publicada nos Releases.
say "Procurando a versão mais nova"
release_json="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")" ||
  fail "Não foi possível consultar os Releases do GitHub."
url="$(printf '%s' "$release_json" | grep -o '"browser_download_url": *"[^"]*\.AppImage"' | head -n 1 | sed 's/.*"\(https[^"]*\)"/\1/')"
version="$(printf '%s' "$release_json" | grep -o '"tag_name": *"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')"
[[ -n "$url" ]] || fail "O Release $version não tem AppImage."

# 3. Baixa para um arquivo temporário e só então substitui (nome fixo: as atualizações e o
#    atalho continuam apontando para o mesmo arquivo).
say "Baixando o AgileBox $version"
mkdir -p "$APP_DIR"
tmp="$(mktemp "$APP_DIR/.AgileBox.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
curl -fL --progress-bar -o "$tmp" "$url" || fail "O download falhou."
chmod 755 "$tmp"
stop_running
mv -f "$tmp" "$APP"
trap - EXIT

# 4. Ícone e atalho no menu de aplicativos.
say "Criando o atalho no menu de aplicativos"
mkdir -p "$(dirname "$ICON_FILE")" "$(dirname "$DESKTOP_FILE")"
curl -fsSL -o "$ICON_FILE" "https://raw.githubusercontent.com/$REPO/HEAD/apps/desktop/resources/icon.png" ||
  say "Ícone não baixado; o atalho funciona mesmo assim."
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=AgileBox
Comment=Organização de tarefas para times de TI
Exec="$APP" --ozone-platform=x11 %U
Icon=agilebox
Terminal=false
Type=Application
Categories=Office;ProjectManagement;
StartupWMClass=agilebox-desktop
EOF
refresh_menu

say "Pronto: AgileBox $version instalado em $APP"
say "Abra pela busca de aplicativos (tecla Super → AgileBox). Atualizações: Ajustes → Atualizações."

if [[ "$LAUNCH" == 1 ]]; then
  setsid -f "$APP" --ozone-platform=x11 > /dev/null 2>&1 || true
fi
