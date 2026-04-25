import { useAppDispatch } from '@renderer/store'
import { setAuthLogin } from '@renderer/store/settings'
import { Button, Divider, Input, message } from 'antd'
import { Globe, Key } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { keyframes } from 'styled-components'

const LoginPage: FC = () => {
  const [tokenInput, setTokenInput] = useState('')
  const [tokenLoginLoading, setTokenLoginLoading] = useState(false)
  const [browserLoginLoading, setBrowserLoginLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const browserLoginStateRef = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!browserLoginLoading || countdown <= 0) return
    if (countdown === 1) {
      const timer = setTimeout(() => {
        setCountdown(0)
        setBrowserLoginLoading(false)
        cleanupRef.current?.()
      }, 1000)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, browserLoginLoading])

  const handleBrowserLogin = useCallback(async () => {
    setBrowserLoginLoading(true)
    setCountdown(180)

    try {
      const result = await window.api.authStartBrowserLogin()
      if (!result.success || !result.state) {
        message.error(result.error || t('login_page.browser_login_failed'))
        setBrowserLoginLoading(false)
        setCountdown(0)
        return
      }

      browserLoginStateRef.current = result.state

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
          setCountdown(0)
          cleanup()
        }
      })

      const cleanup = () => {
        removeListener()
        browserLoginStateRef.current = null
        cleanupRef.current = null
      }

      cleanupRef.current = cleanup
    } catch {
      message.error(t('login_page.error_network'))
      setBrowserLoginLoading(false)
      setCountdown(0)
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

  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => (
        <Sparkle
          key={i}
          $left={5 + Math.random() * 90}
          $bottom={10 + Math.random() * 40}
          $size={2 + Math.random() * 3}
          $duration={3 + Math.random() * 4}
          $delay={Math.random() * 5}
        />
      )),
    []
  )

  return (
    <PageContainer>
      <SkyBg />
      <SunGlow />
      {sparkles}
      <WaveSvg viewBox="0 0 1440 320" preserveAspectRatio="none">
        <WavePath
          $animDuration={8}
          d="M0,160 C120,200 240,100 360,120 C480,140 600,220 720,180 C840,140 960,100 1080,140 C1200,180 1320,220 1440,180 L1440,320 L0,320 Z"
          $color="#38bdf8"
          $opacity={0.25}
        />
        <WavePath
          $animDuration={6}
          $animOffset={-2}
          d="M0,120 C100,80 200,160 300,140 C400,120 500,60 600,100 C700,140 800,180 900,140 C1000,100 1100,60 1200,100 C1300,140 1400,160 1440,130 L1440,320 L0,320 Z"
          $color="#7dd3fc"
          $opacity={0.2}
        />
        <WavePath
          $animDuration={7}
          $animOffset={-4}
          d="M0,100 C80,70 160,130 240,100 C320,70 400,130 480,100 C560,70 640,130 720,100 C800,70 880,130 960,100 C1040,70 1120,130 1200,100 C1280,70 1360,130 1440,100 L1440,320 L0,320 Z"
          $color="#bae6fd"
          $opacity={0.15}
        />
      </WaveSvg>
      <LoginCard>
        <CardGlow />
        <CardContent>
          <LogoSection>
            <AiIcon>
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                <polygon
                  points="16,2 28,8 28,20 16,26 4,20 4,8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  opacity="0.9"
                />
                <circle cx="12" cy="10" r="1.6" fill="#fff" opacity="0.8" />
                <circle cx="20" cy="10" r="1.6" fill="#fff" opacity="0.8" />
                <circle cx="9" cy="16" r="1.6" fill="#fff" opacity="0.8" />
                <circle cx="23" cy="16" r="1.6" fill="#fff" opacity="0.8" />
                <circle cx="16" cy="21" r="1.6" fill="#fff" opacity="0.8" />
                <line x1="12" y1="10" x2="20" y2="10" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
                <line x1="12" y1="10" x2="9" y2="16" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
                <line x1="20" y1="10" x2="23" y2="16" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
                <line x1="9" y1="16" x2="16" y2="21" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
                <line x1="23" y1="16" x2="16" y2="21" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
              </svg>
            </AiIcon>
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
              {browserLoginLoading
                ? `${t('login_page.browser_login_waiting')} (${countdown}s)`
                : t('login_page.browser_login')}
            </BrowserLoginButton>
            <StyledDivider>{t('login_page.or_divider', 'OR')}</StyledDivider>
            <TokenInputGroup>
              <TokenInput
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

const sunPulse = keyframes`
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
`

const waveSlide = keyframes`
  0% { transform: translateX(0) translateY(0); }
  50% { transform: translateX(-25%) translateY(6px); }
  100% { transform: translateX(-50%) translateY(0); }
`

const sparkleFloat = keyframes`
  0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.1; }
  25% { transform: translateY(-50px) translateX(10px) scale(1.8); opacity: 0.7; }
  50% { transform: translateY(-25px) translateX(-8px) scale(1.1); opacity: 0.3; }
  75% { transform: translateY(-65px) translateX(15px) scale(1.5); opacity: 0.5; }
`

const iconGlow = keyframes`
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
`

const dotPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`

const PageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 15%, #bae6fd 45%, #7dd3fc 75%, #38bdf8 100%);
  position: relative;
  overflow: hidden;
  -webkit-app-region: drag;
`

const SkyBg = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #f8faff 0%, #e0f2fe 30%, #bae6fd 60%, #7dd3fc 100%);
  pointer-events: none;
`

const SunGlow = styled.div`
  position: absolute;
  top: -40px;
  right: 12%;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(253, 224, 71, 0.15) 30%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
  animation: ${sunPulse} 6s ease-in-out infinite;
`

const Sparkle = styled.div<{ $left: number; $bottom: number; $size: number; $duration: number; $delay: number }>`
  position: absolute;
  left: ${({ $left }) => $left}%;
  bottom: ${({ $bottom }) => $bottom}%;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.65);
  pointer-events: none;
  animation: ${sparkleFloat} ${({ $duration }) => $duration}s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`

const WaveSvg = styled.svg`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 200%;
  height: 240px;
  pointer-events: none;
`

const WavePath = styled.path<{ $animDuration: number; $animOffset?: number; $color: string; $opacity: number }>`
  fill: ${({ $color }) => $color};
  opacity: ${({ $opacity }) => $opacity};
  animation: ${waveSlide} ${({ $animDuration }) => $animDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  animation-delay: ${({ $animOffset }) => $animOffset ?? 0}s;
`

const LoginCard = styled.div`
  position: relative;
  z-index: 1;
  width: 330px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    0 0 60px rgba(14, 165, 233, 0.1),
    0 8px 40px rgba(2, 132, 199, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  -webkit-app-region: none;
  overflow: hidden;
`

const CardGlow = styled.div`
  position: absolute;
  top: -1px;
  left: 15%;
  right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.5), rgba(2, 132, 199, 0.5), transparent);
`

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 34px 30px 26px;
`

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 26px;
`

const AiIcon = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
  position: relative;
  box-shadow: 0 4px 20px rgba(14, 165, 233, 0.3);
  &::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 21px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(2, 132, 199, 0.2));
    filter: blur(10px);
    z-index: -1;
    animation: ${iconGlow} 3s ease-in-out infinite;
  }
`

const BrandName = styled.div`
  font-size: 21px;
  font-weight: 700;
  color: #0c1929;
  letter-spacing: -0.3px;
`

const BrandHighlight = styled.span`
  background: linear-gradient(135deg, #0284c7, #0ea5e9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`

const Subtitle = styled.div`
  font-size: 10px;
  color: #64748b;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-top: 5px;
`

const FormSection = styled.div`
  width: 100%;
  margin-top: 4px;
`

const BrowserLoginButton = styled(Button)`
  height: 44px;
  border-radius: 13px;
  font-weight: 600;
  font-size: 13.5px;
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
  border: none !important;
  color: #fff !important;
  box-shadow: 0 4px 24px rgba(14, 165, 233, 0.3);
  transition: all 0.25s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 32px rgba(14, 165, 233, 0.45) !important;
  }
  &:active {
    transform: translateY(0);
  }
  .anticon,
  .lucide {
    color: #fff;
  }
`

const inputStyles = `
  background: rgba(255, 255, 255, 0.55) !important;
  border: 1px solid rgba(2, 132, 199, 0.18) !important;
  border-radius: 12px !important;
  color: #0c1929 !important;
  height: 44px;
  &:hover {
    border-color: rgba(2, 132, 199, 0.35) !important;
  }
  &:focus,
  &.ant-input-affix-wrapper-focused {
    border-color: rgba(14, 165, 233, 0.55) !important;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1), 0 0 20px rgba(14, 165, 233, 0.06) !important;
  }
  &::placeholder {
    color: #94a3b8 !important;
  }
  .ant-input {
    background: transparent !important;
    color: #0c1929 !important;
    &::placeholder {
      color: #94a3b8 !important;
    }
  }
`

const TokenInput = styled(Input)`
  ${inputStyles}
`

const TokenInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const TokenLoginButton = styled(Button)`
  height: 42px;
  border-radius: 12px;
  font-weight: 500;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.5) !important;
  border: 1px solid rgba(2, 132, 199, 0.15) !important;
  color: #334155 !important;
  transition: all 0.25s;
  &:hover {
    border-color: rgba(14, 165, 233, 0.4) !important;
    color: #0c1929 !important;
    background: rgba(255, 255, 255, 0.7) !important;
    box-shadow: 0 2px 12px rgba(14, 165, 233, 0.1);
  }
`

const StyledDivider = styled(Divider)`
  &.ant-divider {
    margin: 16px 0;
    border-color: rgba(2, 132, 199, 0.12);
    .ant-divider-inner-text {
      font-size: 10px;
      color: #64748b;
      padding: 0 12px;
      font-weight: 600;
    }
  }
`

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 22px;
  padding: 5px 16px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(2, 132, 199, 0.1);
  border-radius: 20px;
  font-size: 11px;
  color: #64748b;
`

const StatusDot = styled.div`
  width: 5px;
  height: 5px;
  background: #0ea5e9;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(14, 165, 233, 0.4);
  animation: ${dotPulse} 2.5s infinite;
`

export default LoginPage
