import TeniulinkLogo from '@renderer/assets/images/teniulink-logo.svg'
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
      <GlowBg />
      <ContentWrapper>
        <LogoSection>
          <Logo src={TeniulinkLogo} alt="Teniulink Node" draggable={false} />
          <BrandName>
            Teniu<BrandHighlight>link</BrandHighlight>
          </BrandName>
          <Subtitle>Intelligent Gateway Node</Subtitle>
        </LogoSection>
        <FormSection>
          <StyledForm form={form} onFinish={handleLogin} layout="vertical" size="middle">
            <Form.Item name="username" rules={[{ required: true, message: 'Please enter username' }]}>
              <StyledInput prefix={<User size={14} color="#64748b" />} placeholder="Username" autoFocus />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Please enter password' }]}>
              <StyledPasswordInput prefix={<Lock size={14} color="#64748b" />} placeholder="Password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, marginTop: 4 }}>
              <LoginButton type="primary" htmlType="submit" loading={loading} block>
                Connect Node
              </LoginButton>
            </Form.Item>
          </StyledForm>
        </FormSection>
        <StatusBadge>
          <StatusDot />
          <span>Teniu Cloud Network</span>
        </StatusBadge>
      </ContentWrapper>
    </PageContainer>
  )
}

const glowPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
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

const ContentWrapper = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 300px;
  -webkit-app-region: none;
`

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 24px;
`

const Logo = styled.img`
  width: 56px;
  height: 56px;
  margin-bottom: 10px;
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
`

const StyledForm = styled(Form<LoginFormValues>)`
  .ant-form-item {
    margin-bottom: 12px;
  }
  .ant-form-item-explain-error {
    font-size: 11px;
  }
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

const StyledPasswordInput = styled(Input.Password)`
  ${inputStyles}
  .ant-input-password-icon {
    color: #475569 !important;
    &:hover {
      color: #94a3b8 !important;
    }
  }
`

const LoginButton = styled(Button)`
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
