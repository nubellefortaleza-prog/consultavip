# Cadastros necessários para concluir migração fora do Manus

Para finalizar a remoção de dependências do Manus/Forge, você precisa criar/acessar estas contas:

1. **Provedor de IA (obrigatório)**
   - Opção rápida: OpenAI API.
   - Alternativas: OpenRouter, Together, Groq (OpenAI-compatible).
   - Você vai me passar: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.

2. **Storage S3/R2 (obrigatório)**
   - Opção AWS S3 ou Cloudflare R2.
   - Você vai me passar: `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, e (se R2) `AWS_S3_ENDPOINT`.

3. **Auth próprio (recomendado, próxima etapa)**
   - Opção rápida: Supabase Auth / Clerk / Auth0.
   - Enquanto isso, o app ainda pode operar com OAuth atual.

4. **E-mail de produção (recomendado para escala)**
   - Hoje usa SMTP Gmail.
   - Para volume, ideal migrar para SES, Resend ou SendGrid.

## O que já foi alterado no código

- IA e transcrição já aceitam provider próprio (`AI_*`) e não dependem mais do Manus como padrão.
- Storage já aceita S3/R2 como principal.
- Frontend não usa mais runtime/debug collector do Manus e removi dependência de favicon no `manuscdn`.

## Próximo passo quando você tiver os acessos

Me envie os valores (pode mascarar parcialmente) e eu implemento:

- validação de startup para garantir envs obrigatórias;
- migração final removendo fallback Forge;
- ajuste de auth para provider próprio.
