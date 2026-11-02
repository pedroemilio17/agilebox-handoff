# AgileBox · pacote do redesign v2

Pacote para levar o redesign ao repositório `agilebox-handoff`. As pastas já seguem a estrutura do repo:
é só copiar o conteúdo para a raiz.

```
docs/HANDOFF-v2.md                       especificação visual e de comportamento, tela por tela
docs/REDESIGN-v2-ESCOPO.md               fases A/B/C, regras derivadas e decisões pendentes (D0–D8)
docs/decisoes/0004-direcao-visual-v2.md  ADR proposto (vidro, cor, fontes)
packages/ui/src/styles/tokens-v2.css     tokens novos, com os mesmos nomes dos atuais
design/v2/*.dc.html                      os 6 protótipos (referência visual, não código)
design/v2/README.md                      mapa protótipo → seção do handoff
```

Nada aqui substitui arquivos existentes: `tokens.css`, `HANDOFF.md` e os protótipos v1 continuam
como estão até você aprovar o ADR 0004.

## Como usar

1. Copie as pastas para a raiz do repositório e faça um commit (por exemplo, `docs: pacote do redesign v2`).
2. Leia `docs/REDESIGN-v2-ESCOPO.md` e responda às decisões **D0 a D8**. Pode ser em linhas curtas no
   próprio arquivo.
3. Abra o Claude Code na raiz do repo e cole o prompt abaixo.

## Prompt para o Claude Code

```
Vamos começar o redesign v2 do AgileBox.

Leia, nesta ordem: CLAUDE.md, docs/REDESIGN-v2-ESCOPO.md, docs/decisoes/0004-direcao-visual-v2.md,
docs/HANDOFF-v2.md e design/v2/README.md. Consulte os protótipos de design/v2/ só como referência
visual: não copie o markup nem os estilos inline.

Escopo agora: apenas a FASE A. Não implemente nada das fases B e C.
Minhas respostas às decisões D0–D8 estão no fim do REDESIGN-v2-ESCOPO.md.

Antes de escrever código:
1. Compare o tokens-v2.css com o tokens.css atual e liste os componentes de packages/ui e as telas
   de apps/desktop que serão afetados.
2. Proponha os itens da fase A como um novo marco (M11) no formato do PROGRESS.md, com critério de
   pronto e testes de cada item.
3. Aponte qualquer conflito com o PLANO.md ou com decisões já registradas.

Espere minha confirmação. Depois, implemente um item por vez, rodando `pnpm check` ao final de cada
um e parando para eu conferir no app.
```

Se preferir seguir pelo laço do Codex, use o passo 2 do prompt com o Claude Code para gerar o M11 no
`PROGRESS.md` e depois rode o laço normalmente.
