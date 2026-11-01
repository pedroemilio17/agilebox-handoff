# 0002 · ABI do better-sqlite3

## Contexto

Vitest executa em Node, enquanto a aplicação desktop executará dentro do Electron; ambos compartilham o `node_modules` hoisted e o addon nativo do better-sqlite3 só carrega no ABI em que foi compilado.

## Decisão

`scripts/ensure-native.mjs` tenta carregar o addon no alvo solicitado e só reconstrói quando detecta incompatibilidade de `NODE_MODULE_VERSION`. `native:node` usa `npm rebuild better-sqlite3`; `native:electron` usa `@electron/rebuild`. O script `test` verifica Node antes do Vitest. Os scripts `dev` e `build` do desktop deverão chamar `native:electron` quando forem criados no M5.1. Se o addon ou o Electron ainda não estiver instalado, a verificação termina sem erro.

## Consequências

O único binário nativo compartilhado precisa ser recompilado ao alternar entre testes e execução do Electron, adicionando o tempo de compilação na primeira execução de cada alvo. Manter instalações separadas de dependências para Node e Electron evitaria a alternância, mas duplicaria dependências e exigiria mais configuração; por ora seguimos com o diretório hoisted definido no plano.
