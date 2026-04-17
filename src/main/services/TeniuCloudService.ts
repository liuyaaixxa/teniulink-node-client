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
const LOGOUT_TIMEOUT_MS = 5000

// Module-level state: remember the domain used during connect for disconnect/cleanup
let connectedDomain: string | null = null

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
 * Connect to Teniu Cloud using octelium connect command.
 * Uses: octelium connect --serve "{serviceName}" --domain {domain} --auth-token {apiKey}
 * The connect process is long-running (keeps tunnel alive), so we spawn it detached.
 */
export async function connect(apiUrl: string, apiKey: string, serviceName?: string): Promise<CommandResult> {
  try {
    // Check if octelium is installed, auto-install if not
    let installed = await isOcteliumInstalled()
    if (!installed) {
      logger.info('octelium not found, attempting auto-install...')
      const installResult = await installOctelium()
      if (!installResult.success) {
        return installResult
      }
      installed = await isOcteliumInstalled()
      if (!installed) {
        return { success: false, error: 'octelium installation completed but binary not found in PATH' }
      }
    }

    const domain = extractDomain(apiUrl)
    connectedDomain = domain
    logger.info(`Connecting to Teniu Cloud: ${domain}${serviceName ? ` (serve: ${serviceName})` : ''}`)

    // Step 1: logout stale sessions (best-effort)
    try {
      await executeCommand('octelium', ['logout'], LOGOUT_TIMEOUT_MS, getOcteliumEnv(domain))
      logger.info('Pre-connect logout completed')
    } catch {
      logger.debug('Pre-connect logout skipped (no stale session or not logged in)')
    }

    // Step 2: login to establish session before connect
    try {
      await executeCommand(
        'octelium',
        ['login', '--domain', domain, `--auth-token=${apiKey}`],
        COMMAND_TIMEOUT_MS,
        getOcteliumEnv(domain)
      )
      logger.info('Pre-connect login completed')
    } catch (error) {
      logger.warn(`Pre-connect login failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Step 3: Build connect args
    const connectArgs = ['connect']
    if (serviceName) {
      connectArgs.push('--serve', serviceName)
    }
    connectArgs.push('--domain', domain, '--auth-token', apiKey)

    logger.debug(`Spawning: octelium ${connectArgs.join(' ')}`)

    // Spawn as detached background process — octelium connect is long-running
    const child = spawn('octelium', connectArgs, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...getOcteliumEnv(domain) }
    })

    child.on('error', (err) => {
      logger.error('octelium connect spawn error:', err)
    })

    child.unref()

    // Wait a few seconds for connection to establish, then verify
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const status = await checkStatusWithEnv(domain)
    if (status.connected) {
      logger.info('Successfully connected to Teniu Cloud')
    } else {
      logger.warn('Connection started but status check inconclusive — tunnel may still be initializing')
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to connect to Teniu Cloud:', error as Error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Find and kill any remaining octelium processes after disconnect.
 * Strategy: pkill -f first (matches full command line), then verify with ps -ef.
 * Best-effort — failures are logged, not thrown.
 */
async function killRemainingOcteliumProcesses(): Promise<void> {
  try {
    // Step 1: pkill -f "octelium connect" — matches full command line
    try {
      await executeCommand('pkill', ['-9', '-f', 'octelium connect'], LOGOUT_TIMEOUT_MS)
      logger.info('Killed octelium connect processes via pkill')
    } catch {
      logger.debug('pkill found no octelium connect processes (or not available)')
    }

    // Step 2: Verify with ps -ef, kill any stragglers with SIGKILL
    try {
      const { stdout } = await executeCommand('ps', ['-ef'], STATUS_TIMEOUT_MS)
      const lines = stdout.split('\n')
      const octeliumLines = lines.filter(
        (line) => line.includes('octelium') && !line.includes('grep') && !line.includes('ps -ef')
      )

      if (octeliumLines.length === 0) {
        logger.info('Verified: no remaining octelium processes')
        return
      }

      logger.warn(`${octeliumLines.length} octelium process(es) still remain, force killing...`)

      for (const line of octeliumLines) {
        const parts = line.trim().split(/\s+/)
        const pid = parseInt(parts[1], 10)
        if (isNaN(pid) || pid <= 0) continue

        try {
          process.kill(pid, 'SIGKILL')
          logger.info(`Force killed octelium process PID=${pid}`)
        } catch (err) {
          logger.debug(`Failed to kill PID=${pid}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    } catch {
      logger.debug('ps verification skipped')
    }
  } catch (error) {
    logger.debug(`Process cleanup error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Disconnect from Teniu Cloud
 * Uses: octelium disconnect --logout
 */
export async function disconnect(): Promise<CommandResult> {
  try {
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { success: true }
    }

    const domain = connectedDomain
    const env = getOcteliumEnv(domain || undefined)
    logger.info(`Disconnecting from Teniu Cloud (domain=${domain || 'unknown'})`)

    // Step 1: octelium disconnect --logout
    try {
      const result = await executeCommand('octelium', ['disconnect', '--logout'], COMMAND_TIMEOUT_MS, env)
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
        logger.warn('Disconnect command failed:', error as Error)
      }
    }

    // Step 2: octelium logout to fully clear session
    try {
      await executeCommand('octelium', ['logout'], LOGOUT_TIMEOUT_MS, env)
      logger.info('Post-disconnect logout completed')
    } catch {
      logger.debug('Post-disconnect logout skipped (no session)')
    }

    // Step 3: kill any remaining octelium processes
    await killRemainingOcteliumProcesses()

    connectedDomain = null
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
 * Requires a sessionToken (access token) from the renderer
 */
export async function getDeviceTokens(sessionToken?: string, userId?: number): Promise<DeviceTokensResult> {
  try {
    if (!sessionToken) {
      return { success: false, tokens: [], error: 'Not logged in. Please login first.' }
    }

    const apiBase = DEFAULT_API_BASE
    const url = `${apiBase}/api/device-token/?p=1&size=100`

    const uid = userId || authService.getUserId()
    logger.debug(`Fetching device tokens from ${url} (userId=${uid})`)

    const headers: Record<string, string> = {
      Authorization: sessionToken,
      'Content-Type': 'application/json'
    }
    if (uid) {
      headers['New-Api-User'] = String(uid)
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
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
 * Get the full plaintext token key for a specific device token
 * Requires a sessionToken (access token) from the renderer
 */
export async function getDeviceTokenKey(
  deviceId: number,
  sessionToken?: string,
  userId?: number
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (!sessionToken) {
      return { success: false, error: 'Not logged in. Please login first.' }
    }

    const apiBase = DEFAULT_API_BASE
    const url = `${apiBase}/api/device-token/${deviceId}/key`

    const uid = userId || authService.getUserId()
    logger.debug(`Fetching device token key for device ${deviceId} (userId=${uid})`)

    const headers: Record<string, string> = {
      Authorization: sessionToken,
      'Content-Type': 'application/json'
    }
    if (uid) {
      headers['New-Api-User'] = String(uid)
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Session expired. Please login again.' }
      }
      return { success: false, error: `HTTP ${response.status}` }
    }

    const json = await response.json()

    if (!json.success) {
      return { success: false, error: json.message || 'Failed to fetch device token key' }
    }

    const token = json.data?.token || json.data?.key
    if (!token) {
      return { success: false, error: 'Token key not found in response' }
    }

    logger.info(`Successfully fetched token key for device ${deviceId}`)
    return { success: true, token }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to fetch device token key:', error as Error)
    return { success: false, error: errorMessage }
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
  getDeviceTokenKey,
  resolveServiceName
}

export default teniuCloudService
