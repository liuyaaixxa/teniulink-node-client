import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

// We need to import after mocks
const { authService } = await import('../AuthService')

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should return success when API responds with token', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ token: 'test-token', user: { username: 'testuser' } }),
        text: () => Promise.resolve('')
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await authService.login('testuser', 'password123')
      expect(result.success).toBe(true)
      expect(result.token).toBe('test-token')
      expect(result.user?.username).toBe('testuser')
    })

    it('should return error when API responds with non-ok status', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await authService.login('testuser', 'wrongpass')
      expect(result.success).toBe(false)
      expect(result.error).toContain('401')
    })

    it('should return error on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await authService.login('testuser', 'password123')
      expect(result.success).toBe(false)
      expect(result.error).toBe('ECONNREFUSED')
    })
  })

  describe('logout', () => {
    it('should return success', async () => {
      const result = await authService.logout()
      expect(result.success).toBe(true)
    })
  })

  describe('checkAuth', () => {
    it('should return invalid when no token provided', async () => {
      // Clear any stored token first
      await authService.logout()
      const result = await authService.checkAuth()
      expect(result.valid).toBe(false)
    })

    it('should return valid when token is provided', async () => {
      const result = await authService.checkAuth('some-token')
      expect(result.valid).toBe(true)
    })
  })
})
