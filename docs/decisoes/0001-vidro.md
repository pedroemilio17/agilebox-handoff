# 0001 · Estratégia de vidro (provisória)

## Contexto

O risco R1 do PLANO é que o Acrylic nativo cobre o retângulo inteiro da janela e pode tremer ao redimensionar a bandeja; os cantos arredondados também não são nativos. O vidro em CSS anima suavemente, mas não desfoca o desktop atrás da janela.

## Decisão provisória

Usar vidro CSS como padrão em todos os sistemas. No Windows 11, `AGILEBOX_GLASS=native` seleciona `backgroundMaterial: 'acrylic'` para permitir comparar a alternativa durante o spike. Outras plataformas e versões do Windows permanecem em CSS.

## Consequências

A bandeja pode animar a altura sem redimensionar continuamente a janela, mas o fundo não desfoca o desktop. O modo Acrylic deve ser comparado no Windows 11 quanto a tremor, cantos e legibilidade antes de confirmar a decisão para o M9.

## Revisão

Pendente: testar `AGILEBOX_GLASS=css` e `AGILEBOX_GLASS=native` no painel e na bandeja em Windows 11 e registrar a escolha final.
