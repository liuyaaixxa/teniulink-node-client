import WindowControls from '@renderer/components/WindowControls'
import type { FC } from 'react'

import SkipButton from './components/SkipButton'
import WelcomePage from './components/WelcomePage'

interface OnboardingPageProps {
  onComplete: () => void
}

const OnboardingPage: FC<OnboardingPageProps> = ({ onComplete }) => {
  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="drag flex w-full shrink-0 items-center justify-end" style={{ height: 'var(--navbar-height)' }}>
        <WindowControls />
      </div>
      <div className="flex flex-1 px-2 pb-2">
        <div className="relative flex flex-1 overflow-hidden rounded-xl bg-(--color-background)">
          <SkipButton onSkip={onComplete} />
          <WelcomePage />
        </div>
      </div>
    </div>
  )
}

export default OnboardingPage
