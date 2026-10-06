# Deploying the API to a VPS

Caddy (automatic HTTPS) → NestJS API in Docker. Postgres is Supabase, uploads go to R2.
The web app is deployed separately to Cloudflare (`npm run deploy:web`).

## Prerequisites

- Docker + Compose on the VPS, user in the `docker` group
- Ports 80 and 443 open (ufw **and** the provider's cloud firewall, if any)
- DNS `A` record `api.<domain>` → VPS public IP (Cloudflare: "DNS only" until the cert is issued)
- Web and API on the same site (`example.com` + `api.example.com`) — the session cookie is `SameSite=Lax`

## First deploy

```bash
git clone https://github.com/Fahrezi/hand-sign-whatsapp-sticker.git ~/apps/hand-sign
cd ~/apps/hand-sign/deploy
cp .env.example .env            # set API_DOMAIN
cp api.env.example api.env      # fill in secrets
chmod 600 .env api.env
docker compose run --rm migrate
docker compose up -d --build
curl https://api.<domain>/api/health
```

## Update

```bash
cd ~/apps/hand-sign && git pull
cd deploy
docker compose run --rm migrate     # only needed when prisma/migrations changed
docker compose up -d --build
docker image prune -f
```

## Useful

```bash
docker compose ps
docker compose logs -f api
docker stats
```

Then build the web app with `VITE_API_URL=https://api.<domain>` and add the web origin to
"Authorized JavaScript origins" in the Google Cloud OAuth client.
