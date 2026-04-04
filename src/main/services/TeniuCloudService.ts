import { execFile, spawn } from 'node:child_process'

import { loggerService } from '@logger'
import { API_SERVER_DEFAULTS } from '@shared/config/constant'

import { authService } from './AuthService'

const logger = loggerService.withContext('TeniuCloudService')

declare const __TENIU_CLOUD_API_BASE__: string
const DEFAULT_API_BASE = __TENIU_CLOUD_API_BASE__

// Timeout for CLI commands
const COMMAND_TIMEOUT_MS = 30000
const STATUS_TIMEOUT_MS = 10000
const INSTALL_TIMEOUT_MS = 300000 // 5 minutes for brew install

interface CommandResult {
  success: boolean
  error?: string
}

interface ConnectionStatus {
  connected: boolean
  error?: string
}

export interface DeviceToken {
  id: number
  name: string
  tokenMask: string
  domain: string
  status: number
}

export interface DeviceTokensResult {
  success: boolean
  tokens: DeviceToken[]
  error?: string
}

export interface LocalModel {
  id: string
  name: string
  provider: string
  providerName: string
  providerType: string
  providerModelId: string
}

export interface LocalModelsResult {
  success: boolean
  models: LocalModel[]
  total: number
  gatewayUrl: string
  error?: string
}

/**
 * Execute a command with arguments using execFile (safer than exec)
 */
async function executeCommand(
  command: string,
  args: string[] = [],
  timeoutMs: number = COMMAND_TIMEOUT_MS,
  env?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    const execEnv = env ? { ...process.env, ...env } : process.env

    logger.debug(`Executing: ${command} ${args.join(' ')}`)

    execFile(command, args, { env: execEnv }, (error, stdout, stderr) => {
      clearTimeout(timeout)
      if (error) {
        logger.debug(`Command failed: ${stderr || error.message}`)
        reject(new Error(stderr || error.message))
      } else {
        logger.debug(`Command output: ${stdout || '(empty)'}`)
        resolve({ stdout, stderr })
      }
    })
  })
}

/**
 * Check if octelium CLI is installed
 */
async function isOcteliumInstalled(): Promise<boolean> {
  try {
    await executeCommand('which', ['octelium'], 5000)
    return true
  } catch {
    return false
  }
}

/**
 * Get environment variables for octelium commands
 */
function getOcteliumEnv(domain?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    OCTELIUM_INSECURE_TLS: 'true'
  }
  if (domain) {
    env.OCTELIUM_DOMAIN = domain
  }
  return env
}

/**
 * Extract domain from an API URL string
 */
function extractDomain(apiUrl: string): string {
  try {
    const url = new URL(apiUrl)
    return url.hostname
  } catch {
    return apiUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

/**
 * Auto-install octelium CLI based on platform
 * macOS: brew install octelium/tap/octelium
 * Linux: download binary from official release
 */
export async function installOctelium(): Promise<CommandResult> {
  const platform = process.platform

  logger.info(`Installing octelium for platform: ${platform}`)

  if (platform === 'darwin') {
    // macOS: use Homebrew
    try {
      await executeCommand('which', ['brew'], 5000)
    } catch {
      return {
        success: false,
        error:
          'Homebrew is not installed. Please install Homebrew first (https://brew.sh) or install octelium manually.'
      }
    }

    try {
      logger.info('Installing octelium via Homebrew...')
      await executeCommand('brew', ['install', 'octelium/tap/octelium'], INSTALL_TIMEOUT_MS)
      logger.info('octelium installed successfully via Homebrew')
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Homebrew install failed:', error as Error)
      return { success: false, error: `Homebrew install failed: ${errorMsg}` }
    }
  } else if (platform === 'linux') {
    // Linux: download binary
    try {
      const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
      const url = `https://github.com/octelium/octelium/releases/latest/download/octelium_linux_${arch}`

      logger.info(`Downloading octelium binary from ${url}`)

      // Try /usr/local/bin first, fall back to ~/.local/bin
      const installPaths = ['/usr/local/bin/octelium', `${process.env.HOME}/.local/bin/octelium`]

      for (const installPath of installPaths) {
        try {
          // Ensure directory exists
          const dir = installPath.substring(0, installPath.lastIndexOf('/'))
          await executeCommand('mkdir', ['-p', dir], 10000)

          await executeCommand('curl', ['-fsSL', '-o', installPath, url], INSTALL_TIMEOUT_MS)
          await executeCommand('chmod', ['+x', installPath], 5000)

          logger.info(`octelium installed to ${installPath}`)
          return { success: true }
        } catch {
          logger.debug(`Failed to install to ${installPath}, trying next...`)
          continue
        }
      }

      return { success: false, error: 'Failed to install octelium binary. Please install manually.' }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Linux install failed: ${errorMsg}` }
    }
  } else {
    return {
      success: false,
      error: `Auto-install is not supported on ${platform}. Please install octelium manually from https://github.com/octelium/octelium`
    }
  }
}

/**
 * Spawn octelium connect as a background process (no -d flag, no admin password).
 * The process is detached and unref'd so it keeps running after Electron exits.
 */
function spawnConnectBackground(domain: string, apiKey: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['connect', '--domain', domain, '--auth-token', apiKey]
    const mergedEnv = { ...process.env, ...env }

    logger.debug(`Spawning background: octelium ${args.join(' ')}`)

    const child = spawn('octelium', args, {
      env: mergedEnv,
      detached: true,
      stdio: 'ignore'
    })

    child.on('error', (err) => {
      logger.error('Failed to spawn octelium connect:', err)
      reject(new Error(`Failed to start octelium: ${err.message}`))
    })

    // Detach from parent so it survives independently
    child.unref()

    // Give the process a moment to start (or fail immediately)
    setTimeout(() => resolve(), 500)
  })
}

// How many times to poll status and how long between polls
const STATUS_POLL_INTERVAL_MS = 1500
const STATUS_POLL_MAX_ATTEMPTS = 10

/**
 * Connect to Teniu Cloud using background octelium connect command.
 * Uses: octelium connect --domain {domain} --auth-token {apiKey} (background)
 * Then polls `octelium status` to verify the connection is established.
 */
export async function connect(apiUrl: string, apiKey: string): Promise<CommandResult> {
  try {
    // Check if octelium is installed, auto-install if not
    let installed = await isOcteliumInstalled()
    if (!installed) {
      logger.info('octelium not found, attempting auto-install...')
      const installResult = await installOctelium()
      if (!installResult.success) {
        return installResult
      }
      // Verify install succeeded
      installed = await isOcteliumInstalled()
      if (!installed) {
        return { success: false, error: 'octelium installation completed but binary not found in PATH' }
      }
    }

    const domain = extractDomain(apiUrl)
    logger.info(`Connecting to Teniu Cloud: ${domain}`)

    const octeliumEnv = getOcteliumEnv(domain)

    // Spawn connect as a background process (no -d flag, no admin password)
    try {
      await spawnConnectBackground(domain, apiKey, octeliumEnv)
      logger.info('octelium connect process launched in background')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Connect spawn failed:', error as Error)
      return { success: false, error: `Connect failed: ${errorMsg}` }
    }

    // Poll octelium status to verify connection
    for (let attempt = 1; attempt <= STATUS_POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
      logger.debug(`Checking connection status (attempt ${attempt}/${STATUS_POLL_MAX_ATTEMPTS})`)

      const status = await checkStatusWithEnv(domain)
      if (status.connected) {
        logger.info('Successfully connected to Teniu Cloud')
        return { success: true }
      }
    }

    // All poll attempts exhausted – the process may still be connecting
    logger.warn('Connection status not confirmed after polling, but process is running')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to connect to Teniu Cloud:', error as Error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Disconnect from Teniu Cloud
 * Uses: octelium disconnect --serve "{serviceName}" when available
 */
export async function disconnect(serviceName?: string): Promise<CommandResult> {
  try {
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { success: true }
    }

    logger.info('Disconnecting from Teniu Cloud')

    // Try disconnect with --serve flag if serviceName is provided
    if (serviceName) {
      try {
        logger.info(`Disconnecting service: ${serviceName}`)
        const result = await executeCommand(
          'octelium',
          ['disconnect', '--serve', serviceName],
          COMMAND_TIMEOUT_MS,
          getOcteliumEnv()
        )
        logger.info(`Disconnect output: ${result.stdout.trim() || result.stderr.trim() || 'Done'}`)
        return { success: true }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.warn(`Disconnect with --serve failed: ${errorMsg}, trying bare disconnect`)
        // Fall through to bare disconnect
      }
    }

    // Bare disconnect fallback
    try {
      const result = await executeCommand('octelium', ['disconnect'], COMMAND_TIMEOUT_MS, getOcteliumEnv())
      logger.info(`Disconnect output: ${result.stdout.trim() || result.stderr.trim() || 'Done'}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      if (
        lowerErrorMsg.includes('not connected') ||
        lowerErrorMsg.includes('no active') ||
        lowerErrorMsg.includes('already disconnected')
      ) {
        logger.info('No active tunnel to close')
      } else {
        logger.warn('Disconnect failed:', error as Error)
      }
    }

    logger.info('Successfully disconnected from Teniu Cloud')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to disconnect from Teniu Cloud:', error as Error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Check connection status using octelium CLI
 */
export async function checkStatus(): Promise<ConnectionStatus> {
  return checkStatusWithEnv()
}

async function checkStatusWithEnv(domain?: string): Promise<ConnectionStatus> {
  try {
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { connected: false, error: 'octelium CLI is not installed' }
    }

    try {
      const env = getOcteliumEnv(domain)
      const { stdout } = await executeCommand('octelium', ['status'], STATUS_TIMEOUT_MS, env)

      if (stdout.includes('cluster:') || stdout.includes('session:') || stdout.includes('user:')) {
        return { connected: true }
      }

      return { connected: false }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      if (
        lowerErrorMsg.includes('not logged in') ||
        lowerErrorMsg.includes('not connected') ||
        lowerErrorMsg.includes('domain is not set') ||
        lowerErrorMsg.includes('domain not set') ||
        lowerErrorMsg.includes('no cluster') ||
        lowerErrorMsg.includes('please authenticate')
      ) {
        return { connected: false }
      }

      logger.debug('Status check failed:', error as Error)
      return { connected: false }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to check Teniu Cloud status:', error as Error)
    return { connected: false, error: errorMessage }
  }
}

/**
 * Get device tokens from Teniu Cloud backend API
 * Uses the session cookie from AuthService for authentication
 */
export async function getDeviceTokens(): Promise<DeviceTokensResult> {
  try {
    const cookie = authService.getSessionCookie()
    if (!cookie) {
      return { success: false, tokens: [], error: 'Not logged in. Please login first.' }
    }

    const apiBase = DEFAULT_API_BASE
    const url = `${apiBase}/api/device-token/?p=1&size=100`

    logger.debug(`Fetching device tokens from ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: `session=${cookie}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, tokens: [], error: 'Session expired. Please login again.' }
      }
      return { success: false, tokens: [], error: `HTTP ${response.status}` }
    }

    const json = await response.json()

    if (!json.success) {
      return { success: false, tokens: [], error: json.message || 'Failed to fetch device tokens' }
    }

    const items = json.data?.items || []
    const tokens: DeviceToken[] = items.map((item: any) => ({
      id: item.id,
      name: item.name || '',
      tokenMask: item.token_mask || '',
      domain: item.domain || '',
      status: item.status || 0
    }))

    logger.info(`Fetched ${tokens.length} device tokens`)
    return { success: true, tokens }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to fetch device tokens:', error as Error)
    return { success: false, tokens: [], error: errorMessage }
  }
}

/**
 * Resolve service name by matching API key against device token masks
 * Token mask format: first4****last4
 * Service name format: {username}-{deviceName} (normalized)
 */
export function resolveServiceName(apiKey: string, username: string, tokens: DeviceToken[]): string | null {
  if (!apiKey || !username || tokens.length === 0) {
    return null
  }

  // Extract first 4 and last 4 characters of apiKey for matching
  const keyPrefix = apiKey.substring(0, 4)
  const keySuffix = apiKey.substring(apiKey.length - 4)

  // Find matching token by comparing mask pattern
  const matchedToken = tokens.find((token) => {
    if (!token.tokenMask) return false
    const maskPrefix = token.tokenMask.substring(0, 4)
    const maskSuffix = token.tokenMask.substring(token.tokenMask.length - 4)
    return maskPrefix === keyPrefix && maskSuffix === keySuffix
  })

  if (!matchedToken) {
    logger.warn('No matching device token found for API key')
    // If only one active token, use it as fallback
    const activeTokens = tokens.filter((t) => t.status === 1)
    if (activeTokens.length === 1) {
      logger.info(`Using single active token: ${activeTokens[0].name}`)
      return normalizeServiceName(username, activeTokens[0].name)
    }
    return null
  }

  return normalizeServiceName(username, matchedToken.name)
}

/**
 * Normalize service name: {username}-{deviceName}
 * Lowercase, spaces/underscores → hyphens, max 64 chars
 */
function normalizeServiceName(username: string, deviceName: string): string {
  const raw = `${username}-${deviceName}`
  const normalized = raw
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .substring(0, 64)

  logger.info(`Resolved service name: ${normalized}`)
  return normalized
}

/**
 * Get local models from the local API server
 */
export async function getLocalModels(): Promise<LocalModelsResult> {
  try {
    const { config } = await import('../apiServer/config.js')

    const apiConfig = await config.get()
    const host = apiConfig.host || API_SERVER_DEFAULTS.HOST
    const port = apiConfig.port || API_SERVER_DEFAULTS.PORT
    const apiKey = apiConfig.apiKey

    const gatewayUrl = `http://${host}:${port}`
    const modelsUrl = `${gatewayUrl}/v1/models`

    logger.debug(`Fetching local models from ${modelsUrl}`)

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Failed to fetch models: ${response.status} ${errorText}`)
      return {
        success: false,
        models: [],
        total: 0,
        gatewayUrl,
        error: `HTTP ${response.status}: ${errorText}`
      }
    }

    const data = await response.json()

    const modelList = Array.isArray(data?.data) ? data.data : []
    const total = typeof data?.total === 'number' ? data.total : modelList.length

    const models: LocalModel[] = modelList.map((model: any) => ({
      id: model.id || '',
      name: model.name || model.id || '',
      provider: model.provider || 'unknown',
      providerName: model.provider_name || model.provider || 'Unknown',
      providerType: model.provider_type || model.provider || 'unknown',
      providerModelId: model.provider_model_id || model.id || ''
    }))

    logger.info(`Fetched ${models.length} local models from gateway`)

    return { success: true, models, total, gatewayUrl }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to get local models:', error as Error)
    return {
      success: false,
      models: [],
      total: 0,
      gatewayUrl: `http://${API_SERVER_DEFAULTS.HOST}:${API_SERVER_DEFAULTS.PORT}`,
      error: errorMessage
    }
  }
}

export const teniuCloudService = {
  connect,
  disconnect,
  checkStatus,
  getLocalModels,
  installOctelium,
  getDeviceTokens,
  resolveServiceName
}

export default teniuCloudService
