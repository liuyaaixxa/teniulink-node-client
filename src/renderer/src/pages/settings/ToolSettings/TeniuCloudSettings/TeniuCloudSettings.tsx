import { useTheme } from '@renderer/context/ThemeProvider'
import { loggerService } from '@renderer/services/LoggerService'
import type { RootState } from '@renderer/store'
import { useAppDispatch } from '@renderer/store'
import { setTeniuCloudApiKey, setTeniuCloudApiUrl, setTeniuCloudConnectionStatus } from '@renderer/store/settings'
import type { TeniuCloudConnectionStatus } from '@renderer/types'
import { TENIU_CLOUD_DEFAULTS } from '@renderer/types/teniuCloud'
import { Button, Input, Modal, Spin, Typography } from 'antd'
import { CloudOff, Link, RefreshCw, Server, Unlink } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import { SettingContainer } from '../..'

const { Text, Title } = Typography
const logger = loggerService.withContext('TeniuCloudSettings')

interface LocalModel {
  id: string
  name: string
  provider: string
  providerName: string
  providerType: string
  providerModelId: string
}

interface LocalModelsState {
  models: LocalModel[]
  total: number
  gatewayUrl: string
  isLoading: boolean
  error?: string
}

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
  const [localModels, setLocalModels] = useState<LocalModelsState>({
    models: [],
    total: 0,
    gatewayUrl: '',
    isLoading: false
  })

  // Check connection status on mount
  useEffect(() => {
    void checkConnectionStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch local models on mount
  useEffect(() => {
    void fetchLocalModels()
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

  const fetchLocalModels = async () => {
    setLocalModels((prev) => ({ ...prev, isLoading: true, error: undefined }))
    try {
      const result = await window.api.teniuCloudGetLocalModels()
      setLocalModels({
        models: result.models,
        total: result.total,
        gatewayUrl: result.gatewayUrl,
        isLoading: false,
        error: result.success ? undefined : result.error
      })
    } catch (error) {
      logger.error('Failed to fetch local models:', error as Error)
      setLocalModels((prev) => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }))
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
          <Title level={3} style={{ margin: 0 }}>
            {t('teniuCloud.title')}
          </Title>
          <Text type="secondary">{t('teniuCloud.description')}</Text>
        </HeaderContent>
        <StatusBadge $status={teniuCloudConfig.connectionStatus}>
          <StatusDot $status={teniuCloudConfig.connectionStatus} />
          {getStatusText()}
        </StatusBadge>
      </HeaderSection>

      {/* Main Card - Contains all configuration and status */}
      <MainCard>
        {/* Connection Status Row */}
        <StatusRow>
          <StatusIcon $connected={isConnected}>
            {isConnected ? (
              <Link size={20} style={{ color: 'var(--color-status-success)' }} />
            ) : (
              <CloudOff size={20} style={{ color: 'var(--color-text-3)' }} />
            )}
          </StatusIcon>
          <StatusInfo>
            <StatusLabel $connected={isConnected}>
              {isConnected ? t('teniuCloud.status.connected') : t('teniuCloud.status.disconnected')}
            </StatusLabel>
            <StatusValue>{teniuCloudConfig.apiUrl || t('teniuCloud.status.configurePrompt')}</StatusValue>
          </StatusInfo>
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
        </StatusRow>

        {/* Divider */}
        <Divider />

        {/* Configuration Fields */}
        <ConfigRow>
          <FieldGroup>
            <FieldLabel>{t('teniuCloud.fields.apiUrl.label')}</FieldLabel>
            <StyledInput
              value={teniuCloudConfig.apiUrl}
              onChange={(e) => handleApiUrlChange(e.target.value)}
              placeholder={TENIU_CLOUD_DEFAULTS.API_URL}
              size="middle"
              disabled={isConnected}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>{t('teniuCloud.fields.apiKey.label')}</FieldLabel>
            <StyledInput
              value={teniuCloudConfig.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={t('teniuCloud.fields.apiKey.placeholder')}
              size="middle"
              type="password"
              disabled={isConnected}
            />
          </FieldGroup>
        </ConfigRow>

        {/* Divider */}
        <Divider />

        {/* Info Section */}
        <InfoSection>
          <InfoTitle>{t('teniuCloud.info.title')}</InfoTitle>
          <InfoDescription>{t('teniuCloud.info.description')}</InfoDescription>
        </InfoSection>
      </MainCard>

      {/* Local Models Card */}
      <LocalModelsCard>
        {/* Header Row */}
        <LocalModelsHeader>
          <LocalModelsHeaderLeft>
            <ServerIcon>
              <Server size={18} />
            </ServerIcon>
            <LocalModelsTitle>{t('teniuCloud.localModels.title')}</LocalModelsTitle>
          </LocalModelsHeaderLeft>
          <RefreshButton onClick={() => void fetchLocalModels()} disabled={localModels.isLoading}>
            {localModels.isLoading ? <Spin size="small" /> : <RefreshCw size={14} />}
          </RefreshButton>
        </LocalModelsHeader>

        {/* Gateway Info Row */}
        <GatewayInfoRow>
          <GatewayUrl>{localModels.gatewayUrl || 'http://localhost:23333'}</GatewayUrl>
          <ModelCount>{t('teniuCloud.localModels.modelCount', { count: localModels.total })}</ModelCount>
        </GatewayInfoRow>

        {/* Divider */}
        <Divider />

        {/* Models List */}
        {localModels.error ? (
          <ErrorSection>
            <ErrorText>{localModels.error}</ErrorText>
          </ErrorSection>
        ) : localModels.models.length > 0 ? (
          <ModelsList>
            {localModels.models.map((model) => (
              <ModelItem key={model.id}>
                <ModelName>{model.name}</ModelName>
                <ModelProvider>{model.providerName}</ModelProvider>
              </ModelItem>
            ))}
          </ModelsList>
        ) : (
          <EmptySection>
            <EmptyText>{t('teniuCloud.localModels.empty')}</EmptyText>
          </EmptySection>
        )}
      </LocalModelsCard>
    </Container>
  )
}

// Styled Components
const Container = styled(SettingContainer)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const HeaderSection = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
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

const MainCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--color-background);
  border-radius: 12px;
  border: 1px solid var(--color-border);
`

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`

const StatusIcon = styled.div<{ $connected: boolean }>`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${(props) => (props.$connected ? 'rgba(82, 196, 26, 0.1)' : 'var(--color-background-soft)')};
`

const StatusInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const StatusLabel = styled.div<{ $connected: boolean }>`
  font-weight: 600;
  font-size: 16px;
  color: ${(props) => (props.$connected ? 'var(--color-status-success)' : 'var(--color-text-1)')};
`

const StatusValue = styled.div`
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
  padding: 6px 16px;
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

const Divider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: 16px 0;
`

const ConfigRow = styled.div`
  display: flex;
  gap: 16px;
`

const FieldGroup = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
`

const StyledInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const InfoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const InfoTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
`

const InfoDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.5;
`

// Local Models Card Styles
const LocalModelsCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--color-background);
  border-radius: 12px;
  border: 1px solid var(--color-border);
`

const LocalModelsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const LocalModelsHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const ServerIcon = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-background-soft);
  color: var(--color-text-2);
`

const LocalModelsTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
`

const RefreshButton = styled.div<{ disabled?: boolean }>`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  color: var(--color-text-2);
  transition: all 0.2s;
  opacity: ${(props) => (props.disabled ? 0.6 : 1)};

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
`

const GatewayInfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
`

const GatewayUrl = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  font-family: monospace;
`

const ModelCount = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const ModelsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
`

const ModelItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  border: 1px solid var(--color-border);
`

const ModelName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const ModelProvider = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const ErrorSection = styled.div`
  padding: 16px;
  text-align: center;
`

const ErrorText = styled.div`
  font-size: 13px;
  color: var(--color-status-error);
`

const EmptySection = styled.div`
  padding: 16px;
  text-align: center;
`

const EmptyText = styled.div`
  font-size: 13px;
  color: var(--color-text-3);
`

export default TeniuCloudSettings
