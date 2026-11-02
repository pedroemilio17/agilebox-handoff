# 0004 · Direção visual v2 (proposta, aguardando o Pedro)

## Contexto

Com o MVP rodando, o Pedro achou o app básico, limitado e com layout feio. O diagnóstico: todas as
superfícies usam o mesmo vidro cinza com o mesmo peso, então não há hierarquia; as cores de estado
saturadas competem entre si e com o botão primário; e o vermelho é usado para "Gestor", que não é alarme.

Referências estudadas (galeria Refero Styles): Linear (estrutura, bordas finas, mono para IDs),
Raycast (sensação de ferramenta de desktop), Superlist (fundo escuro quente, um acento só) e
AuthKit (como fazer vidro sem virar lama cinza).

## Decisão proposta

1. **Vidro só no que flutua ou no que é "material da janela"**: janela da bandeja, barra lateral do painel
   (como a barra lateral do macOS), painel de detalhe, paleta de comandos, menus e modais.
   A área de conteúdo do painel e os cartões ficam **sólidos**, em três degraus (`--surface-*`).
   Os modos de janela do ADR 0001 (`native`, `compositor`, `css`, `opaque`) não mudam: a barra lateral
   usa `--color-rail-bg` translúcido e mostra o Acrylic ou o Liquid Glass; no modo `opaque`, ela fica sólida.
2. **Uma única cor de ação** (lima `#c8f03c`, texto escuro sobre ela). Estados viram pontos dessaturados.
   Vermelho e âmbar ficam reservados para sinais (bloqueada, vencida, parada, limite de WIP).
   Gestor passa a ser violeta neutro.
3. **Três famílias de fonte**: Bricolage Grotesque (títulos e números grandes), Geist (interface) e
   Geist Mono (IDs, horários, métricas, teclas), empacotadas com `@fontsource-variable` (offline).
   Inter e SF Pro deixam de ser usadas.
4. Interface um pouco mais densa: corpo 14 px (era 15), raios menores em botões e chips.

## Consequências

- `tokens.css` é substituído por `tokens-v2.css`, com os mesmos nomes (o teste de tokens continua valendo)
  e tokens novos. O botão primário precisa trocar a cor do texto.
- O HANDOFF v1 continua valendo para comportamento (bandeja, redimensionar, movimento de janela).
  O visual passa a seguir o `docs/HANDOFF-v2.md`.
- Dependências novas: três pacotes de fonte (e, se aprovado, `lucide-react`).
- Risco: a cor de ação clara pode cansar em telas grandes. Mitigação: ela aparece em no máximo um
  elemento grande por tela; a cor fica num token só e é fácil trocar (o protótipo testa coral, violeta e turquesa).

## Revisão

Pendente: aprovação do Pedro (decisão D0 em `docs/REDESIGN-v2-ESCOPO.md`). Depois de implementado,
conferir no Windows 11 (Acrylic) e no Fedora com e sem Liquid Glass se a barra lateral translúcida
continua legível.
