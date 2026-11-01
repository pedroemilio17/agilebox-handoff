# Pendências do Pedro

O Codex acrescenta uma linha por item, no formato `- [ ] <passo> · <TIPO>: <texto>`.
Tipos: `CONFERIR`, `TESTAR-NO-WINDOWS`, `RODAR-E2E`, `DECIDIR`.

- [ ] M1 · CONFERIR: abrir `tooling/layers.js` e confirmar que as fronteiras entre camadas refletem a tabela 3.1 do PLANO.
- [ ] M2.9 · CONFERIR: ler os testes de `access-policy` (matriz de acesso, PLANO 6.1) e confirmar que cada linha reflete a regra desejada.
- [ ] M3.4 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.5) — a agenda aceita participantes usuários conforme o modelo da seção 5; confirmar se entidades sem conta também devem poder participar antes do M8.
- [ ] M3.14 · DECIDIR: DECISÃO PROVISÓRIA (PLANO 12.4) — a tabela do dashboard inclui o gestor quando ele tiver tarefas; confirmar essa regra antes do M7 (alternativa: exibir somente colaboradores).
- [x] M3.10 · DECIDIR: tarifa inicial de entidade. **Decidido:** valor padrão 0 = "não definido"; criação só com nome (PLANO 6.2).
- [ ] M4.8 · TESTAR-NO-WINDOWS: executar `pnpm native:electron` e depois `pnpm native:node` no Windows; confirmar que ambas as recompilações terminam e que a aplicação/testes carregam o addon no ABI correspondente.
- [ ] M5.2 · CONFERIR: abrir painel e bandeja e comparar com `design/Painel.dc.html` e `design/Bandeja.dc.html`; conferir fonte Inter, foco azul com offset, scrollbar de 3 px, fallback de vidro e animações reduzidas pelo sistema.
- [ ] M5.2 · TESTAR-NO-WINDOWS: abrir o app sem rede no Windows 11 e confirmar que a fonte Inter local carrega e que vidro e foco continuam legíveis com movimento reduzido ativo.
- [ ] M5.3 · CONFERIR: quando a galeria M5.6 estiver disponível, comparar GlassSurface, Button, IconButton, Avatar, StatusChip, Skeleton, ReadOnlyBadge e EmptyState com o HANDOFF; conferir variantes, contraste e alvos de toque.
- [ ] M5.4 · CONFERIR: quando a galeria M5.6 estiver disponível, comparar SegmentedControl, GroupedList/FieldRow e campos de texto, data e número com o HANDOFF; conferir deslize, separadores, rótulos, foco e alvos de toque.
- [ ] M5.5 · CONFERIR: Na galeria M5.6, conferir StatusMenu (largura e itens), Modal (foco/fechamento), Toast (posição e duração), Tooltip e WindowControls (alvos de 40×44 px) contra o HANDOFF.
- [ ] M5.6 · CONFERIR: quando o painel estiver disponível em desenvolvimento, abrir com `?gallery` e comparar todas as seções/estados da galeria com `design/Painel.dc.html` e as medidas/cores do HANDOFF; confirmar que sem o parâmetro a galeria não aparece.
- [ ] M5.10 · TESTAR-NO-WINDOWS: no Windows 11, abrir o app uma vez com `AGILEBOX_GLASS=css` e outra com `AGILEBOX_GLASS=native`; comparar bandeja e painel quanto a desfoque, cantos e tremor ao abrir/redimensionar a bandeja e registrar a escolha final em `docs/decisoes/0001-vidro.md`.
- [ ] M5.10 · DECIDIR: DECISÃO PROVISÓRIA deste passo — manter CSS como padrão e Acrylic opt-in via `AGILEBOX_GLASS=native`; após o teste no Windows, confirmar ou escolher Acrylic como padrão.
- [ ] M5.11 · CONFERIR: rodar `pnpm dev` e confirmar que o painel lista as tarefas do seed; quando a edição da bandeja existir no M9, editar uma tarefa nela e confirmar que o painel atualiza sem recarregar.
