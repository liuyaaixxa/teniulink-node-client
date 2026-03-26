import { useTheme } from '@renderer/context/ThemeProvider'
import type { RootState } from '@renderer/store'
import { useAppDispatch } from '@renderer/store'
import { setTeniuCloudApiKey, setTeniuCloudApiUrl } from '@renderer/store/settings'
import { TENIU_CLOUD_DEFAULTS } from '@renderer/types/teniuCloud'
import { Button, Input, Typography } from 'antd'
import { Save } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import { SettingContainer } from '../..'

const { Text, Title } = Typography

const TeniuCloudSettings: FC = () => {
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  const teniuCloudConfig = useSelector((state: RootState) => state.settings.teniuCloud) || {
    apiUrl: 'https://teniuapi.cloud',
    apiKey: ''
  }

  const handleApiUrlChange = (value: string) => {
    dispatch(setTeniuCloudApiUrl(value))
  }

  const handleApiKeyChange = (value: string) => {
    dispatch(setTeniuCloudApiKey(value))
  }

  const handleSave = () => {
    window.toast.success(t('teniuCloud.messages.saveSuccess'))
  }

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
      </HeaderSection>

      {/* API URL Configuration */}
      <ConfigurationField>
        <FieldLabel>{t('teniuCloud.fields.apiUrl.label')}</FieldLabel>
        <FieldDescription>{t('teniuCloud.fields.apiUrl.description')}</FieldDescription>
        <StyledInput
          value={teniuCloudConfig.apiUrl}
          onChange={(e) => handleApiUrlChange(e.target.value)}
          placeholder={TENIU_CLOUD_DEFAULTS.API_URL}
          size="middle"
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
        />
      </ConfigurationField>

      {/* Save Button */}
      <ButtonContainer>
        <SaveButton type="primary" icon={<Save size={14} />} onClick={handleSave}>
          {t('common.save')}
        </SaveButton>
      </ButtonContainer>
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

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
`

const SaveButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 8px;
`

export default TeniuCloudSettings
