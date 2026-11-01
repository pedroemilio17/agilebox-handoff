# AgileBox

Organização de tarefas para times de TI, pensada para ser usada com o mínimo de atrito: cada pessoa
vê só o que precisa, atualiza uma tarefa em poucos toques e ninguém fica preso a permissões
desnecessárias.

São dois aplicativos de desktop (Windows e Linux) que compartilham os mesmos dados:

- **Painel**: barra lateral, quadro kanban por projeto, detalhe da tarefa, dashboard do gestor,
  agenda e ajustes.
- **Bandeja**: janela pequena no canto da tela para buscar, atualizar ou criar tarefas rapidamente.

Hoje os dados ficam num banco SQLite local, um por computador. Na primeira execução o app cria
**dados de demonstração** (Marta é a gestora; os demais perfis são colaboradores). A troca de perfil
fica em **Conta**, na base da barra lateral, enquanto não existe login.

## Instalar

Baixe o instalador na página de
[Releases](https://github.com/pedroemilio17/agilebox-handoff/releases). Não é preciso git, Node nem
o código.

| Sistema                   | Arquivo                       | Como abrir                                                       |
| ------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| Windows 10/11             | `AgileBox-<versão>-setup.exe` | Execute e siga o instalador (instala só para o seu usuário).     |
| Linux (testado no Fedora) | `AgileBox-<versão>.AppImage`  | `chmod +x AgileBox-*.AppImage` e depois `./AgileBox-*.AppImage`. |

> **Aviso de segurança no Windows.** O instalador ainda não tem assinatura digital. Na primeira vez o
> SmartScreen mostra "O Windows protegeu o computador": clique em **Mais informações → Executar assim
> mesmo**. Em PCs com o **Controle de Aplicativos Inteligentes** ligado ele não instala; nesse caso, use
> o caminho de desenvolvimento (abaixo) ou espere a versão assinada.

No Linux, se o AppImage reclamar de FUSE: `sudo dnf install fuse fuse-libs`.

## Usar

- **Abrir e fechar**
  - **Windows**: o X do painel **recolhe o app para o ícone perto do relógio**, e ele continua
    rodando. Para sair de verdade, clique com o botão direito no ícone e escolha **Sair**.
  - **Linux**: o X encerra o app, porque o ícone de bandeja do GNOME depende da extensão AppIndicator.
- **Bandeja**: abre pelo botão ↙ do painel ou pelo ícone. ↗ volta ao painel. A barrinha do topo
  ajusta a altura (setas, Home ou duplo clique voltam ao automático).
- **Quadro**: arraste o card por qualquer ponto para mudar o estado. Pelo teclado, use o botão ⠿ do
  card ou o seletor de estado que aparece no foco.
- **Ajustes**
  - **Aparência**:
    - **Translúcido** usa o vidro do sistema: Acrylic no Windows 11, Liquid Glass no GNOME.
    - **Opaco** usa um fundo sólido.
    - A **opacidade** do fundo vale só no modo translúcido.
  - **Atualizações**: **Procurar atualizações → Baixar e instalar → Reiniciar agora**. Tudo é
    baixado e montado com o app aberto; no fim é só reiniciar.

### Vidro no Linux (GNOME + Liquid Glass)

Com a extensão [Liquid Glass](https://github.com/ryohsuke1231/liquid-glass) ativa, o AgileBox detecta
e passa a usar o vidro desenhado pelo GNOME Shell. Na extensão, ligue o vidro de aplicativo só para a
classe `agilebox-desktop`, com opacidade do conteúdo em `1.0` e cantos de `22`. Os detalhes estão em
[docs/decisoes/0001-vidro.md](docs/decisoes/0001-vidro.md). Sem a extensão, o Linux usa o fundo opaco.

## Lançar uma versão

Os instaladores são gerados pelo GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml))
quando você cria uma tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Em cerca de 10 minutos o Release aparece com o `.exe`, o `.AppImage` e os arquivos `latest*.yml` que
o app instalado usa para se atualizar. A versão vem da tag (`v0.2.0` → `0.2.0`). Acompanhe em
**Actions** no GitHub. Se uma verificação falhar, o Release não é publicado.

Para gerar os instaladores no próprio PC, veja [docs/instalador.md](docs/instalador.md).

## Desenvolver

### Requisitos

- **Node.js 24** (mínimo 22) e **pnpm 12** (`npm install -g pnpm`)
- **git**
- Linux: `gcc`, `make` e `python3`, caso o `better-sqlite3` precise compilar.
- Windows: só se a instalação falhar compilando o `better-sqlite3`, instale o **Visual Studio Build
  Tools** com "Desenvolvimento para desktop com C++".

No Windows, clone numa pasta **sem espaços nem acentos** (por exemplo, `C:\dev\agilebox`); o
`node-gyp` falha com espaços no caminho.

### Comandos (sempre na raiz do projeto)

| Comando                                                   | O que faz                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm install`                                            | Instala as dependências.                                                                    |
| `pnpm dev`                                                | Abre o painel e a bandeja em desenvolvimento.                                               |
| `pnpm check`                                              | Formatação, lint, tipos, testes e build, nessa ordem. Rode antes de dar algo por concluído. |
| `pnpm test` / `pnpm test:watch` / `pnpm coverage`         | Testes (Vitest).                                                                            |
| `pnpm format`                                             | Aplica o Prettier.                                                                          |
| `pnpm --filter @agilebox/desktop run pack:dir`            | Gera o app sem instalador em `release/win-unpacked` ou `release/linux-unpacked`.            |
| `pnpm --filter @agilebox/desktop dist:win` / `dist:linux` | Gera o instalador no próprio PC.                                                            |
| `node scripts/make-icons.mjs`                             | Regera os ícones em `apps/desktop/resources/`.                                              |

> Use sempre `run pack:dir`. O `pnpm ... pack`, sem `run`, chama o comando embutido do pnpm (que
> gera um `.tgz`) e não reconstrói o app.

### Variáveis de ambiente

| Variável                                         | Efeito                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `AGILEBOX_GLASS=css\|native\|opaque\|compositor` | Força um modo de vidro (vence a escolha em Ajustes).                                         |
| `AGILEBOX_WAYLAND=1`                             | Mantém o Wayland no Linux. Por padrão o app usa X11, para a bandeja conseguir se posicionar. |

### Arquitetura em uma linha

Monorepo pnpm com Clean Architecture: `packages/core` (domínio e regras), `packages/application`
(casos de uso), `packages/contract` (contrato zod da API), `packages/infra-sqlite` (SQLite + Drizzle),
`packages/ui` (componentes e tokens) e `apps/desktop` (Electron + React). As fronteiras entre camadas
são verificadas pelo lint.

## Problemas comuns

| Sintoma                                          | Causa e solução                                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abro a versão nova e aparece a antiga            | Versões anteriores à substituição automática ficam abertas na bandeja. Encerre: `taskkill /IM AgileBox.exe /F` e `taskkill /IM electron.exe /F` (Windows). Versões atuais fecham a antiga sozinhas. |
| `EPERM` ao gerar o app no Windows                | O app em `release\win-unpacked` está aberto, ou o antivírus/OneDrive travou os arquivos. Encerre o app, apague `release\win-unpacked` e gere de novo.                                               |
| `No projects matched the filters`                | O comando rodou fora da raiz do projeto (a pasta com `pnpm-workspace.yaml`).                                                                                                                        |
| `pnpm dev` não abre janela (terminal do VS Code) | O VS Code define `ELECTRON_RUN_AS_NODE=1`. O `pnpm dev` já remove essa variável; se rodar o Electron direto, remova-a antes.                                                                        |
| Atualizar recusa ("arquivos alterados")          | Há mudanças locais não commitadas no clone. Commite ou descarte (`git reset --hard origin/<branch>`).                                                                                               |
| Fundo cinza sem desfoque no Windows              | Precisa do Windows 11 22H2 ou mais novo para o Acrylic. No Windows 10 o vidro é só em CSS.                                                                                                          |

## Documentação

- [docs/MVP.md](docs/MVP.md): escopo do MVP e decisões tomadas.
- [docs/PLANO.md](docs/PLANO.md): stack, arquitetura, modelo de dados, regras de acesso e marcos.
- [docs/HANDOFF.md](docs/HANDOFF.md): especificação visual e de comportamento.
- [docs/decisoes/](docs/decisoes/): decisões técnicas (vidro, módulo nativo, TypeScript).
- [docs/instalador.md](docs/instalador.md): detalhes dos instaladores.
- [PROGRESS.md](PROGRESS.md) e [docs/laco/](docs/laco/): andamento dos marcos e pendências de conferência.
- `design/`: protótipos de referência visual (não são código reaproveitável).
