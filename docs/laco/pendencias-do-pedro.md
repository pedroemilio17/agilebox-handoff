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
