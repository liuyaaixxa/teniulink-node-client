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

  describe('validateToken', () => {
    it('should return success when API responds with valid user data', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, username: 'testuser', display_name: 'Test User' }
          })
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await authService.validateToken('valid-access-token')
      expect(result.success).toBe(true)
      expect(result.user?.username).toBe('testuser')
      expect(result.user?.id).toBe(1)
    })

    it('should return error when API responds with success=false', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            message: 'Invalid token'
          })
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await authService.validateToken('invalid-token')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('should return error when API responds with non-ok status', async () => {
      const mockResponse = {
        ok: false,
        status: 401
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await authService.validateToken('expired-token')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid access token')
    })

    it('should return error on network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await authService.validateToken('some-token')
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
