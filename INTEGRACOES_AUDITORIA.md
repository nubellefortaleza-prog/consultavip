# Auditoria de integrações do Consulta VIP (Manus x próprias)

## Resumo executivo

Hoje o app ainda depende fortemente do ecossistema **Manus/Forge** para partes críticas:

- autenticação OAuth (`OAUTH_SERVER_URL` + endpoints `webdev.v1...`);
- IA via endpoint Forge (`/v1/chat/completions`, transcrição `v1/audio/transcriptions`);
- storage (`v1/storage/upload`, `v1/storage/downloadUrl`);
- Data API/Notification/Image service via `webdevtoken.v1.WebDevService/...`;
- runtime de desenvolvimento Manus no Vite.

Isso significa que, mesmo com frontend e backend próprios, o produto ainda não está 100% independente.

## Integrações encontradas

| Integração | Onde está no código | Tipo (paga/grátis) | Dependência de Manus | Como substituir |
|---|---|---|---|---|
| Forge API base + key (`BUILT_IN_FORGE_API_URL/KEY`) | `server/_core/env.ts` | Geralmente **paga** (serviço proprietário) | **Alta** | Introduzir `OPENAI_BASE_URL`/`OPENAI_API_KEY` (ou provedor próprio) e remover vars `BUILT_IN_*`. |
| LLM via Forge (`/v1/chat/completions`) | `server/_core/llm.ts` | **Pago** por uso de tokens | **Alta** | Trocar para OpenAI/Anthropic/Groq/Vertex com SDK oficial e interface única de provider. |
| Transcrição Whisper via Forge | `server/_core/voiceTranscription.ts` | **Pago** por minuto/token | **Alta** | Usar OpenAI Audio, Deepgram, AssemblyAI ou Whisper self-hosted (GPU). |
| Fallback Gemini direto | `server/routers.ts` + `@google/genai` | **Pago** (há free tier) | Baixa (já é fora Manus) | Manter Gemini direto ou padronizar com mesmo provider do restante da IA. |
| Storage proxy Manus | `server/storage.ts` | Pode estar embutido no plano Manus (custo indireto) | **Alta** | Implementar storage S3/R2/GCS nativo com SDK já presente no projeto. |
| AWS SDK instalado (`@aws-sdk/client-s3`) | `package.json` | **Pago** (S3) | Nenhuma (não está efetivamente conectado) | Conectar de fato no `server/storage.ts` como backend principal. |
| OAuth WebDev Auth | `server/_core/sdk.ts`, `server/_core/oauth.ts`, `server/_core/types/manusTypes.ts` | Normalmente incluído no ecossistema Manus | **Alta** | Migrar para Auth0/Clerk/Supabase Auth/Keycloak + JWT próprio. |
| Notification service Manus | `server/_core/notification.ts` | Geralmente proprietário | Média | Substituir por e-mail, Slack webhook, WhatsApp API, ou fila/eventos (SNS/SQS). |
| Data API Manus (`CallApi`) | `server/_core/dataApi.ts` | Geralmente proprietário | Média | Consumir APIs externas diretamente por backend próprio. |
| Image service Manus (`ImageService/GenerateImage`) | `server/_core/imageGeneration.ts` | **Pago** (geração de imagem) | Média | Trocar para OpenAI Images, Stability, Replicate, ou SD self-hosted. |
| Vite plugin manus runtime/debug collector | `vite.config.ts`, `client/public/__manus__/debug-collector.js` | Dev tooling (não necessariamente pago) | Média | Remover plugin e usar stack própria de observabilidade (Sentry, OpenTelemetry, Logtail). |
| Hosts Manus permitidos no Vite dev server | `vite.config.ts` | N/A | Baixa | Manter apenas domínios próprios em produção/dev. |
| Favicon em CDN Manus | `client/index.html` | N/A | Baixa | Hospedar em bucket/CDN próprio. |
| Umami analytics | `client/index.html` | Grátis self-host / pago cloud | Nenhuma (já é independente) | Manter ou substituir por Plausible/PostHog/GA4. |
| SMTP Gmail via nodemailer | `server/email.ts` | Pode ser grátis (limites) ou Google Workspace pago | Nenhuma | Manter, ou migrar para SES/SendGrid/Resend para escala. |
| Banco MySQL via Drizzle | `server/db.ts`, `package.json` | Depende do provedor (normalmente **pago**) | Nenhuma | Manter (já é infraestrutura própria). |

## O que é pago hoje (prático)

### Quase certamente pago

- Serviços de IA (LLM, transcrição, imagem) quando usados em produção.
- Banco gerenciado MySQL (se estiver em cloud).
- Object storage (S3/R2/GCS), quando houver uso real.

### Pode ser grátis com limite

- Gemini API (free tier inicial, depois cobrado).
- Gmail SMTP pessoal (limites baixos e risco de bloqueio para volume).
- Umami (grátis se self-host).

### Dependência proprietária (normalmente associada a custo/plano)

- Endpoints `forge` e `webdevtoken.v1.WebDevService/*`.
- OAuth WebDev da Manus.

## Plano recomendado para remover dependência do Manus

## Fase 1 (rápida): desacoplar variáveis e providers (1–2 dias)

1. Criar camada `AIProvider` com interface única (`transcribe`, `generateReport`, etc.).
2. Substituir `ENV.forgeApiUrl/Key` por variáveis neutras (`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`).
3. Manter compatibilidade temporária com Forge via adapter legado.

## Fase 2: storage próprio (1 dia)

1. Reimplementar `server/storage.ts` para S3/R2/GCS direto.
2. Definir bucket, política e URL pública/assinada.
3. Migrar uploads antigos se necessário.

## Fase 3: autenticação própria (2–4 dias)

1. Remover fluxo `webdev.v1.WebDevAuthPublicService/*`.
2. Adotar Auth0/Clerk/Supabase Auth (mais rápido) ou Keycloak (self-host).
3. Mapear `openId` legado para `userId` novo e rodar migração de usuários.

## Fase 4: remover runtime Manus no frontend (0,5–1 dia)

1. Retirar `vite-plugin-manus-runtime`.
2. Remover debug collector de `/__manus__/logs`.
3. Ajustar hosts permitidos e assets para domínios próprios.

## Fase 5: observabilidade e notificações próprias (1 dia)

1. Notificações: Slack/Discord webhook + e-mail fallback.
2. Erros: Sentry.
3. Métricas: Umami self-host / PostHog.

## Ordem de prioridade (impacto x risco)

1. **Storage + AI** (mais críticos para operação).
2. **Auth** (mais crítico para segurança e lock-in).
3. **Runtime/dev tooling Manus**.
4. **Assets/CDN e ajustes menores**.

## Checklist técnico objetivo

- [ ] Não existir mais `BUILT_IN_FORGE_API_URL` no código.
- [ ] Não existir mais `BUILT_IN_FORGE_API_KEY` no código.
- [ ] Sem chamadas para `webdevtoken.v1.WebDevService/*`.
- [ ] Sem chamadas para `webdev.v1.WebDevAuthPublicService/*`.
- [ ] Sem `vite-plugin-manus-runtime` no `package.json` e no `vite.config.ts`.
- [ ] Sem `/__manus__/debug-collector.js` no build.
- [ ] Login funcionando via novo provedor.
- [ ] Upload/transcrição/relatório/email funcionando fim a fim no novo stack.
