interface ImportMetaEnv {
  // OAuth 2.0 Client ID (Web application) from Google Cloud Console
  readonly VITE_GOOGLE_CLIENT_ID: string
  // API origin when it differs from the web origin; empty = same origin (dev proxy)
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
