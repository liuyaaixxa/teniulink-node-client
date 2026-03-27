export type SystemInfoResult = {
  cpu: {
    manufacturer: string
    brand: string
    cores: number
    physicalCores: number
    speed: string
  }
  gpu: Array<{
    model: string
    vendor: string
    memory: string
  }>
  os: {
    platform: string
    distro: string
    release: string
    arch: string
  }
  disks: Array<{
    name: string
    type: string
    size: number
    sizeGB: string
  }>
}
