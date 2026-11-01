# Instalador do AgileBox

Cada instalador é gerado **no sistema de destino**, porque o `better-sqlite3` é um módulo nativo.
A configuração está em `apps/desktop/electron-builder.yml`; a saída vai para `release/` (fora do git).

## Windows (NSIS)

```bash
pnpm install
pnpm --filter @agilebox/desktop dist:win
```

Gera `release/AgileBox-<versão>-setup.exe`: instalação por usuário, com escolha da pasta e atalhos.
Os dados ficam em `%APPDATA%\AgileBox`. O app **não** inicia junto com o Windows (PLANO 12.7).
O instalador não é assinado: o SmartScreen avisa na primeira execução ("Mais informações → Executar assim mesmo").

## Linux (AppImage, testado no Fedora)

```bash
pnpm install
pnpm --filter @agilebox/desktop dist:linux
chmod +x release/AgileBox-<versão>.AppImage
./release/AgileBox-<versão>.AppImage
```

- O AppImage não precisa de instalação nem de `sudo`. Se o Fedora reclamar de FUSE: `sudo dnf install fuse fuse-libs`.
- Os dados ficam em `~/.config/AgileBox`.
- No Linux o app reinicia uma vez com `--ozone-platform=x11` (a bandeja precisa posicionar a própria janela, o que o Wayland não permite). `AGILEBOX_WAYLAND=1` mantém o Wayland.
- Fechar o painel encerra o app (o ícone de bandeja do GNOME depende da extensão AppIndicator).

## Testar sem gerar o instalador

```bash
pnpm --filter @agilebox/desktop pack
```

Gera a pasta `release/linux-unpacked` (ou `win-unpacked`), que roda direto (no Linux, com `--no-sandbox`).

## Primeira execução

Ainda não há cadastro nem login: ao abrir pela primeira vez o app cria o banco com **dados de demonstração**
(Marta, a gestora, e outros perfis, trocados pela Conta). Isso é uma `DECISÃO PROVISÓRIA` até o login existir.
