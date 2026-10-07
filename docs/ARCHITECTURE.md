# hand-sign — architecture & deploy notes

Replace `luthfiwork.my.id` with the real domain everywhere below.

## Where everything runs

```
Browser
  ├─► handsign.luthfiwork.my.id      → Cloudflare Workers (web, free)
  ├─► handsign-api.luthfiwork.my.id  → VPS → Caddy → NestJS API (Docker)
  │                                         ├─► Supabase Postgres (DB)
  │                                         └─► Cloudflare R2 (sticker uploads)
  └─► R2 public URL                → sticker images
```

| Part | Where | Code | Deploy |
|---|---|---|---|
| Web (Svelte + MediaPipe) | Cloudflare Workers, static assets | `apps/web` | `npm run deploy:web` |
| API (NestJS + Prisma) | VPS, Docker, behind shared Caddy | `apps/api` | `deploy/` (see `deploy/README.md`) |
| Shared types/features | built into both | `packages/shared` | — |
| Database | Supabase Postgres, `ap-northeast-2` (Seoul) | `apps/api/prisma` | `prisma migrate deploy` |
| Uploads | Cloudflare R2 bucket | `apps/api/src/storage` | — |
| HTTPS + routing | shared Caddy on the VPS | `deploy/proxy` (copied to `~/apps/proxy`) | — |

Hand recognition runs in the browser, so the API only handles auth, signs CRUD and uploads.

## Repo layout

```
apps/web/            Svelte app, wrangler.toml → Cloudflare Workers
apps/api/            NestJS API, Prisma schema + migrations, Dockerfile
packages/shared/     code shared by web and api (build first: npm run build:shared)
deploy/              API production compose + api.env.example + README
deploy/proxy/        shared Caddy template for the VPS (one per VPS, not per project)
docker-compose.yml   local Postgres for dev/tests only
docs/                these notes
```

## Domains / DNS (Cloudflare)

| Name | Type | Target | Proxy |
|---|---|---|---|
| `handsign-api` | A | VPS public IP | DNS only until Caddy has the cert; then optional orange + SSL "Full (strict)" |
| `handsign` | Workers Custom Domain | `hand-sign` Worker | auto-created by Cloudflare |

- Web and API **must** share `luthfiwork.my.id`: the session cookie is `SameSite=Lax`.
- Flat names (`handsign-api`, not `api.handsign`) so Cloudflare's free cert covers them if proxied.

## Config — what goes where

**VPS `~/apps/hand-sign/deploy/api.env`** (secrets, `chmod 600`, never committed)
- `WEB_ORIGIN=https://handsign.luthfiwork.my.id`
- `GOOGLE_CLIENT_ID`, `JWT_SECRET` (new random value, not the dev one)
- `DATABASE_URL` — Supabase **session pooler**, port 5432
- `MAX_SIGNS_PER_USER`, `LOG_LEVEL=info`
- all five `R2_*` — required in prod, container disk is wiped on rebuild
- `NODE_ENV`, `PORT`, `TRUST_PROXY` are set in `deploy/docker-compose.yml`

**VPS `~/apps/proxy/sites/hand-sign.caddy`**
- `handsign-api.luthfiwork.my.id { reverse_proxy hand-sign-api:3000 }`

**Web build (`apps/web/.env` or Cloudflare build vars)** — baked in at build time
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_URL=https://handsign-api.luthfiwork.my.id`

**Google Cloud Console → OAuth client**
- Authorized JavaScript origins: `https://handsign.luthfiwork.my.id` (+ `http://localhost:5173` for dev)

## Deploy checklist

One-time
- [ ] Domain on Cloudflare; `handsign-api` A record → VPS IP (DNS only)
- [ ] VPS: SSH key login works, password login off, ufw 22/80/443, swap 2GB, Docker + `docker` group
- [ ] Provider cloud firewall also allows 80/443
- [ ] R2 bucket + API token created; public URL set
- [ ] VPS: clone repo, `cp -r deploy/proxy ~/apps/proxy`, edit `sites/hand-sign.caddy`
- [ ] `docker network create web` → `cd ~/apps/proxy && docker compose up -d`
- [ ] `deploy/api.env` filled from `api.env.example`
- [ ] `docker compose run --rm migrate` → `docker compose up -d --build`
- [ ] `curl https://handsign-api.luthfiwork.my.id/api/health` → `{"status":"ok",...}`
- [ ] Workers Custom Domain `handsign.luthfiwork.my.id`
- [ ] Web rebuilt with `VITE_API_URL`, `npm run deploy:web`
- [ ] Google OAuth origin added
- [ ] Smoke test: Google login, create sign, upload sticker (URL points at R2)

Every API update (on the VPS)
```bash
cd ~/apps/hand-sign && git pull
cd deploy
docker compose run --rm migrate     # only if prisma/migrations changed
docker compose up -d --build
docker image prune -f
```

Every web update (from the laptop)
```bash
npm run deploy:web
```

## Database rules

- New migration locally: `npm run db:migrate -w @hand-sign/api` against the **local** Docker Postgres.
- Against Supabase only ever run `prisma migrate deploy` (`db:deploy` or the `migrate` container). Never `migrate dev` — it can reset the DB.
- Check state: `npx prisma migrate status` in `apps/api`.

## Local development

```bash
docker compose up -d     # local Postgres (+ hand_sign_test for e2e)
npm run dev              # shared + api (:3000) + web (:5173, proxies /api)
npm test                 # api tests
```

`apps/api/.env` decides which DB local dev uses — point it at local Postgres to avoid touching Supabase data.

## Adding another project to the VPS

1. DNS: `A <sub>` → VPS IP (or one wildcard `A *` → VPS IP)
2. Its compose: no `ports:`, join external network `web` with a **unique** alias, set `mem_limit`
3. `~/apps/proxy/sites/<project>.caddy`: `<sub>.luthfiwork.my.id { reverse_proxy <alias>:<port> }`
4. `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`

Capacity on 2 vCPU / 2GB: ~4–6 small APIs like this one (API ≈ 90–150MB each).

## Limits & gotchas

- **Supabase free** pauses after 7 days without activity → API errors until resumed in the dashboard. Keep activity going or upgrade to Pro. Also 500MB DB limit.
- **VPS region**: keep it near Seoul (Seoul/Tokyo) — every query crosses VPS → Supabase.
- **R2 not set** → uploads land in the container and disappear on rebuild.
- **Docker ports bypass ufw** — only Caddy publishes ports.
- **Building on a 2GB VPS** can spike memory → keep swap on.
- **Lost laptop = lost SSH key** → back up `~/.ssh/id_ed25519` or add a second key; provider web console is the fallback.

## Troubleshooting

| Symptom | Check |
|---|---|
| Login works but next request is 401 | Web and API not on the same domain; `WEB_ORIGIN`; HTTPS on both |
| CORS error in browser | `WEB_ORIGIN` exactly matches the web origin (scheme, no trailing slash) |
| Caddy has no cert / TLS error | DNS points at VPS, record is DNS-only, ports 80/443 open in ufw **and** provider firewall; `docker logs caddy` |
| 502 from Caddy | `docker compose ps` in `deploy/`; alias `hand-sign-api` on `web` network; `docker compose logs api` |
| API exits on start | `Missing env: ...` / `Incomplete R2 config` in `docker compose logs api` |
| DB errors after a quiet week | Supabase project paused → resume in dashboard |
| Sticker images 404 after redeploy | R2 not configured |
