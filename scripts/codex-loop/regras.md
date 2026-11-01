## Regras do laço

Você roda sem ninguém para responder perguntas. O script `scripts/codex-loop/run.sh` chama você, instala dependências, roda as verificações, documenta e faz o commit. Seu trabalho é **um passo por rodada**, bem feito e bem anotado.

### Fontes da verdade (nesta ordem)

1. `PROGRESS.md`: o passo desta rodada. Faça só ele.
2. `docs/PLANO.md`: arquitetura, modelo de dados, regras de acesso, contrato da API, estrutura de arquivos. **Siga à risca.**
3. `docs/HANDOFF.md`: visual e comportamento (telas e componentes).
4. `docs/MVP.md` e `CLAUDE.md`: escopo e regras de produto.
5. `design/*.dc.html`: protótipos, **só referência visual** (medidas, cores, markup). Nunca copie o formato `DCLogic`/`<x-dc>`.

Se divergirem, vale a ordem acima. Registre a divergência nas notas do passo.

### Fluxo da rodada

1. Leia o passo e as seções do `PLANO.md` que ele cita. Se existir `.loop/last-failure.log`, a rodada anterior falhou: corrija isso primeiro.
2. Em `packages/core` e `packages/application`, escreva os **testes primeiro** (nomes em pt-BR, descrevendo a regra) e depois a implementação.
3. Faça só o necessário para o passo. Não adiante passos futuros nem refatore o que não foi pedido.
4. Rode `pnpm check` (formatação, lint, tipos, testes e, quando existir, build) até ficar verde. `pnpm format` corrige formatação.
5. Anote (ver "Documentação") e escreva o status.

### Verificações

Não desligue regras de lint. Proibido: `// @ts-ignore`, `any`, `eslint-disable`, `.skip`, `.only`, e baixar limites de cobertura.

### Dependências (a rede está bloqueada para você)

Não rode `pnpm install`, `pnpm add`, `npm` nem `npx` de pacote não instalado. Se precisar de pacote novo, escreva em `.loop/deps.txt`, uma linha por pacote:

```
<alvo> <dev|prod> <pacote>
```

`<alvo>` é `root` ou o nome do workspace (ex.: `@agilebox/core`). Sem versão. Depois escreva `NEEDS_DEPS` em `.loop/status` e **encerre a rodada**; o script instala e chama você de novo no mesmo passo. Dependências internas (`"@agilebox/core": "workspace:*"`) você mesmo escreve no `package.json`.

### Status (`.loop/status`, uma palavra)

- `DONE`: passo concluído e `pnpm check` verde.
- `NEEDS_DEPS`: precisa de pacotes (acima).
- `BLOCKED`: não dá para seguir sem o Pedro. Explique em `.loop/blocked.md` (o que tentou, o que impede, opções com prós e contras). Use para decisão de produto **não definida** nos documentos ou para falha que você não resolve. Nunca invente requisito para destravar.

### Documentação (obrigatória, o laço vai até o fim sem parar)

- **Notas do passo**: no máximo 5 linhas `  - Nota: …` embaixo do passo no `PROGRESS.md`, com decisões, divergências e pendências. Não marque o checkbox (o script marca).
- **`docs/laco/pendencias-do-pedro.md`**: acrescente uma linha por item que só o Pedro pode resolver, no formato
  `- [ ] <passo> · <TIPO>: <texto objetivo>`, com TIPO em `CONFERIR` (revisão visual ou de regra), `TESTAR-NO-WINDOWS`, `RODAR-E2E` ou `DECIDIR`. Seja específico (o que abrir, o que clicar, o que esperar).
- **Decisões provisórias**: a seção 12 do `PLANO.md` traz propostas. Siga a proposta e registre `DECISÃO PROVISÓRIA` em `pendencias-do-pedro.md` com o item (ex.: 12.2) e a alternativa.
- **Decisões técnicas relevantes** (escolha de biblioteca, estratégia): `docs/decisoes/NNNN-nome.md`, curto (contexto, decisão, consequências).
- **Não edite** `docs/laco/diario.md`, `docs/laco/relatorio-*.md`, `docs/laco/ocorrencias.md` nem `docs/laco/RESUMO-FINAL.md`: o script escreve.

### Proibido

- Rodar `git` (o script comita). Apagar ou reescrever histórico.
- Editar `docs/PLANO.md`, `docs/HANDOFF.md`, `docs/MVP.md`, `design/`, `scripts/codex-loop/`. Exceção: o passo pedir.
- Mudar decisões das seções 1 e 2 do `PLANO.md`.
- Implementar o "Fora do MVP" do `CLAUDE.md` (plug-ins, aviso diário, **tela** da visão Equipe, IA, login, servidor).
- Furar as fronteiras entre camadas (tabela 3.1; o lint garante).
- SQL fora de `packages/infra-sqlite`; consulta sem `organization_id`.
- Abrir o Electron ou qualquer janela (não há tela). Veja "Telas" abaixo.

### Telas (a partir do M5)

- Você não enxerga a interface. Leia `docs/HANDOFF.md` **e o CSS/markup** de `design/Painel.dc.html` e `design/Bandeja.dc.html` para medidas, cores e estados, e reimplemente com tokens do `packages/ui` (nunca valores soltos).
- Textos da interface ficam em `copy.ts` por tela (pt-BR). Acessibilidade do HANDOFF (papéis ARIA, foco, teclado, alvos de 44 px, `prefers-reduced-motion`) é requisito, e tem teste.
- Testes de componente rodam em jsdom (Testing Library). Código que usa a API do Electron fica em arquivos finos (`index.ts`, `windows/*`, `tray/*`); a lógica fica em módulos puros, que têm teste.
- `pnpm --filter @agilebox/desktop build` roda sem tela e pode ser usado. Testes de ponta a ponta (Playwright) **você escreve, mas não executa**: eles ficam fora do `pnpm check` (script `test:e2e`) e entram em `pendencias-do-pedro.md` como `RODAR-E2E`.
- Tudo que depende de olhar a tela ou de rodar no Windows vira pendência `CONFERIR` ou `TESTAR-NO-WINDOWS`. Não bloqueie o laço por isso.

### Regras de produto que não podem se perder

- Estados, nesta ordem: Planejamento, A fazer, Desenvolvendo, Revisar, Concluído (`planning`, `todo`, `in_progress`, `review`, `done`).
- Toda edição de tarefa gera evento na linha do tempo, na **mesma transação**. Edição de gestor: **sempre** `as_manager = true`.
- "Participa" = criou a tarefa **ou** tem envolvimento de **usuário** (Responsável ou Apoio). Entidades (stakeholders) **nunca** dão acesso.
- Colaborador: "Minhas tarefas" = só as que participa; o resto dos projetos dele é visão Equipe (somente leitura; só API no MVP). Gestor: tudo.
- Valor/hora: gestor vê e edita todos; usuário vê e edita só o próprio; total em R$ só para o gestor. O filtro acontece no **mapper da aplicação**, nunca só na tela.
- Custo = Σ (horas × valor/hora). Dinheiro em centavos, horas em centésimos, entrada com vírgula.
- Tudo dentro da organização do ator (`organization_id`).

### Convenções

- Código e identificadores em inglês; textos da interface e nomes de testes em pt-BR.
- TypeScript `strict`, ESM, sem `any`. Arquivos `kebab-case.ts`, componentes `PascalCase.tsx`, testes ao lado (`*.test.ts`).
- Injeção de dependência manual: dependências entram por construtor ou fábrica; sem singletons globais nem containers. "Hoje" sempre via `Clock`; IDs sempre via `IdGenerator`.
- Comentários só onde a regra não é óbvia; cite a seção do `PLANO.md` quando ajudar (`// PLANO 2.4`).
