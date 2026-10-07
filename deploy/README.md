# Deploying the API to a VPS

One shared Caddy (automatic HTTPS) routes each subdomain to a project's container over the
`web` Docker network. hand-sign's API is reached as `hand-sign-api:3000`. Postgres is Supabase,
uploads go to R2. The web app is deployed separately to Cloudflare (`npm run deploy:web`).

```
handsignsticker.<domain>/api/*  → Cloudflare Worker (adds X-Proxy-Secret)
                                → handsign-api.<domain> → VPS → Caddy → hand-sign-api:3000
```

Caddy answers 403 to any request without the secret, so the API is only reachable through the
web app's Worker. If `HAND_SIGN_PROXY_SECRET` is empty Caddy refuses to start.

## Prerequisites

- Docker + Compose on the VPS, user in the `docker` group
- Ports 80 and 443 open (ufw **and** the provider's cloud firewall, if any)
- DNS `A` record `handsign-api` → VPS public IP (Cloudflare: "DNS only" until the cert is issued)
- Web and API under the same domain — the session cookie is `SameSite=Lax`

## Once per VPS: shared proxy

```bash
git clone https://github.com/Fahrezi/hand-sign-whatsapp-sticker.git ~/apps/hand-sign
cp -r ~/apps/hand-sign/deploy/proxy ~/apps/proxy
cd ~/apps/proxy
cp .env.example .env && chmod 600 .env   # HAND_SIGN_PROXY_SECRET (same as the Worker's PROXY_SECRET)
docker network create web
docker compose up -d
```

`~/apps/proxy` is a copy, so later `git pull`s of hand-sign never touch it.

## First deploy

```bash
cd ~/apps/hand-sign/deploy
cp api.env.example api.env          # fill in secrets
chmod 600 api.env
docker compose run --rm migrate
docker compose up -d --build
curl https://handsign-api.<domain>/api/health
```

## Update

```bash
cd ~/apps/hand-sign && git pull
cd deploy
docker compose run --rm migrate     # only needed when prisma/migrations changed
docker compose up -d --build
docker image prune -f
```

## Adding another project

1. DNS: `A` record `<sub>` → VPS public IP
2. In its compose: no `ports:`, join the external `web` network with a unique alias
3. Add `~/apps/proxy/sites/<project>.caddy` with `<sub>.<domain> { reverse_proxy <alias>:<port> }`
4. `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`

## Useful

```bash
docker compose ps
docker compose logs -f api
docker logs -f caddy
docker stats
```

Web app: leave `VITE_API_URL` empty (calls go to `/api` on its own domain), set the Worker secret
once with `npx wrangler secret put PROXY_SECRET` in `apps/web`, then `npm run deploy:web`. Add the web
origin to "Authorized JavaScript origins" in the Google Cloud OAuth client.
