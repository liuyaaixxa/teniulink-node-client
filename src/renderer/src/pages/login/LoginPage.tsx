import { useAppDispatch } from '@renderer/store'
import { setAuthLogin } from '@renderer/store/settings'
import { Button, Divider, Input, message } from 'antd'
import { Globe, Key } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

// Stable node positions for the blockchain network background
const NODES = [
  { x: 8, y: 12 },
  { x: 25, y: 8 },
  { x: 45, y: 15 },
  { x: 70, y: 10 },
  { x: 88, y: 18 },
  { x: 15, y: 35 },
  { x: 38, y: 42 },
  { x: 62, y: 38 },
  { x: 82, y: 45 },
  { x: 95, y: 32 },
  { x: 5, y: 58 },
  { x: 22, y: 65 },
  { x: 50, y: 60 },
  { x: 75, y: 62 },
  { x: 92, y: 55 },
  { x: 12, y: 82 },
  { x: 35, y: 85 },
  { x: 55, y: 78 },
  { x: 78, y: 88 },
  { x: 90, y: 75 }
]

// Connect nodes that are reasonably close (within 30% distance)
const EDGES: [number, number][] = []
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const dx = NODES[i].x - NODES[j].x
    const dy = NODES[i].y - NODES[j].y
    if (Math.sqrt(dx * dx + dy * dy) < 30) {
      EDGES.push([i, j])
    }
  }
}

const LoginPage: FC = () => {
  const [tokenInput, setTokenInput] = useState('')
  const [tokenLoginLoading, setTokenLoginLoading] = useState(false)
  const [browserLoginLoading, setBrowserLoginLoading] = useState(false)
  const browserLoginStateRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  // Cleanup browser login listener on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const handleBrowserLogin = useCallback(async () => {
    setBrowserLoginLoading(true)

    try {
      const result = await window.api.authStartBrowserLogin()
      if (!result.success || !result.state) {
        message.error(result.error || t('login_page.browser_login_failed'))
        setBrowserLoginLoading(false)
        return
      }

      browserLoginStateRef.current = result.state

      // Listen for deep link callback
      const removeListener = window.api.protocol.onReceiveData(async (data) => {
        try {
          const url = new URL(data.url)
          if (url.hostname !== 'auth') return

          const params = new URLSearchParams(url.search)
          const code = params.get('code')
          const returnedState = params.get('state')

          if (!code || !returnedState || returnedState !== browserLoginStateRef.current) return

          const exchangeResult = await window.api.authExchangeDesktopCode(code, returnedState)

          if (exchangeResult.success && exchangeResult.access_token && exchangeResult.user) {
            dispatch(
              setAuthLogin({
                username: exchangeResult.user.username,
                token: exchangeResult.access_token,
                loginTime: new Date().toISOString(),
                userId: exchangeResult.user.id
              })
            )
            message.success(t('login_page.browser_login_success'))
          } else {
            message.error(exchangeResult.error || t('login_page.browser_login_failed'))
          }
        } catch {
          message.error(t('login_page.error_network'))
        } finally {
          setBrowserLoginLoading(false)
          cleanup()
        }
      })

      // Timeout after 10 minutes
      const timeoutId = setTimeout(
        () => {
          message.warning(t('login_page.browser_login_timeout'))
          setBrowserLoginLoading(false)
          cleanup()
        },
        10 * 60 * 1000
      )

      const cleanup = () => {
        removeListener()
        clearTimeout(timeoutId)
        browserLoginStateRef.current = null
        cleanupRef.current = null
      }

      cleanupRef.current = cleanup
    } catch {
      message.error(t('login_page.error_network'))
      setBrowserLoginLoading(false)
    }
  }, [dispatch, t])

  const handleTokenLogin = useCallback(async () => {
    const token = tokenInput.trim()
    if (!token) {
      message.warning(t('login_page.token_required'))
      return
    }

    setTokenLoginLoading(true)
    try {
      const result = await window.api.authValidateToken(token)
      if (result.success && result.user) {
        dispatch(
          setAuthLogin({
            username: result.user.username,
            token,
            loginTime: new Date().toISOString(),
            userId: result.user.id
          })
        )
        message.success(t('login_page.token_login_success'))
      } else {
        message.error(result.error || t('login_page.token_invalid'))
      }
    } catch {
      message.error(t('login_page.error_network'))
    } finally {
      setTokenLoginLoading(false)
    }
  }, [tokenInput, dispatch, t])

  const networkSvg = useMemo(
    () => (
      <NetworkBg viewBox="0 0 100 100" preserveAspectRatio="none">
        {EDGES.map(([a, b], i) => (
          <NetworkLine key={`e${i}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} $delay={i * 0.3} />
        ))}
        {NODES.map((n, i) => (
          <NetworkNode key={`n${i}`} cx={n.x} cy={n.y} r={0.6} $delay={i * 0.2} />
        ))}
      </NetworkBg>
    ),
    []
  )

  return (
    <PageContainer>
      <GlowBg />
      {networkSvg}
      <LoginCard>
        <CardGlow />
        <CardContent>
          <LogoSection>
            <BrandName>
              {t('login_page.brand_name_prefix')}
              <BrandHighlight>{t('login_page.brand_name_highlight')}</BrandHighlight>
            </BrandName>
            <Subtitle>{t('login_page.subtitle')}</Subtitle>
          </LogoSection>
          <FormSection>
            <BrowserLoginButton
              icon={<Globe size={14} />}
              onClick={handleBrowserLogin}
              loading={browserLoginLoading}
              block>
              {browserLoginLoading ? t('login_page.browser_login_waiting') : t('login_page.browser_login')}
            </BrowserLoginButton>
            <StyledDivider>{t('login_page.or_divider', 'OR')}</StyledDivider>
            <TokenInputGroup>
              <StyledInput
                prefix={<Key size={14} color="#64748b" />}
                placeholder={t('login_page.token_placeholder')}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onPressEnter={handleTokenLogin}
              />
              <TokenLoginButton type="primary" onClick={handleTokenLogin} loading={tokenLoginLoading} block>
                {t('login_page.token_login')}
              </TokenLoginButton>
            </TokenInputGroup>
          </FormSection>
          <StatusBadge>
            <StatusDot />
            <span>{t('login_page.network_badge')}</span>
          </StatusBadge>
        </CardContent>
      </LoginCard>
    </PageContainer>
  )
}

const glowPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`

const linePulse = keyframes`
  0%, 100% { opacity: 0.06; stroke: #00ff88; }
  50% { opacity: 0.2; stroke: #00a8ff; }
`

const nodePulse = keyframes`
  0%, 100% { opacity: 0.3; r: 0.5; }
  50% { opacity: 0.8; r: 0.8; }
`

const dotPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`

const PageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: #050508;
  position: relative;
  overflow: hidden;
  -webkit-app-region: drag;
`

const GlowBg = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(0, 255, 136, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(0, 168, 255, 0.06) 0%, transparent 50%);
  animation: ${glowPulse} 6s ease-in-out infinite;
  pointer-events: none;
`

const NetworkBg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`

const NetworkLine = styled.line<{ $delay: number }>`
  stroke-width: 0.15;
  animation: ${linePulse} ${() => 4 + Math.random() * 3}s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`

const NetworkNode = styled.circle<{ $delay: number }>`
  fill: #00ff88;
  animation: ${nodePulse} ${() => 3 + Math.random() * 2}s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`

const LoginCard = styled.div`
  position: relative;
  z-index: 1;
  width: 320px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(15, 15, 25, 0.95), rgba(8, 8, 16, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.6),
    0 8px 16px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  -webkit-app-region: none;
  overflow: hidden;
`

const CardGlow = styled.div`
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.5), rgba(0, 168, 255, 0.5), transparent);
`

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 28px 20px;
`

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 24px;
`

const BrandName = styled.div`
  font-size: 20px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.5px;
`

const BrandHighlight = styled.span`
  background: linear-gradient(135deg, #00ff88, #00a8ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`

const Subtitle = styled.div`
  font-size: 11px;
  color: #64748b;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 4px;
`

const FormSection = styled.div`
  width: 100%;
  margin-top: 4px;
`

const inputStyles = `
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 10px !important;
  color: #ffffff !important;
  height: 38px;
  &:hover,
  &:focus,
  &.ant-input-affix-wrapper-focused {
    border-color: rgba(0, 255, 136, 0.4) !important;
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.08) !important;
  }
  &::placeholder {
    color: #475569 !important;
  }
  .ant-input {
    background: transparent !important;
    color: #ffffff !important;
    &::placeholder {
      color: #475569 !important;
    }
  }
`

const StyledInput = styled(Input)`
  ${inputStyles}
`

const TokenInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const TokenLoginButton = styled(Button)`
  height: 38px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #94a3b8 !important;
  transition: all 0.3s;
  &:hover {
    border-color: rgba(0, 255, 136, 0.4) !important;
    color: #e2e8f0 !important;
    background: rgba(255, 255, 255, 0.06) !important;
  }
`

const StyledDivider = styled(Divider)`
  &.ant-divider {
    margin: 12px 0;
    border-color: rgba(255, 255, 255, 0.08);
    .ant-divider-inner-text {
      font-size: 11px;
      color: #475569;
      padding: 0 12px;
    }
  }
`

const BrowserLoginButton = styled(Button)`
  height: 38px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  background: linear-gradient(135deg, #00ff88, #00a8ff) !important;
  border: none !important;
  color: #050508 !important;
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.2);
  transition: all 0.3s;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(0, 255, 136, 0.35) !important;
  }
  &:active {
    transform: translateY(0);
  }
  .anticon,
  .lucide {
    color: #050508;
  }
`

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 4px 12px;
  background: rgba(0, 255, 136, 0.06);
  border: 1px solid rgba(0, 255, 136, 0.15);
  border-radius: 20px;
  font-size: 11px;
  color: #64748b;
`

const StatusDot = styled.div`
  width: 6px;
  height: 6px;
  background: #00ff88;
  border-radius: 50%;
  animation: ${dotPulse} 2s infinite;
`

export default LoginPage
