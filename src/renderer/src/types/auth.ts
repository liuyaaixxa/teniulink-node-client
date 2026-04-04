export interface AuthState {
  isLoggedIn: boolean
  username: string
  loginTime: string
  token: string
  userId: number | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token?: string
  user?: {
    username: string
    userId?: number
  }
  error?: string
}

export const AUTH_DEFAULTS: AuthState = {
  isLoggedIn: false,
  username: '',
  loginTime: '',
  token: '',
  userId: null
}
