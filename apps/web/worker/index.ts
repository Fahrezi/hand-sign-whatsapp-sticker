// Runs only for /api/* (see run_worker_first in wrangler.toml); everything else is served
// straight from static assets. Proxying keeps the API same-origin with the web app (no CORS,
// first-party session cookie), and the secret header lets Caddy reject direct calls to the API.

interface Env {
  API_ORIGIN: string
  PROXY_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const upstream = new Request(new URL(url.pathname + url.search, env.API_ORIGIN), request)
    upstream.headers.set('X-Proxy-Secret', env.PROXY_SECRET)
    // Caddy turns this into X-Forwarded-For, so the API logs the visitor's IP, not Cloudflare's
    upstream.headers.set('X-Client-IP', request.headers.get('CF-Connecting-IP') ?? '')
    return fetch(upstream, { redirect: 'manual' })
  },
}
