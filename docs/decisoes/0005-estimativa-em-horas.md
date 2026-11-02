# 0005 · Estimativa em horas

- **Data**: 2026-11-02 (M3.3)
- **Estado**: aceito. Q2 decidida pela recomendação (divisão entre todos os envolvidos), pendente de confirmação do Pedro

## Contexto

O ADR-07 do plano 2.0 aparece como "Decidida" (estimativa em horas, que reaproveita o custo por hora que já existe nas tarefas; pontos ficam como módulo futuro), mas não havia registro em `docs/decisoes/` (D12 do PROGRESS_2).

Até o M2.11, a "estimativa" da tarefa era a soma das horas por participação. Isso mistura estimativa com horas realizadas: quem lança horas muda a estimativa, e a estimativa não pode existir antes de qualquer trabalho. Os quadros 09 e 10 separam as duas coisas (B4).

## Decisão

Decisão B4 (A), tomada pelo Pedro:

- **Campo próprio.** `Task.estimatedHours` guarda a estimativa da tarefa. Nulo significa "sem estimativa"; zero é uma estimativa válida. As horas realizadas continuam em `hoursHundredths` de cada participação. Definir ou limpar a estimativa não altera nenhuma participação, e lançar horas não altera a estimativa.
- **Unidade.** Centésimos de hora, inteiro, a mesma unidade de `hoursHundredths` e de `parseHours`. Assim o custo usa a mesma conta de `subtotal`, sem ponto flutuante.
- **Validação.** Inteiro seguro, maior ou igual a zero, até 1000 h (100000 centésimos). Passo de 0,01 h. A entrada digitada passa por `parseHours`, que arredonda no terceiro decimal (meio para cima). O domínio recusa valor fracionado em vez de arredondar em silêncio.
- **Custo estimado (Q2, recomendação adotada).** A estimativa é dividida em partes iguais entre **todos os envolvidos** da tarefa (todas as participações, usuários e entidades), tenham ou não horas realizadas. Cada parcela usa o valor/hora da própria pessoa. Assim o custo estimado só muda quando muda a estimativa ou a lista de envolvidos: lançar horas não altera o custo estimado de ninguém. Sem envolvidos, o custo estimado é nulo (inclusive para o gestor). O arredondamento acontece uma vez por parcela, meio para cima, em centavos.
  - Regra descartada no meio do caminho: dividir só entre quem já tem horas. Quem lança horas mudava o custo estimado de todos (ex.: estimativa 3 h, A com 2 h a R$ 45/h e B com 0 h a R$ 60/h: A estimava R$ 135 e B, R$ 0; depois que B lança 1 h, A cai para R$ 67,50 e B sobe para R$ 90). Isso contradiz a regra de que lançar horas não altera a estimativa.
- **Visibilidade.** Gestor vê o custo estimado e o realizado de toda a tarefa. Colaborador vê só a própria parcela ou a própria parte realizada. Quem não participa, ou é de outra organização, recebe nulo. As funções recebem o ator; quem não pode ver não recebe o cálculo. A parcela de quem vê só depende do próprio valor/hora e do número de envolvidos (contagem, não valores alheios).
- **Quem edita.** `canEditEstimate` segue `canEditTask`: quem edita a tarefa define a estimativa, e o gestor também (edição marcada como Gestor).

## Consequências

- Tarefas existentes nascem sem estimativa (`null`). A soma das horas não é convertida em estimativa, porque não há como saber a intenção de quem lançou.
- A persistência (M3.9) precisa de uma coluna `estimated_hours` (inteiro, nulo) em `tasks`, e o mapper precisa ler e gravar o campo.
- O quadro 09 ("40 h estimadas") e o quadro 10 passam a ler este campo. O cartão "Estimativa" do M2.11 deixa de mostrar a soma (D13, M3.13).
- **Arredondamento.** Cada parcela é arredondada para o centavo (meio para cima). Por isso a soma das parcelas pode diferir de `estimativa × taxa` em até `n/2` centavos, em que `n` é o número de envolvidos. Exemplo: 1 h entre 3 pessoas a R$ 40/h dá parcelas de R$ 13,33; soma R$ 39,99, contra R$ 40,00 exatos (diferença de 1 centavo, dentro de `3/2`). A exibição deve mostrar o total somado das parcelas, não recalcular a partir da estimativa. Não se corrige com resto distribuído, para não mudar a parcela de uma pessoa por causa de outra.
- A regra do custo estimado (Q2) está em `rules/estimate-cost.ts`. Se o Pedro escolher outra regra, troca-se só esse arquivo e este ADR.
- O valor/hora de exemplo do quadro (cerca de R$ 65/h, D8) não define nada aqui; é dado de demonstração.
- A dependência entre Sprints e estimativa para capacidade (pergunta aberta para o M4) não muda com este ADR.

## Alternativa descartada (B)

**Manter a estimativa como soma das horas por participação.** Não exige coluna nova nem migração, mas mantém a mistura entre estimativa e realizado: a estimativa muda a cada lançamento de hora, e o custo "estimado" passa a ser o custo real. Descartada, porque contraria ADR-07 e os quadros 09 e 10.

## Pendências para o Pedro

- **Q2. Decidida pela recomendação, pendente de confirmação.** Divisão igual entre todos os envolvidos, cada um com o próprio valor/hora. Alternativa: usar o valor/hora do responsável para toda a estimativa. Confirmar ou trocar.
- **Teto de 1000 h** por tarefa: confirmar o valor.
