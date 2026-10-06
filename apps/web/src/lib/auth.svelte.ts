import type { AuthUser, GoogleLoginRequest, SetUsernameRequest } from '@hand-sign/shared'
import { api, ApiError } from './api'

let user = $state<AuthUser | null>(null)
let checked = $state(false)
let pending: Promise<AuthUser | null> | null = null

export const auth = {
  get user() {
    return user
  },
  // true once the session has been checked against the API at least once
  get checked() {
    return checked
  },
}

export function loadSession(): Promise<AuthUser | null> {
  if (checked) return Promise.resolve(user)
  pending ??= api<AuthUser>('/auth/me')
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null
      throw err
    })
    .then((u) => {
      user = u
      checked = true
      return u
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export async function loginWithGoogle(credential: string) {
  const body: GoogleLoginRequest = { credential }
  user = await api<AuthUser>('/auth/google', { method: 'POST', body: JSON.stringify(body) })
  checked = true
  return user
}

export async function logout() {
  await api<void>('/auth/logout', { method: 'POST' })
  user = null
}

export async function setUsername(username: string) {
  const body: SetUsernameRequest = { username }
  user = await api<AuthUser>('/me/username', { method: 'PUT', body: JSON.stringify(body) })
  return user
}
