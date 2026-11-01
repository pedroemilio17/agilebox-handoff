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
