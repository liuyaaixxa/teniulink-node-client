export type TeniuCloudConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export type TeniuCloudConfig = {
  apiUrl: string
  apiKey: string
  connectionStatus: TeniuCloudConnectionStatus
  serviceName: string
}

export const TENIU_CLOUD_DEFAULTS = {
  API_URL: 'https://teniuapi.cloud'
} as const
