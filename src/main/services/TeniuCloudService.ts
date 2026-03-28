import { execFile } from 'node:child_process'

import { loggerService } from '@logger'
import { API_SERVER_DEFAULTS } from '@shared/config/constant'

const logger = loggerService.withContext('TeniuCloudService')

// Timeout for CLI commands
const LOGIN_TIMEOUT_MS = 30000
const CONNECT_TIMEOUT_MS = 60000 // connect -d may take longer
const STATUS_TIMEOUT_MS = 10000

interface CommandResult {
  success: boolean
  error?: string
}

interface ConnectionStatus {
  connected: boolean
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
 * Uses execFile to prevent shell injection
 */
async function executeCommand(
  command: string,
  args: string[] = [],
  timeoutMs: number = LOGIN_TIMEOUT_MS,
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
 * Connect to Teniu Cloud using octelium CLI
 * This performs: login -> connect (opens local tunnel)
 * @param apiUrl - The API URL (domain)
 * @param apiKey - The authentication token
 */
export async function connect(apiUrl: string, apiKey: string): Promise<CommandResult> {
  try {
    // Check if octelium is installed
    const installed = await isOcteliumInstalled()
    if (!installed) {
      const errorMsg = 'octelium CLI is not installed. Please install it first.'
      logger.error(errorMsg)
      return { success: false, error: errorMsg }
    }

    // Extract domain from apiUrl
    let domain = apiUrl
    try {
      const url = new URL(apiUrl)
      domain = url.hostname
    } catch {
      // If apiUrl is not a valid URL, assume it's already a domain
      domain = apiUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    }

    logger.info(`Connecting to Teniu Cloud: ${domain}`)

    // Get environment variables for octelium
    const octeliumEnv = getOcteliumEnv(domain)

    // Step 1: Login to the cluster
    logger.info('Step 1: Logging in to cluster...')
    try {
      const loginResult = await executeCommand(
        'octelium',
        ['login', '--domain', domain, '--auth-token', apiKey],
        LOGIN_TIMEOUT_MS,
        octeliumEnv
      )
      logger.info(`Login output: ${loginResult.stdout.trim()}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Login failed:', error as Error)
      return { success: false, error: `Login failed: ${errorMsg}` }
    }

    // Step 2: Connect to the cluster (open local tunnel in detached/background mode)
    logger.info('Step 2: Opening local tunnel to cluster...')
    try {
      // Use -d (--detach) to run connect in background
      const connectResult = await executeCommand(
        'octelium',
        ['connect', '-d', '--domain', domain],
        CONNECT_TIMEOUT_MS,
        octeliumEnv
      )
      logger.info(
        `Connect output: ${connectResult.stdout.trim() || connectResult.stderr.trim() || 'Started in background'}`
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Connect failed:', error as Error)
      return { success: false, error: `Connect failed: ${errorMsg}` }
    }

    // Step 3: Verify connection by checking status
    logger.info('Step 3: Verifying connection...')
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait a moment for connection to establish

    const status = await checkStatusWithEnv(domain)
    if (status.connected) {
      logger.info('Successfully connected to Teniu Cloud')
      return { success: true }
    } else {
      logger.warn('Connection verification failed, but command completed')
      // Still return success since commands completed without error
      return { success: true }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to connect to Teniu Cloud:', error as Error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Disconnect from Teniu Cloud using octelium CLI
 * This performs: disconnect (close tunnel) -> logout
 */
export async function disconnect(): Promise<CommandResult> {
  try {
    // Check if octelium is installed
    const installed = await isOcteliumInstalled()
    if (!installed) {
      // Not installed means not connected anyway
      return { success: true }
    }

    logger.info('Disconnecting from Teniu Cloud')

    // Step 1: Disconnect from the cluster (close tunnel)
    try {
      logger.info('Step 1: Closing local tunnel...')
      const result = await executeCommand('octelium', ['disconnect'], LOGIN_TIMEOUT_MS, getOcteliumEnv())
      logger.info(`Disconnect output: ${result.stdout.trim() || result.stderr.trim() || 'Done'}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      // If the error indicates no active connection, continue to logout
      if (
        lowerErrorMsg.includes('not connected') ||
        lowerErrorMsg.includes('no active') ||
        lowerErrorMsg.includes('already disconnected')
      ) {
        logger.info('No active tunnel to close')
      } else {
        // Log but don't fail - still try to logout
        logger.warn('Failed to close tunnel, continuing to logout:', error as Error)
      }
    }

    // Step 2: Logout from the cluster
    try {
      logger.info('Step 2: Logging out from cluster...')
      const result = await executeCommand('octelium', ['logout'], LOGIN_TIMEOUT_MS, getOcteliumEnv())
      logger.info(`Logout output: ${result.stdout.trim() || result.stderr.trim() || 'Done'}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      // If the error indicates no active connection/domain, treat as success
      if (
        lowerErrorMsg.includes('domain is not set') ||
        lowerErrorMsg.includes('domain not set') ||
        lowerErrorMsg.includes('not logged in') ||
        lowerErrorMsg.includes('not connected') ||
        lowerErrorMsg.includes('please authenticate')
      ) {
        logger.info('Already logged out (no active session)')
      } else {
        throw error // Re-throw other errors
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

/**
 * Internal function to check status with optional domain env
 */
async function checkStatusWithEnv(domain?: string): Promise<ConnectionStatus> {
  try {
    // Check if octelium is installed
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { connected: false, error: 'octelium CLI is not installed' }
    }

    // Try to check status using 'octelium status' command
    try {
      const env = getOcteliumEnv(domain)
      const { stdout } = await executeCommand('octelium', ['status'], STATUS_TIMEOUT_MS, env)

      // Check for success indicators in output
      // octelium status shows connection info when connected
      if (stdout.includes('cluster:') || stdout.includes('session:') || stdout.includes('user:')) {
        return { connected: true }
      }

      return { connected: false }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      // If status command fails with these messages, we're not connected
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

      // Other errors - assume not connected
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
 * Get local models from the local API server (智能网关)
 * Fetches models from http://localhost:{port}/v1/models
 */
export async function getLocalModels(): Promise<LocalModelsResult> {
  try {
    // Dynamically import config to avoid circular dependency
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

    // Validate response structure - expect { object: "list", data: [...], total: number }
    const modelList = Array.isArray(data?.data) ? data.data : []
    const total = typeof data?.total === 'number' ? data.total : modelList.length

    // Transform the response to our LocalModel format
    const models: LocalModel[] = modelList.map((model: any) => ({
      id: model.id || '',
      name: model.name || model.id || '',
      provider: model.provider || 'unknown',
      providerName: model.provider_name || model.provider || 'Unknown',
      providerType: model.provider_type || model.provider || 'unknown',
      providerModelId: model.provider_model_id || model.id || ''
    }))

    logger.info(`Fetched ${models.length} local models from gateway`)

    return {
      success: true,
      models,
      total,
      gatewayUrl
    }
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
  getLocalModels
}

export default teniuCloudService
