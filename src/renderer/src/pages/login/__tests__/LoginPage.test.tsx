import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Ant Design's responsive observer requires matchMedia in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

vi.mock('@renderer/store', () => ({
  useAppDispatch: () => vi.fn()
}))

vi.mock('@renderer/hooks/useSettings', () => ({
  useSettings: () => ({
    auth: { isLoggedIn: false, username: '', loginTime: '', token: '' }
  })
}))

vi.mock('@renderer/store/settings', () => ({
  setAuthLogin: vi.fn(),
  setAuthLogout: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

describe('LoginPage', () => {
  it('should render login form with username and password fields', async () => {
    const { default: LoginPage } = await import('../LoginPage')
    render(<LoginPage />)

    expect(screen.getByPlaceholderText('login_page.username_placeholder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('login_page.password_placeholder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login_page\.submit_button/i })).toBeInTheDocument()
  })

  it('should render brand name', async () => {
    const { default: LoginPage } = await import('../LoginPage')
    render(<LoginPage />)

    expect(screen.getByText('login_page.brand_name_highlight')).toBeInTheDocument()
  })

  it('should render subtitle text', async () => {
    const { default: LoginPage } = await import('../LoginPage')
    render(<LoginPage />)

    expect(screen.getByText('login_page.subtitle')).toBeInTheDocument()
  })
})
