# Segurança de chaves e credenciais (Consulta VIP)

## Ações imediatas recomendadas

1. **Rotacionar** qualquer chave já compartilhada em chat, ticket ou screenshot.
2. Manter chaves **somente** em variáveis de ambiente no servidor.
3. Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no frontend.
4. Limitar permissões das chaves de storage (bucket específico) e revogar chaves antigas.

## Regras aplicadas no projeto

- O fluxo de validação de usuário Supabase usa apenas `SUPABASE_ANON_KEY` para consultar `/auth/v1/user`.
- Chaves sensíveis não são gravadas em arquivos versionados.
- Headers básicos de hardening HTTP ativados no servidor.
- Script de analytics só é carregado quando variáveis existem, evitando chamadas inválidas.

## Checklist de deploy seguro

- [ ] `AI_API_KEY` configurada no ambiente de produção.
- [ ] `SUPABASE_ANON_KEY` e `SUPABASE_URL` configuradas.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada apenas no backend (se necessário).
- [ ] `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` com escopo mínimo.
- [ ] Sem `.env` no git.
- [ ] Revisão de logs para garantir que tokens não são impressos.
