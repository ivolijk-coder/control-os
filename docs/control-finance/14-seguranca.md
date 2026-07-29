# 14 — Segurança

## Objetivo

Proteger dinheiro, identidade, conversas, documentos e disponibilidade por defesa em profundidade.

## Responsabilidades e regras

- Autenticação: provedor maduro/OIDC ou sessão rotativa; senhas com Argon2id, MFA e recuperação segura.
- Autorização: toda query recebe workspace de contexto; políticas por papel e RLS. Nunca confiar em `user_id` enviado pelo cliente.
- Segredos: somente secret manager/variáveis de deploy; nunca Git, logs, tela ou chat. Rotacionar credenciais expostas historicamente.
- Transporte: TLS/HSTS, headers, CORS mínimo, rate limit e WAF/CDN.
- Canais: HMAC Meta, deduplicação por ID de mensagem, consentimento e opt-out.
- Arquivos: upload assinado, antivírus/quarentena, MIME/size allowlist, bucket privado.

## Fluxos e entidades

`UserSession`, `Role`, `Permission`, `ApiKey`, `SecretRotation`, `SecurityEvent`, `DataExportRequest`. Login → MFA/policy → sessão; ação sensível → reautenticação/confirmação → auditoria. Segurança atende APIs, banco, IA e Storage.

## Boas práticas, riscos e expansão

Threat modeling por release, SAST/dependency scan, secret scanning, pentest antes de dados financeiros em escala. Riscos atuais: sessão HMAC simples, FastAPI mock com configuração default potencial, segredos já manuseados manualmente e ausência de rate limiting/monitoramento central. Expansão: SSO, SCIM, RBAC empresarial, KMS e DLP.

