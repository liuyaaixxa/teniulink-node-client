export interface AuthState {
  isLoggedIn: boolean
  username: string
  loginTime: string
  token: string
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
  }
  error?: string
}

export const AUTH_DEFAULTS: AuthState = {
  isLoggedIn: false,
  username: '',
  loginTime: '',
  token: ''
}
