import { execFile } from 'node:child_process'

import { loggerService } from '@logger'

const logger = loggerService.withContext('TeniuCloudService')

// Timeout for CLI commands (30 seconds for login/connect, 10 seconds for status)
const COMMAND_TIMEOUT_MS = 30000
const STATUS_TIMEOUT_MS = 10000

interface CommandResult {
  success: boolean
  error?: string
}

interface ConnectionStatus {
  connected: boolean
  error?: string
}

/**
 * Execute a command with arguments using execFile (safer than exec)
 * Uses execFile to prevent shell injection
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

    execFile(command, args, { env: execEnv }, (error, stdout, stderr) => {
      clearTimeout(timeout)
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
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
    // On macOS/Linux, also try command -v
    try {
      await executeCommand('command', ['-v', 'octelium'], 5000)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Get environment variables for octelium commands
 */
function getOcteliumEnv(domain: string): NodeJS.ProcessEnv {
  return {
    OCTELIUM_INSECURE_TLS: 'true',
    OCTELIUM_DOMAIN: domain
  }
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
    await executeCommand(
      'octelium',
      ['login', '--domain', domain, '--auth-token', apiKey],
      COMMAND_TIMEOUT_MS,
      octeliumEnv
    )
    logger.info('Login successful')

    // Step 2: Connect to the cluster (open local tunnel)
    logger.info('Step 2: Opening local tunnel to cluster...')
    await executeCommand('octelium', ['connect', '--domain', domain], COMMAND_TIMEOUT_MS, octeliumEnv)
    logger.info('Local tunnel established')

    logger.info('Successfully connected to Teniu Cloud')
    return { success: true }
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
      await executeCommand('octelium', ['disconnect'], COMMAND_TIMEOUT_MS)
      logger.info('Local tunnel closed')
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
      await executeCommand('octelium', ['logout'], COMMAND_TIMEOUT_MS)
      logger.info('Logout successful')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const lowerErrorMsg = errorMsg.toLowerCase()

      // If the error indicates no active connection/domain, treat as success
      if (
        lowerErrorMsg.includes('domain is not set') ||
        lowerErrorMsg.includes('domain not set') ||
        lowerErrorMsg.includes('not logged in') ||
        lowerErrorMsg.includes('not connected')
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
 * Uses 'octelium status' command to check if connected
 */
export async function checkStatus(): Promise<ConnectionStatus> {
  try {
    // Check if octelium is installed
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { connected: false, error: 'octelium CLI is not installed' }
    }

    // Try to check status using 'octelium status' command
    try {
      const { stdout } = await executeCommand('octelium', ['status'], STATUS_TIMEOUT_MS)
      const output = stdout.toLowerCase()

      // Check for success indicators in output
      // octelium status shows connection info when connected
      if (
        output.includes('connected') ||
        output.includes('logged in') ||
        output.includes('cluster:') ||
        output.includes('user:') ||
        output.includes('tenant:')
      ) {
        return { connected: true }
      }

      // If we got output without error, likely connected
      if (stdout.trim().length > 0) {
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
        lowerErrorMsg.includes('no cluster')
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

export const teniuCloudService = {
  connect,
  disconnect,
  checkStatus
}

export default teniuCloudService
