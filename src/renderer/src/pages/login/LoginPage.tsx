import TeniulinkLogo from '@renderer/assets/images/teniulink-text-logo.svg'
import { useAppDispatch } from '@renderer/store'
import { setAuthLogin } from '@renderer/store/settings'
import { Button, Form, Input, message } from 'antd'
import { Lock, User } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import styled, { keyframes } from 'styled-components'

interface LoginFormValues {
  username: string
  password: string
}

const LoginPage: FC = () => {
  const [loading, setLoading] = useState(false)
  const dispatch = useAppDispatch()
  const [form] = Form.useForm<LoginFormValues>()

  const handleLogin = useCallback(
    async (values: LoginFormValues) => {
      setLoading(true)
      try {
        const result = await window.api.authLogin(values.username, values.password)
        if (result.success && result.token) {
          dispatch(
            setAuthLogin({
              username: result.user?.username || values.username,
              token: result.token,
              loginTime: new Date().toISOString()
            })
          )
        } else {
          message.error(result.error || 'Login failed')
        }
      } catch {
        message.error('Network error, please check your connection')
      } finally {
        setLoading(false)
      }
    },
    [dispatch]
  )

  return (
    <PageContainer>
      <GridOverlay />
      <ParticleLayer>
        {Array.from({ length: 20 }, (_, i) => (
          <Particle key={i} $delay={i * 0.5} $x={Math.random() * 100} $size={2 + Math.random() * 3} />
        ))}
      </ParticleLayer>
      <LoginCard>
        <LogoContainer>
          <Logo src={TeniulinkLogo} alt="Teniulink Node" draggable={false} />
          <Subtitle>Intelligent Gateway Node</Subtitle>
        </LogoContainer>
        <StyledForm form={form} onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Please enter username' }]}>
            <Input prefix={<User size={16} style={{ opacity: 0.5 }} />} placeholder="Username" autoFocus />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Please enter password' }]}>
            <Input.Password prefix={<Lock size={16} style={{ opacity: 0.5 }} />} placeholder="Password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <LoginButton type="primary" htmlType="submit" loading={loading} block>
              Login
            </LoginButton>
          </Form.Item>
        </StyledForm>
      </LoginCard>
    </PageContainer>
  )
}

const float = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh); opacity: 0; }
`

const gridPulse = keyframes`
  0%, 100% { opacity: 0.03; }
  50% { opacity: 0.08; }
`

const PageContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0a0e1a 0%, #0d1526 30%, #0f1b35 60%, #0a1628 100%);
  position: relative;
  overflow: hidden;
  -webkit-app-region: drag;
`

const GridOverlay = styled.div`
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: ${gridPulse} 4s ease-in-out infinite;
`

const ParticleLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`

const Particle = styled.div<{ $delay: number; $x: number; $size: number }>`
  position: absolute;
  bottom: -10px;
  left: ${({ $x }) => $x}%;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.8), transparent);
  border-radius: 50%;
  animation: ${float} ${() => 8 + Math.random() * 6}s linear infinite;
  animation-delay: ${({ $delay }) => $delay}s;
`

const LoginCard = styled.div`
  position: relative;
  z-index: 1;
  width: 380px;
  padding: 40px 36px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 212, 255, 0.05);
  -webkit-app-region: none;
`

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 32px;
`

const Logo = styled.img`
  height: 36px;
  margin-bottom: 8px;
  filter: brightness(1.2);
`

const Subtitle = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 3px;
  text-transform: uppercase;
`

const StyledForm = styled(Form<LoginFormValues>)`
  .ant-input-affix-wrapper,
  .ant-input {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    color: rgba(255, 255, 255, 0.9) !important;
    border-radius: 8px;
    &:hover,
    &:focus,
    &.ant-input-affix-wrapper-focused {
      border-color: rgba(0, 212, 255, 0.5) !important;
      box-shadow: 0 0 12px rgba(0, 212, 255, 0.15) !important;
    }
    &::placeholder {
      color: rgba(255, 255, 255, 0.3) !important;
    }
  }
  .ant-input-password-icon {
    color: rgba(255, 255, 255, 0.4) !important;
  }
  .ant-form-item-explain-error {
    font-size: 12px;
  }
`

const LoginButton = styled(Button)`
  height: 44px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  background: linear-gradient(135deg, #00d4ff, #0099cc) !important;
  border: none !important;
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
  &:hover {
    background: linear-gradient(135deg, #33ddff, #00aadd) !important;
    box-shadow: 0 6px 25px rgba(0, 212, 255, 0.4);
  }
`

export default LoginPage
