const GSI_SRC = 'https://accounts.google.com/gsi/client'
let loading: Promise<typeof google> | null = null

// Loads Google Identity Services once and resolves with the global `google`.
export function loadGoogleIdentity(): Promise<typeof google> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve(google)
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Failed to load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return loading
}
