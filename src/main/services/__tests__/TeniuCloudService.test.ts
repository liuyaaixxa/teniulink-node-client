import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock child_process
const mockExecFile = vi.fn()
const mockSpawn = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  spawn: (...args: any[]) => mockSpawn(...args)
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
    getSessionCookie: vi.fn(() => 'test-session-cookie'),
    getUserId: vi.fn(() => 1)
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

const { resolveServiceName, installOctelium, connect, disconnect, getDeviceTokenKey } = await import(
  '../TeniuCloudService'
)

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

  describe('connect (spawn detached)', () => {
    it('should spawn connect with --serve when serviceName is provided', async () => {
      // which → found, logout → ok, login → ok, which → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Logged out' },
        { stdout: 'Logged in' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const mockChild = { on: vi.fn(), unref: vi.fn() }
      mockSpawn.mockReturnValue(mockChild)

      const result = await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-prd12test02')
      expect(result.success).toBe(true)

      // Verify spawn was called with correct args
      expect(mockSpawn).toHaveBeenCalledWith(
        'octelium',
        expect.arrayContaining(['connect', '--serve', 'admin-prd12test02', '--auth-token', 'test-auth-token']),
        expect.objectContaining({ detached: true, stdio: 'ignore' })
      )
      expect(mockChild.unref).toHaveBeenCalled()
    })

    it('should call logout then login before spawning connect', async () => {
      // which → found, logout → ok, login → ok, which → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Logged out' },
        { stdout: 'Logged in' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const mockChild = { on: vi.fn(), unref: vi.fn() }
      mockSpawn.mockReturnValue(mockChild)

      await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-test')

      // Verify logout was called
      const logoutCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.[0] === 'logout'
      )
      expect(logoutCall).toBeTruthy()

      // Verify login was called with --domain and --auth-token
      const loginCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.[0] === 'login'
      )
      expect(loginCall).toBeTruthy()
      expect(loginCall![1]).toContain('--domain')
      expect(loginCall![1]).toContain('teniuapi.cloud')
      expect(loginCall![1]).toContain('--auth-token=test-auth-token')
    })

    it('should proceed with connect when pre-connect logout or login fails', async () => {
      // which → found, logout → error, login → error, which → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { error: 'not logged in' },
        { error: 'login failed' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const mockChild = { on: vi.fn(), unref: vi.fn() }
      mockSpawn.mockReturnValue(mockChild)

      const result = await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-test')
      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalled()
    })

    it('should spawn connect without --serve when no serviceName', async () => {
      // which → found, logout → ok, login → ok, which → found, status → connected
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Logged out' },
        { stdout: 'Logged in' },
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'cluster: teniuapi.cloud\nsession: abc\nuser: admin' }
      ])

      const mockChild = { on: vi.fn(), unref: vi.fn() }
      mockSpawn.mockReturnValue(mockChild)

      const result = await connect('https://teniuapi.cloud', 'test-auth-token')
      expect(result.success).toBe(true)

      const spawnArgs = mockSpawn.mock.calls[0][1]
      expect(spawnArgs).not.toContain('--serve')
    })

    it('should return error when octelium is not installed and install fails', async () => {
      // which → not found, brew → not found
      mockExecFileError('not found')

      const result = await connect('https://teniuapi.cloud', 'test-auth-token', 'admin-prd12test02')
      expect(result.success).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should run disconnect with logout and killall cleanup', async () => {
      // which → found, disconnect → success, logout → success, killall → success, ps → clean
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Disconnected' },
        { stdout: 'Logged out' },
        { stdout: '' },
        { stdout: 'UID  PID  PPID  C STIME TTY TIME CMD\nroot 1 0 0 Jan01 ? 00:00:00 /sbin/init' }
      ])

      const result = await disconnect()
      expect(result.success).toBe(true)

      const disconnectCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.includes('disconnect')
      )
      expect(disconnectCall![1]).toEqual(['disconnect', '--logout'])

      const logoutCall = mockExecFile.mock.calls.find(
        (call: any[]) => call[0] === 'octelium' && call[1]?.[0] === 'logout'
      )
      expect(logoutCall).toBeTruthy()

      const killallCall = mockExecFile.mock.calls.find((call: any[]) => call[0] === 'pkill' && call[1]?.includes('-f'))
      expect(killallCall![1]).toEqual(['-9', '-f', 'octelium connect'])
    })

    it('should force kill remaining octelium processes after disconnect', async () => {
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

      // which → found, disconnect → success, logout → success, killall → success, ps → has straggler
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Disconnected' },
        { stdout: 'Logged out' },
        { stdout: '' },
        {
          stdout: 'UID  PID  PPID  C STIME TTY TIME CMD\nuser 12345 1 0 Jan01 ? 00:00:00 octelium connect --serve test'
        }
      ])

      const result = await disconnect()
      expect(result.success).toBe(true)
      expect(killSpy).toHaveBeenCalledWith(12345, 'SIGKILL')

      killSpy.mockRestore()
    })

    it('should succeed when killall cleans all processes', async () => {
      // which → found, disconnect → success, logout → error, killall → success, ps → clean
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Disconnected' },
        { error: 'not logged in' },
        { stdout: '' },
        { stdout: 'UID  PID  PPID  C STIME TTY TIME CMD\nroot 1 0 0 Jan01 ? 00:00:00 /sbin/init' }
      ])

      const result = await disconnect()
      expect(result.success).toBe(true)
    })

    it('should succeed when killall and ps both fail', async () => {
      // which → found, disconnect → success, logout → error, killall → error, ps → error
      mockExecFileSequence([
        { stdout: '/usr/local/bin/octelium' },
        { stdout: 'Disconnected' },
        { error: 'not logged in' },
        { error: 'No matching processes' },
        { error: 'ps command not found' }
      ])

      const result = await disconnect()
      expect(result.success).toBe(true)
    })

    it('should succeed when octelium is not installed', async () => {
      mockExecFileError('not found')

      const result = await disconnect()
      expect(result.success).toBe(true)
    })
  })

  describe('getDeviceTokenKey', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should return token key on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { token: 'full-plaintext-token-123' } })
      })

      const result = await getDeviceTokenKey(1)
      expect(result.success).toBe(true)
      expect(result.token).toBe('full-plaintext-token-123')
    })

    it('should handle key field in response data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { key: 'token-from-key-field' } })
      })

      const result = await getDeviceTokenKey(2)
      expect(result.success).toBe(true)
      expect(result.token).toBe('token-from-key-field')
    })

    it('should return error on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      const result = await getDeviceTokenKey(1)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Session expired')
    })

    it('should return error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await getDeviceTokenKey(1)
      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 500')
    })

    it('should return error when not logged in', async () => {
      // Override the mock to return null cookie
      const { authService } = await import('../AuthService')
      vi.mocked(authService.getSessionCookie).mockReturnValueOnce(null)

      const result = await getDeviceTokenKey(1)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Not logged in')
    })

    it('should return error when API returns success=false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, message: 'Device not found' })
      })

      const result = await getDeviceTokenKey(999)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Device not found')
    })

    it('should return error when token is missing from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} })
      })

      const result = await getDeviceTokenKey(1)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Token key not found')
    })
  })
})
