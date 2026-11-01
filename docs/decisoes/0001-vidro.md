# 0001 · Estratégia de vidro (provisória)

## Contexto

O risco R1 do PLANO é que o Acrylic nativo cobre o retângulo inteiro da janela e pode tremer ao redimensionar a bandeja; os cantos arredondados também não são nativos. O vidro em CSS anima suavemente, mas não desfoca o desktop atrás da janela.

## Decisão provisória

Usar vidro CSS como padrão no Windows e no macOS. **No Linux a janela é opaca** (`opaque`: sem transparência nem desfoque), porque o CSS não desfoca o desktop e uma janela translúcida deixa o conteúdo de trás atrapalhar a leitura; além disso, janelas transparentes e sem moldura no Wayland podem perder a entrada de mouse. `AGILEBOX_GLASS=css` força o vidro CSS no Linux para comparar. No Windows 11, `AGILEBOX_GLASS=native` seleciona `backgroundMaterial: 'acrylic'` para permitir comparar a alternativa durante o spike. Versões do Windows anteriores à 11 permanecem em CSS.

## Consequências

A bandeja pode animar a altura sem redimensionar continuamente a janela, mas o fundo não desfoca o desktop. O modo Acrylic deve ser comparado no Windows 11 quanto a tremor, cantos e legibilidade antes de confirmar a decisão para o M9.

## Revisão

Pendente: testar `AGILEBOX_GLASS=css` e `AGILEBOX_GLASS=native` no painel e na bandeja em Windows 11 e registrar a escolha final.

## Linux com GNOME Shell + Liquid Glass (modo `compositor`)

Quando a extensão [Liquid Glass](https://github.com/ryohsuke1231/liquid-glass) está ativa no GNOME Shell, o app detecta (pela lista `enabled-extensions`) e usa o modo `compositor`: janela transparente com o visual do design (cantos de 22 px, fundo translúcido dos tokens), sem o `backdrop-filter` do CSS. O desfoque e a refração do desktop são desenhados pelo próprio GNOME Shell atrás da janela.

Na extensão, o vidro de aplicativo precisa estar ligado só para a classe `agilebox-desktop` (`enable-application-glass`, `application-glass-all-windows=false`, `application-window-whitelist=['agilebox-desktop']`), com `application-content-opacity=1.0` (texto nítido) e `application-corner-radius=22`. Sem a extensão, o Linux continua no modo `opaque`. `AGILEBOX_GLASS=css|opaque|compositor` força um modo.

## Windows 11: Acrylic por padrão; opacidade ajustável

No Windows 11 o modo padrão passou a ser `native` (`backgroundMaterial: 'acrylic'`): é o vidro do sistema, que desfoca o desktop atrás da janela (o Windows não tem a refração do Liquid Glass). A página deixa o fundo translúcido sem `backdrop-filter`, ocupa a janela inteira e deixa os cantos para o Windows. `AGILEBOX_GLASS=css` volta ao vidro em CSS; no Windows 10 o CSS continua sendo o padrão.

A opacidade do fundo da janela (`--glass-window-alpha`) é editável em **Ajustes → Aparência** (30% a 95%, padrão 68%, um pouco acima dos 50% do HANDOFF). O valor fica neste computador e vale para o painel e a bandeja. Pendente `TESTAR-NO-WINDOWS`: tremor do Acrylic ao redimensionar a bandeja (risco R1).
