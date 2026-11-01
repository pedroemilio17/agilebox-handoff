# Servidor AgileBox

Este diretório reserva o lugar do servidor previsto no pós-MVP (PLANO 13).
Durante o MVP, o aplicativo desktop usa SQLite local; não há servidor em execução.

No pós-MVP, aqui ficará a API HTTP sobre os mesmos casos de uso de
`@agilebox/application`. A persistência será fornecida pelo futuro pacote
`@agilebox/infra-postgres`, validado pela mesma suíte de contrato dos repositórios.
Essa evolução também prevê um cliente HTTP no renderer e a migração dos dados locais.

A etapa posterior de login prevê Google, Microsoft (Entra ID) e contas manuais,
com identidades em `auth_identities`, OAuth com PKCE pelo navegador do sistema e
o ator obtido do token. Essas funcionalidades não são implementadas neste placeholder.
