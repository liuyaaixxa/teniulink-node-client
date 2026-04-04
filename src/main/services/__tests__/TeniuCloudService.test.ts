import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock child_process
const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args)
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('@shared/config/constant', () => ({
  API_SERVER_DEFAULTS: { HOST: '127.0.0.1', PORT: 23333 }
}))

vi.mock('../AuthService', () => ({
  authService: {
    getSessionCookie: vi.fn(() => 'test-session-cookie')
  }
}))

// Helper to simulate execFile behavior
function mockExecFileError(message: string) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      cb(new Error(message), '', message)
    }
  )
}

function mockExecFileSequence(results: Array<{ stdout?: string; stderr?: string; error?: string }>) {
  let callIndex = 0
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      const result = results[callIndex] || results[results.length - 1]
      callIndex++
      if (result.error) {
        cb(new Error(result.error), '', result.error)
      } else {
        cb(null, result.stdout || '', result.stderr || '')
      }
    }
  )
}

const { resolveServiceName, installOctelium, connect, disconnect } = await import('../TeniuCloudService')

describe('TeniuCloudService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('resolveServiceName', () => {
    const tokens = [
      { id: 1, name: 'prd12test02', tokenMask: 'AQpA****BzBG', domain: 'teniuapi.cloud', status: 1 },
      { id: 2, name: 'home-server', tokenMask: 'XYZ1****9abc', domain: 'teniuapi.cloud', status: 1 },
      { id: 3, name: 'disabled-device', tokenMask: 'AAAA****BBBB', domain: 'teniuapi.cloud', status: 2 }
    ]

    it('should match token by prefix and suffix and construct service name', () => {
      const result = resolveServiceName('AQpA_some_long_token_BzBG', 'admin', tokens)
      expect(result).toBe('admin-prd12test02')
    })

    it('should normalize service name: lowercase, spaces/underscores to hyphens', () => {
      const tokensWithSpaces = [
        { id: 1, name: 'Home Server', tokenMask: 'TEST****ENDx', domain: 'teniuapi.cloud', status: 1 }
      ]
      const result = resolveServiceName('TEST_middle_content_ENDx', 'John_Doe', tokensWithSpaces)
      expect(result).toBe('john-doe-home-server')
    })

    it('should return null when no tokens provided', () => {
      const result = resolveServiceName('AQpA_token_BzBG', 'admin', [])
      expect(result).toBeNull()
    })

    it('should return null when apiKey is empty', () => {
      const result = resolveServiceName('', 'admin', tokens)
      expect(result).toBeNull()
    })

    it('should fall back to single active token when no mask matches', () => {
      const singleActive = [
        { id: 1, name: 'only-device', tokenMask: 'ZZZZ****WWWW', domain: 'teniuapi.cloud', status: 1 }
      ]
      const result = resolveServiceName('XXXX_no_match_YYYY', 'admin', singleActive)
      expect(result).toBe('admin-only-device')
    })

    it('should return null when multiple tokens and no match', () => {
      const result = resolveServiceName('XXXX_no_match_YYYY', 'admin', tokens)
      expect(result).toBeNull()
    })

    it('should truncate service name to 64 characters', () => {
      const longToken = [
        {
          id: 1,
          name: 'a'.repeat(70),
          tokenMask: 'TEST****ENDx',
          domain: 'teniuapi.cloud',
          status: 1
        }
      ]
      const result = resolveServiceName('TEST_content_ENDx', 'admin', longToken)
      expect(result).not.toBeNull()
      expect(result!.length).toBeLessThanOrEqual(64)
    })
  })

  describe('installOctelium', () => {
    it('should attempt brew install on macOS', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      // which brew → success, brew install → success
      mockExecFileSequence([{ stdout: '/usr/local/bin/brew' }, { stdout: 'installed' }])

      const result = await installOctelium()
      expect(result.success).toBe(true)

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should fail on macOS when brew is not installed', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      mockExecFileError('not found')

      const result = await installOctelium()
      expect(result.success).toBe(false)
      expect(result.error).toContain('Homebrew')

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should return error for unsupported platform', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const result = await installOctelium()
      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })
  })

  describe('connect (execFile with --serve)', () => {
    it('should connect with --serve when serviceName is provided', async () => {
      // which octelium → found, connect → success, which octelium → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Connected' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const result = await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-prd12test02')
      expect(result.success).toBe(true)

      // Verify the connect command includes --serve
      const connectCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.includes('connect')
      )
      expect(connectCall).toBeDefined()
      expect(connectCall![1]).toContain('--serve')
      expect(connectCall![1]).toContain('admin-prd12test02')
      expect(connectCall![1]).toContain('--auth-token')
      expect(connectCall![1]).toContain('test-auth-token')
    })

    it('should connect without --serve when no serviceName', async () => {
      // which → found, connect → success, which → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Connected' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const result = await connect('https://teniuapi.cloud', 'test-auth-token')
      expect(result.success).toBe(true)

      const connectCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.includes('connect')
      )
      expect(connectCall![1]).not.toContain('--serve')
    })

    it('should return error when connect command fails', async () => {
      // which → found, connect → fail
      mockExecFileSequence([{ stdout: '/usr/local/bin/octelium' }, { error: 'connection refused' }])

      const result = await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-prd12test02')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Connect failed')
    })
  })

  describe('disconnect', () => {
    it('should use --serve flag when serviceName is provided', async () => {
      // which → found, disconnect --serve → success
      mockExecFileSequence([{ stdout: '/usr/local/bin/octelium' }, { stdout: 'Disconnected' }])

      const result = await disconnect('admin-prd12test02')
      expect(result.success).toBe(true)

      const disconnectCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.includes('disconnect')
      )
      expect(disconnectCall![1]).toContain('--serve')
      expect(disconnectCall![1]).toContain('admin-prd12test02')
    })

    it('should fall back to bare disconnect when --serve fails', async () => {
      // which → found, disconnect --serve → fail, disconnect → success
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { error: 'unknown flag: --serve' },
        { stdout: 'Disconnected' }
      ])

      const result = await disconnect('admin-prd12test02')
      expect(result.success).toBe(true)
    })

    it('should use bare disconnect when no serviceName provided', async () => {
      // which → found, disconnect → success
      mockExecFileSequence([{ stdout: '/usr/local/bin/octelium' }, { stdout: 'Disconnected' }])

      const result = await disconnect()
      expect(result.success).toBe(true)

      const disconnectCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.includes('disconnect')
      )
      expect(disconnectCall![1]).not.toContain('--serve')
    })

    it('should succeed when octelium is not installed', async () => {
      mockExecFileError('not found')

      const result = await disconnect()
      expect(result.success).toBe(true)
    })
  })
})
