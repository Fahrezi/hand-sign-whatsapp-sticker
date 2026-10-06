const API_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_URL + '/api' + path, {
    ...init,
    credentials: 'include',
    // FormData sets its own multipart Content-Type (with boundary)
    headers: init.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return (res.status === 204 ? undefined : await res.json()) as T
}

// Nest error bodies look like { message: string | string[] }.
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const { message } = JSON.parse(text)
    if (message) return Array.isArray(message) ? message.join(', ') : String(message)
  } catch {
    // not JSON
  }
  return text || res.statusText
}
