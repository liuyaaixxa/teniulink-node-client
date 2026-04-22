import * as path from 'path'

import type { ElectronApplication, Page } from '@playwright/test'
import { _electron as electron, test as base } from '@playwright/test'

export type ElectronFixtures = {
  electronApp: ElectronApplication
  mainWindow: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const rendererUrl = `file://${path.resolve('out/renderer/index.html')}`
    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_RENDERER_URL: rendererUrl
      },
      timeout: 60000
    })

    await use(electronApp)

    await electronApp.close()
  },

  mainWindow: async ({ electronApp }, use) => {
    const findMainWindow = async (): Promise<Page | null> => {
      for (const window of electronApp.windows()) {
        const title = await window.title()
        if (title === 'Teniulink Node') return window
      }
      return null
    }

    let mainWindow = await findMainWindow()

    if (!mainWindow) {
      mainWindow = await electronApp.waitForEvent('window', {
        predicate: async (window) => {
          const title = await window.title()
          return title === 'Teniulink Node'
        },
        timeout: 60000
      })
    }

    await mainWindow.waitForSelector('#root', { state: 'attached', timeout: 60000 })
    await mainWindow.waitForLoadState('domcontentloaded')

    await use(mainWindow)
  }
})

export { expect } from '@playwright/test'
