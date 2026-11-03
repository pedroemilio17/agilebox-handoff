# 0006 · Migrações com chaves estrangeiras desligadas

- **Data**: 2026-11-03 (M4.2)
- **Estado**: aceito, pendente de conferência do Pedro

## Contexto

A migração 0006 torna `users.default_rate_cents` anulável. O SQLite não altera `NOT NULL` com `ALTER`, então a tabela é recriada (nova tabela, cópia, `DROP`, renomear). Com `foreign_keys = ON`, o `DROP TABLE users` falha com "FOREIGN KEY constraint failed" assim que existe projeto ou participação apontando para o usuário. O `PRAGMA foreign_keys=OFF` gerado pelo drizzle-kit não tem efeito, porque o migrador do Drizzle abre uma transação e o SQLite ignora essa pragma dentro dela. `PRAGMA defer_foreign_keys` também falha no `COMMIT`.

## Decisão

`createSqliteClient` desliga `foreign_keys` imediatamente antes de `migrate(...)` e religa no `finally`. É o procedimento oficial do SQLite para recriar tabelas. O SQL da 0006 não contém os `PRAGMA` gerados. Todo caminho de abertura do banco (app, `db:migrate`, `db:seed`) passa por esse cliente.

## Consequências

- Durante a migração o banco não valida chaves estrangeiras. Toda migração que recria tabela deve ter teste que rode `PRAGMA foreign_key_check` (vazio) e confira que `foreign_keys` volta a 1, como em `migration-0006.test.ts`.
- Rodar `drizzle-kit generate` de novo gera snapshots válidos, mas o SQL de migrações futuras que recriem tabelas deve ter os `PRAGMA` removidos à mão.
