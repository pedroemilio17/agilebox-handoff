# Registro do laço

Tudo o que o laço do Codex faz fica documentado aqui e no git. Nada depende da memória de ninguém.

| Arquivo                  | Quem escreve | Conteúdo                                                                  |
| ------------------------ | ------------ | ------------------------------------------------------------------------- |
| `diario.md`              | script       | uma entrada por passo concluído: data, arquivos, resumo do Codex          |
| `relatorio-<marco>.md`   | script       | por marco: commits, testes, cobertura, dependências, notas, como desfazer |
| `ocorrencias.md`         | script       | bloqueios, falhas e paradas, com o motivo                                 |
| `RESUMO-FINAL.md`        | script       | quando acabam os passos: marcos e pendências                              |
| `pendencias-do-pedro.md` | Codex        | o que só o Pedro pode conferir, testar ou decidir                         |

Fora desta pasta: `PROGRESS.md` (passos e notas), `docs/decisoes/` (decisões técnicas) e as tags git `marco-M2`, `marco-M3`…

## Como ler depois de uma execução

1. `RESUMO-FINAL.md` (ou o último `relatorio-*.md`) para o panorama.
2. `pendencias-do-pedro.md`: lista de verificação. Marque `[x]` o que conferir.
3. `ocorrencias.md`, se o laço parou antes do fim.
4. `git log --oneline` e `git diff marco-M2 marco-M3` para revisar por marco.
