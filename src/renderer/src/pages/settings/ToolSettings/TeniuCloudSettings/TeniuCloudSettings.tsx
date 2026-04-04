import { useTheme } from '@renderer/context/ThemeProvider'
import { loggerService } from '@renderer/services/LoggerService'
import type { RootState } from '@renderer/store'
import { useAppDispatch } from '@renderer/store'
import {
  setTeniuCloudApiKey,
  setTeniuCloudApiUrl,
  setTeniuCloudConnectionStatus,
  setTeniuCloudServiceName
} from '@renderer/store/settings'
import type { TeniuCloudConnectionStatus } from '@renderer/types'
import { TENIU_CLOUD_DEFAULTS } from '@renderer/types/teniuCloud'
import { Button, Input, Modal, Spin, Typography } from 'antd'
import { ChevronLeft, ChevronRight, CloudOff, Link, RefreshCw, Search, Server, Unlink } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
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

const PAGE_SIZE = 10

const TeniuCloudSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const teniuCloudConfig = useSelector((state: RootState) => state.settings.teniuCloud) || {
    apiUrl: TENIU_CLOUD_DEFAULTS.API_URL,
    apiKey: '',
    connectionStatus: 'disconnected' as TeniuCloudConnectionStatus,
    serviceName: ''
  }
  const authState = useSelector((state: RootState) => state.settings.auth)

  const [isLoading, setIsLoading] = useState(false)
  const [installStatus, setInstallStatus] = useState<string | null>(null)
  const [localModels, setLocalModels] = useState<LocalModelsState>({
    models: [],
    total: 0,
    gatewayUrl: '',
    isLoading: false
  })

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Check connection status on mount
  useEffect(() => {
    void checkConnectionStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch local models on mount
  useEffect(() => {
    void fetchLocalModels()
  }, [])

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return localModels.models
    }
    const query = searchQuery.toLowerCase()
    return localModels.models.filter(
      (model) =>
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        model.providerName.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query)
    )
  }, [localModels.models, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredModels.length / PAGE_SIZE)
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredModels.slice(start, end)
  }, [filteredModels, currentPage])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

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
      // Reset pagination when models are refreshed
      setCurrentPage(1)
      setSearchQuery('')
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
    setInstallStatus(null)
    dispatch(setTeniuCloudConnectionStatus('connecting'))

    try {
      const result = await window.api.teniuCloudConnect(teniuCloudConfig.apiUrl, teniuCloudConfig.apiKey)

      if (result.success) {
        dispatch(setTeniuCloudConnectionStatus('connected'))
        window.toast.success(t('teniuCloud.messages.connectSuccess'))

        // Resolve service name in background
        try {
          const tokensResult = await window.api.teniuCloudGetDeviceTokens()
          if (tokensResult.success && tokensResult.tokens.length > 0 && authState?.username) {
            const apiKey = teniuCloudConfig.apiKey
            const keyPrefix = apiKey.substring(0, 4)
            const keySuffix = apiKey.substring(apiKey.length - 4)

            const matched = tokensResult.tokens.find((token) => {
              if (!token.tokenMask) return false
              return (
                token.tokenMask.substring(0, 4) === keyPrefix &&
                token.tokenMask.substring(token.tokenMask.length - 4) === keySuffix
              )
            })

            const deviceName = matched?.name || tokensResult.tokens.find((t) => t.status === 1)?.name
            if (deviceName) {
              const serviceName = `${authState.username}-${deviceName}`
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .substring(0, 64)
              dispatch(setTeniuCloudServiceName(serviceName))
              logger.info(`Service name resolved: ${serviceName}`)
            }
          }
        } catch (error) {
          logger.warn('Failed to resolve service name:', error as Error)
        }
      } else {
        dispatch(setTeniuCloudConnectionStatus('disconnected'))
        showErrorModal(result.error || t('teniuCloud.messages.connectFailed'))
      }
    } catch (error) {
      dispatch(setTeniuCloudConnectionStatus('disconnected'))
      showErrorModal((error as Error).message)
    } finally {
      setIsLoading(false)
      setInstallStatus(null)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading(true)

    try {
      const result = await window.api.teniuCloudDisconnect(teniuCloudConfig.serviceName || undefined)

      if (result.success) {
        dispatch(setTeniuCloudConnectionStatus('disconnected'))
        dispatch(setTeniuCloudServiceName(''))
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
              {installStatus
                ? installStatus
                : isConnected
                  ? t('teniuCloud.status.connected')
                  : t('teniuCloud.status.disconnected')}
            </StatusLabel>
            <StatusValue>
              {isConnected && teniuCloudConfig.serviceName
                ? `${teniuCloudConfig.apiUrl} · ${teniuCloudConfig.serviceName}`
                : teniuCloudConfig.apiUrl || t('teniuCloud.status.configurePrompt')}
            </StatusValue>
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

        {/* Search Input */}
        <SearchRow>
          <SearchInput
            placeholder={t('teniuCloud.localModels.searchPlaceholder')}
            prefix={<Search size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </SearchRow>

        {/* Divider */}
        <Divider />

        {/* Models List */}
        {localModels.error ? (
          <ErrorSection>
            <ErrorText>{localModels.error}</ErrorText>
          </ErrorSection>
        ) : paginatedModels.length > 0 ? (
          <>
            <ModelsList>
              {paginatedModels.map((model) => (
                <ModelItem key={model.id}>
                  <ModelInfo>
                    <ModelName>{model.name}</ModelName>
                    <ModelId>{model.id}</ModelId>
                  </ModelInfo>
                  <ModelProvider>{model.providerName}</ModelProvider>
                </ModelItem>
              ))}
            </ModelsList>
            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationRow>
                <PageInfo>{t('teniuCloud.localModels.pageInfo', { current: currentPage, total: totalPages })}</PageInfo>
                <PaginationControls>
                  <PageButton
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}>
                    <ChevronLeft size={16} />
                  </PageButton>
                  <PageNumbers>
                    {(() => {
                      // Calculate the range of page numbers to display
                      const maxVisible = 5
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                      const endPage = Math.min(totalPages, startPage + maxVisible - 1)

                      // Adjust start if we're near the end
                      if (endPage - startPage + 1 < maxVisible) {
                        startPage = Math.max(1, endPage - maxVisible + 1)
                      }

                      return Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                        const pageNum = startPage + i
                        return (
                          <PageNumber
                            key={pageNum}
                            $active={pageNum === currentPage}
                            onClick={() => setCurrentPage(pageNum)}>
                            {pageNum}
                          </PageNumber>
                        )
                      })
                    })()}
                  </PageNumbers>
                  <PageButton
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}>
                    <ChevronRight size={16} />
                  </PageButton>
                </PaginationControls>
              </PaginationRow>
            )}
          </>
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

const SearchRow = styled.div`
  margin-top: 12px;
`

const SearchInput = styled(Input)`
  width: 100%;
  border-radius: 6px;
`

const ModelsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ModelItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--color-background-soft);
  border-radius: 6px;
  border: 1px solid var(--color-border);
`

const ModelInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const ModelName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
`

const ModelId = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  font-family: monospace;
`

const ModelProvider = styled.div`
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--color-background);
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

// Pagination Styles
const PaginationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
`

const PageInfo = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const PageButton = styled.div<{ disabled?: boolean }>`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  color: var(--color-text-2);
  transition: all 0.2s;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
`

const PageNumbers = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

const PageNumber = styled.div<{ $active: boolean }>`
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  color: ${(props) => (props.$active ? '#fff' : 'var(--color-text-2)')};
  border: 1px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-border)')};
`

export default TeniuCloudSettings
