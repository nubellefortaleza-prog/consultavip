# Deploy no VPS (Ubuntu + PM2 + Nginx)

Este guia evita os erros mais comuns vistos na instalação (clone incorreto, `.env` faltando, `DATABASE_URL` vazio e processos PM2 duplicados).

## 1) Entrar no servidor certo

Rode estes comandos **dentro do SSH Linux do VPS** (não no PowerShell do Windows):

```bash
whoami
uname -a
pwd
```

Se aparecer `Permission denied (publickey,password)` ao rodar `ssh root@IP`, isso é problema de credencial SSH (não do app). Resolva o acesso primeiro no painel da hospedagem (senha correta, porta SSH correta ou chave pública autorizada).

## 2) Clonar o projeto corretamente

> Não use `< >` no comando de clone.

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/nubellefortaleza-prog/consultavip.git consultavip
cd /var/www/consultavip
```

Se o repositório for privado e pedir senha do GitHub, use token (PAT) ou chave SSH.

## 3) Instalar dependências e build

```bash
pnpm install
pnpm build
```

Se `pnpm` não existir:

```bash
apt update
apt install -y nodejs npm
npm i -g pnpm pm2
```

## 4) Criar `.env`

Se existir `.env.example`:

```bash
cp .env.example .env
```

Se não existir, crie manualmente:

```bash
cat > .env << 'EOT'
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://USUARIO:SENHA@127.0.0.1:3306/consultavip
JWT_SECRET=troque-por-uma-chave-forte
AUTH_MODE=supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
VITE_SUPABASE_URL=
VITE_AUTH_MODE=supabase
SMTP_USER=
SMTP_PASS=
EOT
```

## 5) Rodar migrações

```bash
pnpm db:push
```

Se aparecer `DATABASE_URL is required`, o `.env` não está preenchido corretamente.

Se aparecer `Access denied for user 'root'@'localhost'` no MySQL (erro 1698), configure usuário de app com senha e atualize o `DATABASE_URL`:

```bash
mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS consultavip;
CREATE USER IF NOT EXISTS 'consultavip'@'127.0.0.1' IDENTIFIED BY 'troque-essa-senha';
GRANT ALL PRIVILEGES ON consultavip.* TO 'consultavip'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

No `.env`:

```env
DATABASE_URL=mysql://consultavip:troque-essa-senha@127.0.0.1:3306/consultavip
```

E rode novamente:

```bash
pnpm db:push
```

## 6) Subir com PM2 sem duplicidade

```bash
cd /var/www/consultavip
pm2 delete consultavip || true
pnpm run pm2:start
pm2 save
```

> Use `pnpm run pm2:start` (com `run`). Em alguns ambientes `pnpm pm2:start` falha com `Command "pm2:start" not found`.

## 7) Validar processo e porta

```bash
pm2 ls
pm2 logs consultavip --lines 100
ss -ltnp | grep :3000
```

Se não mostrar porta 3000, o processo ainda não subiu — verifique os logs do PM2.

## 8) Nginx (proxy para app)

Exemplo de bloco (ajuste domínio):

```nginx
server {
  listen 80;
  server_name consultavip.vipestetic.com.br;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Depois:

```bash
nginx -t
systemctl reload nginx
```

## Diagnóstico rápido

```bash
cd /var/www/consultavip
git remote -v
git rev-parse --short HEAD
ls -la
find . -maxdepth 2 \( -name '.env.example' -o -name 'drizzle.config.ts' -o -name 'client/index.html' \)
```
