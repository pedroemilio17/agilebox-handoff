# Protótipos v2

Referência visual do redesign. **Não é código para reaproveitar**: o formato (`<x-dc>`, `<sc-for>`,
`<sc-if>`, `DCLogic`) só roda no editor de design. Leia o CSS e o markup para extrair medidas, cores
e comportamento, e reimplemente nos componentes de `packages/ui` e nas telas de `apps/desktop`.

O CSS está quase todo inline por causa do editor. **Não copie estilos inline**: tudo vira token
(`tokens-v2.css`) e CSS Module.

| Arquivo | Tela | Seção do HANDOFF-v2 |
| --- | --- | --- |
| `SistemaVisual.dc.html` | Paleta, tipografia, sinais, componentes base | 2 e 3 |
| `Bandeja.dc.html` | Bandeja; o daily e o aviso de commit são fase C | 4.7 |
| `Quadro.dc.html` | Quadro + detalhe em painel lateral | 4.2 e 4.3 |
| `Dashboard.dc.html` | Dashboard do gestor | 4.4 |
| `Agenda.dc.html` | Agenda semanal | 4.5 |
| `Comandos.dc.html` | Paleta `Ctrl K` | 4.6 |

Os dados nos protótipos são de exemplo (Colaboradores 2 a 4, Projetos A a C), coerentes com o seed.
Alguns elementos dependem das fases B e C: confira `docs/REDESIGN-v2-ESCOPO.md` antes de implementar.
