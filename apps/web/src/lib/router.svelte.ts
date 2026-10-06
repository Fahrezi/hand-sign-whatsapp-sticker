// Minimal history-API router: the app only has a handful of routes.
let url = $state(new URL(window.location.href))

window.addEventListener('popstate', () => {
  url = new URL(window.location.href)
})

export const router = {
  get path() {
    return url.pathname
  },
  get searchParams() {
    return url.searchParams
  },
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  url = new URL(window.location.href)
}

// Only allow same-app paths as post-login targets (blocks //evil.com open redirects).
export function safeNext(next: string | null, fallback = '/') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
