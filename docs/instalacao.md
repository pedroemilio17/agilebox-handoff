# Guia de instalação do AgileBox

Cada sistema tem um comando de uma linha. Ele baixa a versão mais nova dos
[Releases](https://github.com/pedroemilio17/agilebox-handoff/releases), instala, cria os atalhos e
abre o app. Rodar o mesmo comando de novo atualiza para a versão mais nova. Depois da primeira
instalação, as atualizações também saem pelo próprio app, em **Ajustes → Atualizações**.

Não é preciso git, Node, pnpm nem o código-fonte.

## Linux (Fedora, Ubuntu e derivados)

Abra o Terminal e cole:

```bash
curl -fsSL https://raw.githubusercontent.com/pedroemilio17/agilebox-handoff/HEAD/scripts/install-linux.sh | bash
```

O instalador ([scripts/install-linux.sh](../scripts/install-linux.sh)):

1. Confere o suporte a FUSE. Se faltar, pergunta se pode instalar (`sudo dnf install fuse fuse-libs`
   no Fedora, `sudo apt-get install libfuse2` no Ubuntu); a senha de administrador só é pedida nesse caso.
2. Baixa o AppImage mais novo para `~/Applications/AgileBox.AppImage`. O nome é fixo, então as
   atualizações substituem o mesmo arquivo e o atalho continua funcionando.
3. Cria o ícone e o atalho no menu de aplicativos. A partir daí, abra pela tecla **Super → AgileBox**,
   sem terminal.
4. Abre o app.

Opções: `--no-launch` (não abre no fim), `--uninstall` (remove o app, o atalho e o ícone) e
`--uninstall --purge` (remove também os dados). Para passar opções pelo comando de uma linha:

```bash
curl -fsSL https://raw.githubusercontent.com/pedroemilio17/agilebox-handoff/HEAD/scripts/install-linux.sh | bash -s -- --uninstall
```

Os dados ficam em `~/.config/@agilebox/desktop`. No Linux, fechar o painel encerra o app.

## Windows 10/11

Abra o **PowerShell** (menu Iniciar → "PowerShell") e cole:

```powershell
irm https://raw.githubusercontent.com/pedroemilio17/agilebox-handoff/HEAD/scripts/install-windows.ps1 | iex
```

O instalador ([scripts/install-windows.ps1](../scripts/install-windows.ps1)):

1. Baixa o `AgileBox-<versão>-setup.exe` mais novo.
2. Fecha o AgileBox se estiver aberto (inclusive escondido perto do relógio).
3. Instala sem perguntas, só para o seu usuário (não pede administrador), em
   `%LOCALAPPDATA%\Programs\AgileBox`, com atalhos no Menu Iniciar e na Área de Trabalho.
4. Abre o app.

Para desinstalar: **Configurações → Aplicativos → AgileBox → Desinstalar**. Os dados ficam em
`%APPDATA%\@agilebox\desktop`. No Windows, o X do painel recolhe o app para o ícone perto do relógio;
para sair de verdade, clique com o botão direito no ícone e escolha **Sair**.

### Sobre o aviso de segurança

O instalador ainda não tem assinatura digital. Pelo comando acima o Windows normalmente não mostra o
SmartScreen, porque o arquivo não vem do navegador. Se você baixar o `.exe` pelo navegador, o
SmartScreen avisa: clique em **Mais informações → Executar assim mesmo**. Em PCs com o **Controle de
Aplicativos Inteligentes** ligado, o app não instala de nenhum jeito até ser assinado.

## Instalar manualmente

Se preferir, baixe o arquivo na página de Releases:

- Windows: `AgileBox-<versão>-setup.exe`, e execute.
- Linux: `AgileBox-<versão>.AppImage`, depois `chmod +x` e execute. Sem o atalho do instalador, ele
  fica preso ao terminal; use `setsid -f ./AgileBox-<versão>.AppImage` para abrir solto.

## Problemas

| Sintoma                                                  | O que fazer                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Cannot mount AppImage, please check your FUSE setup"    | Rode o instalador do Linux de novo: ele instala o FUSE se faltar. Se persistir, abra com `~/Applications/AgileBox.AppImage --appimage-extract-and-run`. |
| O comando do Windows diz que scripts estão desabilitados | Use exatamente `irm ... \| iex` (ele não grava script em disco); ou rode antes `Set-ExecutionPolicy -Scope Process Bypass`.                             |
| Abre a versão antiga                                     | Feche a antiga (no Windows, ícone perto do relógio → Sair) e abra de novo. Versões a partir da 0.2.0 fecham a antiga sozinhas.                          |
