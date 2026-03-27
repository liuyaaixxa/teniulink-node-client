import { useTheme } from '@renderer/context/ThemeProvider'
import { loggerService } from '@renderer/services/LoggerService'
import type { RootState } from '@renderer/store'
import { useAppDispatch } from '@renderer/store'
import { setTeniuCloudApiKey, setTeniuCloudApiUrl, setTeniuCloudConnectionStatus } from '@renderer/store/settings'
import type { TeniuCloudConnectionStatus } from '@renderer/types'
import { TENIU_CLOUD_DEFAULTS } from '@renderer/types/teniuCloud'
import { Alert, Button, Input, Modal, Spin, Typography } from 'antd'
import { CloudOff, Link, Unlink } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import { SettingContainer } from '../..'

const { Text, Title } = Typography
const logger = loggerService.withContext('TeniuCloudSettings')

const TeniuCloudSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const teniuCloudConfig = useSelector((state: RootState) => state.settings.teniuCloud) || {
    apiUrl: TENIU_CLOUD_DEFAULTS.API_URL,
    apiKey: '',
    connectionStatus: 'disconnected' as TeniuCloudConnectionStatus
  }

  const [isLoading, setIsLoading] = useState(false)

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const checkConnectionStatus = async () => {
    try {
      const result = await window.api.teniuCloudCheckStatus()
      dispatch(setTeniuCloudConnectionStatus(result.connected ? 'connected' : 'disconnected'))
    } catch (error) {
      logger.error('Failed to check connection status:', error as Error)
      dispatch(setTeniuCloudConnectionStatus('disconnected'))
    }
  }

  const handleApiUrlChange = (value: string) => {
    dispatch(setTeniuCloudApiUrl(value))
  }

  const handleApiKeyChange = (value: string) => {
    dispatch(setTeniuCloudApiKey(value))
  }

  const handleConnect = async () => {
    if (!teniuCloudConfig.apiUrl || !teniuCloudConfig.apiKey) {
      window.toast.warning(t('teniuCloud.messages.configRequired'))
      return
    }

    setIsLoading(true)
    dispatch(setTeniuCloudConnectionStatus('connecting'))

    try {
      const result = await window.api.teniuCloudConnect(teniuCloudConfig.apiUrl, teniuCloudConfig.apiKey)

      if (result.success) {
        dispatch(setTeniuCloudConnectionStatus('connected'))
        window.toast.success(t('teniuCloud.messages.connectSuccess'))
      } else {
        dispatch(setTeniuCloudConnectionStatus('disconnected'))
        showErrorModal(result.error || t('teniuCloud.messages.connectFailed'))
      }
    } catch (error) {
      dispatch(setTeniuCloudConnectionStatus('disconnected'))
      showErrorModal((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading(true)

    try {
      const result = await window.api.teniuCloudDisconnect()

      if (result.success) {
        dispatch(setTeniuCloudConnectionStatus('disconnected'))
        window.toast.success(t('teniuCloud.messages.disconnectSuccess'))
      } else {
        showErrorModal(result.error || t('teniuCloud.messages.disconnectFailed'))
      }
    } catch (error) {
      showErrorModal((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const showErrorModal = (message: string) => {
    Modal.error({
      title: t('teniuCloud.messages.errorTitle'),
      content: message
    })
  }

  const getStatusText = () => {
    switch (teniuCloudConfig.connectionStatus) {
      case 'connected':
        return t('teniuCloud.status.connected')
      case 'connecting':
        return t('teniuCloud.status.connecting')
      default:
        return t('teniuCloud.status.disconnected')
    }
  }

  const isConnected = teniuCloudConfig.connectionStatus === 'connected'
  const isConnecting = teniuCloudConfig.connectionStatus === 'connecting'

  return (
    <Container theme={theme}>
      {/* Header Section */}
      <HeaderSection>
        <HeaderContent>
          <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            {t('teniuCloud.title')}
          </Title>
          <Text type="secondary">{t('teniuCloud.description')}</Text>
        </HeaderContent>
        <StatusBadge $status={teniuCloudConfig.connectionStatus}>
          <StatusDot $status={teniuCloudConfig.connectionStatus} />
          {getStatusText()}
        </StatusBadge>
      </HeaderSection>

      {/* Connection Status Panel */}
      <ConnectionPanel $connected={isConnected}>
        <StatusSection>
          {isConnected ? (
            <>
              <Link size={20} style={{ color: 'var(--color-status-success)' }} />
              <StatusContent>
                <StatusText $connected>{t('teniuCloud.status.connected')}</StatusText>
                <StatusSubtext>{teniuCloudConfig.apiUrl}</StatusSubtext>
              </StatusContent>
            </>
          ) : (
            <>
              <CloudOff size={20} style={{ color: 'var(--color-text-3)' }} />
              <StatusContent>
                <StatusText $connected={false}>{t('teniuCloud.status.disconnected')}</StatusText>
                <StatusSubtext>{t('teniuCloud.status.configurePrompt')}</StatusSubtext>
              </StatusContent>
            </>
          )}
        </StatusSection>

        <ControlSection>
          {isLoading || isConnecting ? (
            <LoadingContainer>
              <Spin size="small" />
              <LoadingText>{t('teniuCloud.status.connecting')}</LoadingText>
            </LoadingContainer>
          ) : isConnected ? (
            <DisconnectButton onClick={handleDisconnect}>
              <Unlink size={14} />
              {t('teniuCloud.actions.disconnect')}
            </DisconnectButton>
          ) : (
            <ConnectButton type="primary" onClick={handleConnect}>
              <Link size={14} />
              {t('teniuCloud.actions.connect')}
            </ConnectButton>
          )}
        </ControlSection>
      </ConnectionPanel>

      {/* API URL Configuration */}
      <ConfigurationField>
        <FieldLabel>{t('teniuCloud.fields.apiUrl.label')}</FieldLabel>
        <FieldDescription>{t('teniuCloud.fields.apiUrl.description')}</FieldDescription>
        <StyledInput
          value={teniuCloudConfig.apiUrl}
          onChange={(e) => handleApiUrlChange(e.target.value)}
          placeholder={TENIU_CLOUD_DEFAULTS.API_URL}
          size="middle"
          disabled={isConnected}
        />
      </ConfigurationField>

      {/* API Key Configuration */}
      <ConfigurationField>
        <FieldLabel>{t('teniuCloud.fields.apiKey.label')}</FieldLabel>
        <FieldDescription>{t('teniuCloud.fields.apiKey.description')}</FieldDescription>
        <StyledInput
          value={teniuCloudConfig.apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder={t('teniuCloud.fields.apiKey.placeholder')}
          size="middle"
          type="password"
          disabled={isConnected}
        />
      </ConfigurationField>

      {/* Info Alert */}
      <InfoAlert
        message={t('teniuCloud.info.title')}
        description={t('teniuCloud.info.description')}
        type="info"
        showIcon
      />
    </Container>
  )
}

// Styled Components
const Container = styled(SettingContainer)`
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
`

const HeaderSection = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
`

const HeaderContent = styled.div`
  flex: 1;
`

const StatusBadge = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: ${(props) => {
    switch (props.$status) {
      case 'connected':
        return 'rgba(82, 196, 26, 0.1)'
      case 'connecting':
        return 'rgba(250, 173, 20, 0.1)'
      default:
        return 'var(--color-background-soft)'
    }
  }};
  color: ${(props) => {
    switch (props.$status) {
      case 'connected':
        return 'var(--color-status-success)'
      case 'connecting':
        return 'var(--color-status-warning)'
      default:
        return 'var(--color-text-3)'
    }
  }};
`

const StatusDot = styled.div<{ $status: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => {
    switch (props.$status) {
      case 'connected':
        return 'var(--color-status-success)'
      case 'connecting':
        return 'var(--color-status-warning)'
      default:
        return 'var(--color-text-3)'
    }
  }};
`

const ConnectionPanel = styled.div<{ $connected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--color-background);
  border: 1px solid ${(props) => (props.$connected ? 'var(--color-status-success)' : 'var(--color-border)')};
  margin-bottom: 16px;
`

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const StatusContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const StatusText = styled.div<{ $connected: boolean }>`
  font-weight: 600;
  font-size: 14px;
  color: ${(props) => (props.$connected ? 'var(--color-status-success)' : 'var(--color-text-1)')};
`

const StatusSubtext = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const ControlSection = styled.div`
  display: flex;
  align-items: center;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const LoadingText = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
`

const ConnectButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 8px;
`

const DisconnectButton = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 15px;
  border-radius: 6px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-2);
  transition: all 0.2s;

  &:hover {
    color: var(--color-status-error);
    border-color: var(--color-status-error);
  }
`

const ConfigurationField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  margin-bottom: 16px;
`

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
`

const FieldDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const StyledInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const InfoAlert = styled(Alert)`
  margin-top: 16px;
`

export default TeniuCloudSettings
