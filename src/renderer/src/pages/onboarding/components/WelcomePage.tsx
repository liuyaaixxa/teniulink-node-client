import CherryStudioLogo from '@renderer/assets/images/logo.png'
import { Button } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

const WelcomePage: FC = () => {
  const { t } = useTranslation()

  const handleLogin = () => {
    void window.api.openWebsite('https://teniuapi.online')
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <img src={CherryStudioLogo} alt="Teniulink Node" className="h-16 w-16 rounded-xl" />

        <div className="flex flex-col items-center gap-2">
          <h1 className="m-0 font-semibold text-(--color-text) text-2xl">{t('onboarding.welcome.title')}</h1>
          <p className="m-0 text-(--color-text-2) text-sm">{t('onboarding.welcome.subtitle')}</p>
        </div>

        <div className="mt-2 flex w-80 flex-col gap-3">
          <Button type="primary" size="large" block className="h-12 rounded-lg" onClick={handleLogin}>
            {t('onboarding.welcome.login_cherryin')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
