import crypto from 'node:crypto'

import { loggerService } from '@logger'
import { shell } from 'electron'

const logger = loggerService.withContext('AuthService')

declare const __TENIU_CLOUD_API_BASE__: string
const DEFAULT_API_BASE = __TENIU_CLOUD_API_BASE__
const LOGIN_TIMEOUT = 15000
const BROWSER_LOGIN_TIMEOUT = 10 * 60 * 1000 // 10 minutes

interface ValidateTokenResult {
  success: boolean
  user?: { id: number; username: string; displayName?: string }
  error?: string
}

interface CheckAuthResult {
  valid: boolean
  error?: string
}

interface BrowserLoginResult {
  success: boolean
  state?: string
  error?: string
}

interface ExchangeResult {
  success: boolean
  access_token?: string
  user?: { id: number; username: string; displayName?: string; role?: number }
  error?: string
}

interface PendingBrowserFlow {
  apiBase: string
  timestamp: number
}

let userId: number | null = null
const pendingBrowserFlows = new Map<string, PendingBrowserFlow>()

async function validateToken(token: string, apiBase?: string): Promise<ValidateTokenResult> {
  const base = apiBase || DEFAULT_API_BASE
  logger.info('Validating access token', { apiBase: base })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT)

    const response = await fetch(`${base}/api/user/self`, {
      method: 'GET',
      headers: { Authorization: token },
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      logger.warn(`Token validation failed with status ${response.status}`)
      return { success: false, error: 'Invalid access token' }
    }

    const json = await response.json()

    if (!json.success) {
      logger.warn('Token validation rejected', { message: json.message })
      return { success: false, error: json.message || 'Invalid access token' }
    }

    const userData = json.data || {}
    userId = userData.id || null
    logger.info('Token validation successful', { username: userData.username, userId })
    return {
      success: true,
      user: { id: userData.id, username: userData.username, displayName: userData.display_name }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error('Token validation request timed out')
      return { success: false, error: 'Connection timed out' }
    }
    logger.error('Token validation failed', error)
    return { success: false, error: error.message || 'Network error' }
  }
}

async function logout(): Promise<{ success: boolean; error?: string }> {
  logger.info('Logging out')
  userId = null
  return { success: true }
}

async function checkAuth(token?: string): Promise<CheckAuthResult> {
  if (!token) {
    return { valid: false, error: 'No token available' }
  }
  return { valid: true }
}

function getUserId(): number | null {
  return userId
}

async function startBrowserLogin(apiBase?: string): Promise<BrowserLoginResult> {
  const base = apiBase || DEFAULT_API_BASE
  logger.info('Starting browser-based login', { apiBase: base })

  try {
    const state = crypto.randomBytes(16).toString('hex')

    // Cleanup expired flows
    const now = Date.now()
    for (const [key, flow] of pendingBrowserFlows) {
      if (now - flow.timestamp > BROWSER_LOGIN_TIMEOUT) {
        pendingBrowserFlows.delete(key)
      }
    }

    pendingBrowserFlows.set(state, { apiBase: base, timestamp: now })

    const loginUrl = `${base}/desktop-auth?state=${encodeURIComponent(state)}`
    await shell.openExternal(loginUrl)

    logger.info('Browser opened for login', { state })
    return { success: true, state }
  } catch (error: any) {
    logger.error('Failed to start browser login', error)
    return { success: false, error: error.message || 'Failed to open browser' }
  }
}

async function exchangeDesktopAuthCode(code: string, state: string): Promise<ExchangeResult> {
  logger.info('Exchanging desktop auth code', { state })

  const flow = pendingBrowserFlows.get(state)
  if (!flow) {
    logger.warn('No pending browser flow found for state', { state })
    return { success: false, error: 'Invalid or expired login session' }
  }

  if (Date.now() - flow.timestamp > BROWSER_LOGIN_TIMEOUT) {
    pendingBrowserFlows.delete(state)
    return { success: false, error: 'Login session expired' }
  }

  pendingBrowserFlows.delete(state)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT)

    const response = await fetch(`${flow.apiBase}/api/user/desktop-auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    const json = await response.json()

    if (!json.success) {
      logger.warn('Desktop auth exchange rejected', { message: json.message })
      return { success: false, error: json.message || 'Exchange failed' }
    }

    const data = json.data
    logger.info('Desktop auth exchange successful', { username: data.user?.username })
    return {
      success: true,
      access_token: data.access_token,
      user: {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.display_name,
        role: data.user.role
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error('Desktop auth exchange timed out')
      return { success: false, error: 'Connection timed out' }
    }
    logger.error('Desktop auth exchange failed', error)
    return { success: false, error: error.message || 'Network error' }
  }
}

export const authService = {
  validateToken,
  logout,
  checkAuth,
  getUserId,
  startBrowserLogin,
  exchangeDesktopAuthCode
}
