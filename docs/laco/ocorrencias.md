# Ocorrências do laço

Bloqueios, falhas e paradas, em ordem de data.

## 2026-10-31 23:19 · M3.10 Casos de uso: entidades

O Codex bloqueou o passo. As mudanças da rodada ficaram sem commit.

**Motivo informado pelo Codex:**

> # M3.10 bloqueado: tarifa inicial de entidade
>
> Implementei e validei a listagem de entidades da organização e a alteração da tarifa padrão somente pelo gestor. A criação não pode ser concluída sem decidir a tarifa inicial: `createContributor` exige um valor positivo, enquanto `createContributorInputSchema` recebe somente o nome. Nenhum documento define o valor inicial.
>
> Opções para decisão:
>
> 1. Incluir a tarifa na entrada da criação. O gestor informa o valor correto no momento da criação; exige ajustar o contrato e a interface futura.
> 2. Definir uma tarifa padrão fixa, por exemplo R$ 45/h conforme aparece nos dados de demonstração. A criação fica simples, mas esse valor passa a ser regra de produto e pode não refletir cada entidade.
>
> `pnpm check` passou para o trabalho implementado: 36 arquivos de teste, 598 testes.

## 2026-11-01 00:08 · M4.1 Cliente e configuração

O script terminou com erro inesperado (código 1): linha 136: pnpm --filter "$target" add "${flags[@]}" "${pkgs[@]}".

## 2026-11-01 02:10 · Marco M5

A cobertura mínima do marco não foi atingida (ou o comando falhou).

**Final da última verificação que falhou:**

```

[41m[1m FAIL [22m[49m [30m[46m tooling [49m[39m eslint-boundaries.test.ts[2m > [22mmantém as regras com informação de tipos nos arquivos reais
[31m[1mError[22m: Test timed out in 15000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".[39m
[36m [2m❯[22m eslint-boundaries.test.ts:[2m9:1[22m[39m
    [90m  7|[39m const eslint = new ESLint({ overrideConfig: [tseslint.configs.disableT…
    [90m  8|[39m
    [90m  9|[39m test('mantém as regras com informação de tipos nos arquivos reais', as…
    [90m   |[39m [31m^[39m
    [90m 10|[39m   const results = await new ESLint().lintText('Promise.resolve(1)', {
    [90m 11|[39m     filePath: 'packages/core/src/index.ts',

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m


[2m Test Files [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m85 passed[39m[22m[90m (86)[39m
[2m      Tests [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m709 passed[39m[22m[90m (710)[39m
[2m   Start at [22m 02:10:00
[2m   Duration [22m 37.98s[2m (environment 36%, tests 24%, import 19%, transform 8%, setup 8%, worker 4%)[22m

[2mEnvironment [22m [30m[45m ui [49m[39m [33mjsdom was created 20 times[39m[2m · 46.94s total, 63% of tracked time[22m
[2m            [22m [2mcreate it once per worker with [22m[33mpool: 'vmThreads'[39m[2m (keeps per-file isolation) or [22m[33misolate: false[39m[2m (shares it across files)[22m
[2m            [22m [2mlearn more: https://vitest.dev/guide/improving-performance#test-environments[22m

[ELIFECYCLE] Command failed with exit code 1.
```
