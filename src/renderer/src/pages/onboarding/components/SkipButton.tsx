import { Button } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SkipButtonProps {
  onSkip: () => void
}

const SkipButton: FC<SkipButtonProps> = ({ onSkip }) => {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (countdown <= 0) {
      onSkip()
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, onSkip])

  const handleClick = useCallback(() => {
    onSkip()
  }, [onSkip])

  return (
    <Button
      type="text"
      className="text-(--color-text-3) opacity-50 hover:opacity-80"
      style={{ position: 'absolute', top: 16, right: 16, width: 'auto', zIndex: 10 }}
      onClick={handleClick}>
      {t('onboarding.skip')} ({countdown}s)
    </Button>
  )
}

export default SkipButton
