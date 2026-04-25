import { useTheme } from '@renderer/context/ThemeProvider'
import { useApiServer } from '@renderer/hooks/useApiServer'
import { loggerService } from '@renderer/services/LoggerService'
import type { RootState } from '@renderer/store'
import { useAppDispatch } from '@renderer/store'
import { setApiServerApiKey, setApiServerPort } from '@renderer/store/settings'
import type { SystemInfoResult } from '@renderer/types'
import { formatErrorMessage } from '@renderer/utils/error'
import { API_SERVER_DEFAULTS } from '@shared/config/constant'
import { Alert, Button, Input, InputNumber, Spin, Tooltip, Typography } from 'antd'
import { Copy, Cpu, ExternalLink, HardDrive, Monitor, Play, RotateCcw, Square } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
import { v4 as uuidv4 } from 'uuid'

import { SettingContainer } from '../..'

const { Text, Title } = Typography

const logger = loggerService.withContext('ApiServerSettings')

const ApiServerSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  // API Server state with proper defaults
  const apiServerConfig = useSelector((state: RootState) => state.settings.apiServer)
  const { apiServerRunning, apiServerLoading, startApiServer, stopApiServer, restartApiServer, setApiServerEnabled } =
    useApiServer()

  // System info state
  const [systemInfo, setSystemInfo] = useState<SystemInfoResult | null>(null)
  const [systemInfoLoading, setSystemInfoLoading] = useState(true)

  // Fetch system info on mount
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        setSystemInfoLoading(true)
        const info = await window.api.getSystemInfo()
        setSystemInfo(info)
      } catch (error) {
        logger.error('Failed to fetch system info:', error as Error)
      } finally {
        setSystemInfoLoading(false)
      }
    }
    void fetchSystemInfo()
  }, [])

  const handleApiServerToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await startApiServer()
      } else {
        await stopApiServer()
      }
    } catch (error) {
      window.toast.error(t('apiServer.messages.operationFailed') + formatErrorMessage(error))
    } finally {
      setApiServerEnabled(enabled)
    }
  }

  const handleApiServerRestart = async () => {
    await restartApiServer()
  }

  const copyApiKey = () => {
    void navigator.clipboard.writeText(apiServerConfig.apiKey)
    window.toast.success(t('apiServer.messages.apiKeyCopied'))
  }

  const regenerateApiKey = () => {
    const newApiKey = `cs-sk-${uuidv4()}`
    dispatch(setApiServerApiKey(newApiKey))
    window.toast.success(t('apiServer.messages.apiKeyRegenerated'))
  }

  const handlePortChange = (value: string) => {
    const port = parseInt(value) || API_SERVER_DEFAULTS.PORT
    if (port >= 1000 && port <= 65535) {
      dispatch(setApiServerPort(port))
    }
  }

  const openApiDocs = () => {
    if (apiServerRunning) {
      const host = apiServerConfig.host || API_SERVER_DEFAULTS.HOST
      const port = apiServerConfig.port || API_SERVER_DEFAULTS.PORT
      window.open(`http://${host}:${port}/api-docs`, '_blank')
    }
  }

  return (
    <Container theme={theme}>
      {/* Header Section */}
      <HeaderSection>
        <HeaderContent>
          <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            {t('apiServer.title')}
          </Title>
          <Text type="secondary">{t('apiServer.description')}</Text>
        </HeaderContent>
        {apiServerRunning && (
          <Button type="primary" icon={<ExternalLink size={14} />} onClick={openApiDocs}>
            {t('apiServer.documentation.title')}
          </Button>
        )}
      </HeaderSection>

      {!apiServerRunning && (
        <Alert type="warning" message={t('agent.warning.enable_server')} style={{ marginBottom: 10 }} showIcon />
      )}

      {/* Server Control Panel with integrated configuration */}
      <ServerControlPanel $status={apiServerRunning}>
        <StatusSection>
          <StatusIndicator $status={apiServerRunning} />
          <StatusContent>
            <StatusText $status={apiServerRunning}>
              {apiServerRunning ? t('apiServer.status.running') : t('apiServer.status.stopped')}
            </StatusText>
            <StatusSubtext>
              {apiServerRunning
                ? `http://${apiServerConfig.host || API_SERVER_DEFAULTS.HOST}:${apiServerConfig.port || API_SERVER_DEFAULTS.PORT}`
                : t('apiServer.fields.port.description')}
            </StatusSubtext>
          </StatusContent>
        </StatusSection>

        <ControlSection>
          {apiServerRunning && (
            <Tooltip title={t('apiServer.actions.restart.tooltip')}>
              <RestartButton
                $loading={apiServerLoading}
                onClick={apiServerLoading ? undefined : handleApiServerRestart}>
                <RotateCcw size={14} />
                <span>{t('apiServer.actions.restart.button')}</span>
              </RestartButton>
            </Tooltip>
          )}

          {/* Port input when server is stopped */}
          {!apiServerRunning && (
            <StyledInputNumber
              value={apiServerConfig.port}
              onChange={(value) => handlePortChange(String(value || API_SERVER_DEFAULTS.PORT))}
              min={1000}
              max={65535}
              disabled={apiServerRunning}
              placeholder={String(API_SERVER_DEFAULTS.PORT)}
              size="middle"
            />
          )}

          <Tooltip title={apiServerRunning ? t('apiServer.actions.stop') : t('apiServer.actions.start')}>
            {apiServerRunning ? (
              <StopButton
                $loading={apiServerLoading}
                onClick={apiServerLoading ? undefined : () => handleApiServerToggle(false)}>
                <Square size={20} style={{ color: 'var(--color-status-error)' }} />
              </StopButton>
            ) : (
              <StartButton
                $loading={apiServerLoading}
                onClick={apiServerLoading ? undefined : () => handleApiServerToggle(true)}>
                <Play size={20} style={{ color: 'var(--color-status-success)' }} />
              </StartButton>
            )}
          </Tooltip>
        </ControlSection>
      </ServerControlPanel>

      {/* API Key Configuration */}
      <ConfigurationField>
        <FieldLabel>{t('apiServer.fields.apiKey.label')}</FieldLabel>
        <FieldDescription>{t('apiServer.fields.apiKey.description')}</FieldDescription>

        <StyledInput
          value={apiServerConfig.apiKey}
          readOnly
          placeholder={t('apiServer.fields.apiKey.placeholder')}
          size="middle"
          suffix={
            <InputButtonContainer>
              {!apiServerRunning && (
                <RegenerateButton onClick={regenerateApiKey} disabled={apiServerRunning} type="link">
                  {t('apiServer.actions.regenerate')}
                </RegenerateButton>
              )}
              <Tooltip title={t('apiServer.fields.apiKey.copyTooltip')}>
                <InputButton icon={<Copy size={14} />} onClick={copyApiKey} disabled={!apiServerConfig.apiKey} />
              </Tooltip>
            </InputButtonContainer>
          }
        />

        {/* Authorization header info */}
        <AuthHeaderSection>
          <FieldLabel>{t('apiServer.authHeader.title')}</FieldLabel>
          <StyledInput
            style={{ height: 38 }}
            value={`Authorization: Bearer ${apiServerConfig.apiKey || 'your-api-key'}`}
            readOnly
            size="middle"
          />
        </AuthHeaderSection>
      </ConfigurationField>

      {/* System Information Section */}
      <SystemInfoSection>
        <SystemInfoHeader>
          <SystemInfoTitle>{t('apiServer.systemInfo.title')}</SystemInfoTitle>
          <SystemInfoDescription>{t('apiServer.systemInfo.description')}</SystemInfoDescription>
        </SystemInfoHeader>

        {systemInfoLoading ? (
          <LoadingContainer>
            <Spin size="default" />
          </LoadingContainer>
        ) : systemInfo ? (
          <SystemInfoGrid>
            {/* CPU Info */}
            <InfoCard>
              <InfoCardHeader>
                <Cpu size={16} />
                <InfoCardTitle>{t('apiServer.systemInfo.cpu.title')}</InfoCardTitle>
              </InfoCardHeader>
              <InfoCardContent>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.cpu.brand')}</InfoLabel>
                  <InfoValue>
                    {systemInfo.cpu.manufacturer} {systemInfo.cpu.brand}
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.cpu.cores')}</InfoLabel>
                  <InfoValue>
                    {systemInfo.cpu.cores} ({t('apiServer.systemInfo.cpu.physicalCores')}:{' '}
                    {systemInfo.cpu.physicalCores})
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.cpu.speed')}</InfoLabel>
                  <InfoValue>{systemInfo.cpu.speed} GHz</InfoValue>
                </InfoItem>
              </InfoCardContent>
            </InfoCard>

            {/* GPU Info */}
            <InfoCard>
              <InfoCardHeader>
                <Monitor size={16} />
                <InfoCardTitle>{t('apiServer.systemInfo.gpu.title')}</InfoCardTitle>
              </InfoCardHeader>
              <InfoCardContent>
                {systemInfo.gpu.length > 0 ? (
                  systemInfo.gpu.map((gpu, index) => (
                    <InfoItem key={index}>
                      <InfoLabel>{t('apiServer.systemInfo.gpu.model')}</InfoLabel>
                      <InfoValue>{gpu.model}</InfoValue>
                      <InfoSubValue>
                        {gpu.vendor} | {gpu.memory}
                      </InfoSubValue>
                    </InfoItem>
                  ))
                ) : (
                  <InfoItem>
                    <InfoValue>{t('apiServer.systemInfo.gpu.notDetected')}</InfoValue>
                  </InfoItem>
                )}
              </InfoCardContent>
            </InfoCard>

            {/* Disk Info */}
            <InfoCard>
              <InfoCardHeader>
                <HardDrive size={16} />
                <InfoCardTitle>{t('apiServer.systemInfo.disk.title')}</InfoCardTitle>
              </InfoCardHeader>
              <InfoCardContent>
                {systemInfo.disks.slice(0, 3).map((disk, index) => (
                  <InfoItem key={index}>
                    <InfoLabel>{disk.name}</InfoLabel>
                    <InfoValue>{disk.sizeGB}</InfoValue>
                    <InfoSubValue>{disk.type}</InfoSubValue>
                  </InfoItem>
                ))}
              </InfoCardContent>
            </InfoCard>

            {/* OS Info */}
            <InfoCard>
              <InfoCardHeader>
                <Monitor size={16} />
                <InfoCardTitle>{t('apiServer.systemInfo.os.title')}</InfoCardTitle>
              </InfoCardHeader>
              <InfoCardContent>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.os.platform')}</InfoLabel>
                  <InfoValue>{systemInfo.os.distro}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.os.version')}</InfoLabel>
                  <InfoValue>{systemInfo.os.release}</InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>{t('apiServer.systemInfo.os.arch')}</InfoLabel>
                  <InfoValue>{systemInfo.os.arch}</InfoValue>
                </InfoItem>
              </InfoCardContent>
            </InfoCard>
          </SystemInfoGrid>
        ) : (
          <EmptyState>{t('apiServer.systemInfo.notAvailable')}</EmptyState>
        )}
      </SystemInfoSection>
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`

const HeaderContent = styled.div`
  flex: 1;
`

const ServerControlPanel = styled.div<{ $status: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 8px;
  background: var(--color-background);
  border: 1px solid ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-border)')};
  transition: all 0.3s ease;
  margin-bottom: 16px;
`

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const StatusIndicator = styled.div<{ $status: boolean }>`
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-status-error)')};

  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-status-error)')};
    opacity: 0.2;
    animation: ${(props) => (props.$status ? 'pulse 2s infinite' : 'none')};
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.2;
    }
    50% {
      transform: scale(1.5);
      opacity: 0.1;
    }
  }
`

const StatusContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const StatusText = styled.div<{ $status: boolean }>`
  font-weight: 600;
  font-size: 14px;
  color: ${(props) => (props.$status ? 'var(--color-status-success)' : 'var(--color-text-1)')};
  margin: 0;
`

const StatusSubtext = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin: 0;
`

const ControlSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const RestartButton = styled.div<{ $loading: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-2);
  cursor: ${(props) => (props.$loading ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.$loading ? 0.5 : 1)};
  font-size: 12px;
  transition: all 0.2s ease;

  &:hover {
    color: ${(props) => (props.$loading ? 'var(--color-text-2)' : 'var(--color-primary)')};
  }
`

const StyledInputNumber = styled(InputNumber)`
  width: 80px;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
  margin-right: 5px;
`

const StartButton = styled.div<{ $loading: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.$loading ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.$loading ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover {
    transform: ${(props) => (props.$loading ? 'scale(1)' : 'scale(1.1)')};
  }
`

const StopButton = styled.div<{ $loading: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.$loading ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.$loading ? 0.5 : 1)};
  transition: all 0.2s ease;

  &:hover {
    transform: ${(props) => (props.$loading ? 'scale(1)' : 'scale(1.1)')};
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
`

const FieldLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin: 0;
`

const FieldDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin: 0;
`

const StyledInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
  border: 1.5px solid var(--color-border);
`

const InputButtonContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const InputButton = styled(Button)`
  border: none;
  padding: 0 4px;
  background: transparent;
`

const RegenerateButton = styled(Button)`
  padding: 0 4px;
  font-size: 12px;
  height: auto;
  line-height: 1;
  border: none;
  background: transparent;
`

const AuthHeaderSection = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

// System Info Styled Components
const SystemInfoSection = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-background);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const SystemInfoHeader = styled.div`
  margin-bottom: 8px;
`

const SystemInfoTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 4px;
`

const SystemInfoDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
`

const SystemInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const InfoCard = styled.div`
  padding: 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  border: 1px solid var(--color-border);
`

const InfoCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--color-text-2);
`

const InfoCardTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const InfoCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const InfoLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
`

const InfoValue = styled.div`
  font-size: 12px;
  color: var(--color-text-1);
  word-break: break-word;
`

const InfoSubValue = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
`

const EmptyState = styled.div`
  text-align: center;
  padding: 20px;
  color: var(--color-text-3);
  font-size: 13px;
`

export default ApiServerSettings
