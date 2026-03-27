import { execFile } from 'node:child_process'

import { loggerService } from '@logger'

const logger = loggerService.withContext('TeniuCloudService')

// Timeout for CLI commands (30 seconds)
const COMMAND_TIMEOUT_MS = 30000

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
  timeoutMs: number = COMMAND_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    execFile(command, args, (error, stdout, stderr) => {
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
 * Connect to Teniu Cloud using octelium CLI
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

    // Execute octelium login command using execFile for safety
    // Pass arguments as array to prevent injection
    await executeCommand('octelium', ['login', '--domain', domain, '--auth-token', apiKey])

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

    // Execute octelium logout command
    await executeCommand('octelium', ['logout'])

    logger.info('Successfully disconnected from Teniu Cloud')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // If the error indicates no active connection/domain, treat as success
    // since we're already disconnected
    const lowerErrorMsg = errorMessage.toLowerCase()
    if (
      lowerErrorMsg.includes('domain is not set') ||
      lowerErrorMsg.includes('domain not set') ||
      lowerErrorMsg.includes('not logged in') ||
      lowerErrorMsg.includes('not connected')
    ) {
      logger.info('No active connection to disconnect (already disconnected)')
      return { success: true }
    }

    logger.error('Failed to disconnect from Teniu Cloud:', error as Error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Check connection status using octelium CLI
 */
export async function checkStatus(): Promise<ConnectionStatus> {
  try {
    // Check if octelium is installed
    const installed = await isOcteliumInstalled()
    if (!installed) {
      return { connected: false, error: 'octelium CLI is not installed' }
    }

    // Try to check status using various possible commands
    // octelium might have: auth status, status, whoami, etc.
    try {
      const { stdout } = await executeCommand('octelium', ['auth', 'status'], 10000)
      const output = stdout.toLowerCase()

      // Check for success indicators in output
      if (output.includes('logged in') || output.includes('authenticated') || output.includes('active')) {
        return { connected: true }
      }

      // If we got here without error, assume connected
      return { connected: true }
    } catch {
      // Try alternative status command
      try {
        await executeCommand('octelium', ['status'], 10000)
        return { connected: true }
      } catch {
        // If both fail, we're not connected
        return { connected: false }
      }
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
