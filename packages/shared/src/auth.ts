// Logged-in user as returned by GET /api/auth/me.
export interface AuthUser {
  id: string;
  email: string;
  // null until the user picks one after their first login
  username: string | null;
  name: string | null;
  picture: string | null;
}

export interface GoogleLoginRequest {
  // ID token (JWT) from Google Identity Services
  credential: string;
}

// 3–20 chars: lowercase letters, digits, underscore. Stored lowercase, unique.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface SetUsernameRequest {
  username: string;
}
