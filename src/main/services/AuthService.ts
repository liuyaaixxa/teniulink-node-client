import { loggerService } from '@logger'

const logger = loggerService.withContext('AuthService')

const DEFAULT_API_BASE = 'http://localhost:3000'
const LOGIN_TIMEOUT = 15000

interface LoginResult {
  success: boolean
  token?: string
  user?: { username: string; displayName?: string }
  error?: string
}

interface CheckAuthResult {
  valid: boolean
  error?: string
}

let sessionCookie: string | null = null

async function login(username: string, password: string, apiBase?: string): Promise<LoginResult> {
  const base = apiBase || DEFAULT_API_BASE
  logger.info(`Attempting login for user: ${username}`, { apiBase: base })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT)

    const response = await fetch(`${base}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.warn(`Login failed with status ${response.status}`, { error: errorText })
      return { success: false, error: `Authentication failed (${response.status})` }
    }

    const json = await response.json()

    if (!json.success) {
      logger.warn('Login rejected by server', { message: json.message })
      return { success: false, error: json.message || 'Login failed' }
    }

    // Extract session cookie from Set-Cookie header
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/)
      sessionCookie = match ? match[1] : null
    }

    const userData = json.data || {}
    logger.info('Login successful', { username: userData.username })
    return {
      success: true,
      token: sessionCookie || '',
      user: { username: userData.username || username, displayName: userData.display_name }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error('Login request timed out')
      return { success: false, error: 'Connection timed out' }
    }
    logger.error('Login failed', error)
    return { success: false, error: error.message || 'Network error' }
  }
}

async function logout(): Promise<{ success: boolean; error?: string }> {
  logger.info('Logging out')
  sessionCookie = null
  return { success: true }
}

async function checkAuth(token?: string): Promise<CheckAuthResult> {
  const tokenToCheck = token || sessionCookie
  if (!tokenToCheck) {
    return { valid: false, error: 'No token available' }
  }
  return { valid: true }
}

export const authService = {
  login,
  logout,
  checkAuth
}
