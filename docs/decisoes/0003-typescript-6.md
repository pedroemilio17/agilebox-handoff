# 0003 · TypeScript fixado na linha 6.0

- **Data**: 2026-10-31 (registrado na revisão do M1)
- **Estado**: aceito, a revisitar

## Contexto

O passo M1.2 instalou a versão mais recente do TypeScript (7.0.2). No M1.5 o `typescript-eslint` 8.72.1 se recusou a carregar com ela: declara suporte a `>=4.8.4 <6.1.0`. As regras com informação de tipos (`recommendedTypeChecked`) são parte do critério de pronto do M1 e das fronteiras entre camadas.

## Decisão

Fixar `typescript` em `~6.0.3` na raiz (`package.json`). Não trocamos de linter nem desligamos as regras com tipos.

## Consequências

- Todo o monorepo usa o mesmo compilador (a versão do workspace); não há pacote com versão própria.
- Se um pacote novo exigir recursos exclusivos do 7.x, esta decisão volta à mesa.

## Quando revisitar

Quando uma versão do `typescript-eslint` declarar suporte ao TypeScript 7: subir `typescript` para `^7`, rodar `pnpm check` e atualizar este registro.
