# services/auth — Control Core™ (identidade, sessão, permissões)

Responsável pela identidade do usuário, gestão de sessão e permissões — o Control Core™ descrito na Etapa 2.1. Hoje, uma versão mínima de autenticação vive dentro de `apps/api/app/core/security.py` e `apps/api/app/api/v1/endpoints/auth.py` (hashing de senha, emissão de JWT); este serviço é o destino futuro dessa lógica quando ela crescer além de um único app.

**Status:** pasta reservada. A Fase 1 usa autenticação mockada no frontend (`apps/web/lib/store.ts`) e uma rota de login estrutural na API que ainda não consulta o PostgreSQL.

**Entra em fase futura:** login real contra `users` no PostgreSQL, refresh tokens, controle de permissões por Control Space™, zona de autonomia por módulo (Etapa 6).
