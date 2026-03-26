const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const LOGOS_DIR = path.join(__dirname, '..', 'resources', 'logos')
const BUILD_DIR = path.join(__dirname, '..', 'build')
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'images')

// Icon sizes needed for electron-builder
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

async function convertSvgToPng(svgPath, outputPath, size) {
  await sharp(svgPath).resize(size, size).png().toFile(outputPath)
  console.log(`Created: ${outputPath}`)
}

async function main() {
  const iconDark = path.join(LOGOS_DIR, 'teniulink-icon.svg')
  const iconLight = path.join(LOGOS_DIR, 'teniulink-icon-light.svg')

  // Check if SVG files exist
  if (!fs.existsSync(iconDark)) {
    console.error('Error: teniulink-icon.svg not found')
    process.exit(1)
  }

  // Create icons directory if not exists
  const iconsDir = path.join(BUILD_DIR, 'icons')
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true })
  }

  // Generate PNG icons at various sizes
  console.log('Generating icon PNGs...')
  for (const size of ICON_SIZES) {
    await convertSvgToPng(iconDark, path.join(iconsDir, `${size}x${size}.png`), size)
  }

  // Generate main icon.png (512x512)
  await convertSvgToPng(iconDark, path.join(BUILD_DIR, 'icon.png'), 512)
  console.log('Created: build/icon.png')

  // Generate logo.png for assets
  await convertSvgToPng(iconDark, path.join(ASSETS_DIR, 'logo.png'), 512)
  console.log('Created: src/renderer/src/assets/images/logo.png')

  // Generate tray icons (smaller, simplified)
  await sharp(iconDark).resize(16, 16).png().toFile(path.join(BUILD_DIR, 'tray_icon.png'))
  await sharp(iconDark).resize(16, 16).png().toFile(path.join(BUILD_DIR, 'tray_icon_dark.png'))
  await sharp(iconLight).resize(16, 16).png().toFile(path.join(BUILD_DIR, 'tray_icon_light.png'))
  console.log('Created: tray icons')

  // Generate icon.ico for Windows (using 256x256)
  // Note: For proper .ico generation, you may need png-to-ico package
  // For now, we'll copy the 256x256 PNG as icon.ico (electron-builder can handle this)
  await convertSvgToPng(iconDark, path.join(BUILD_DIR, 'icon.ico'), 256)
  console.log('Created: build/icon.ico (PNG format, rename if needed)')

  // Generate icon.icns for macOS
  // Note: For proper .icns generation, electron-builder handles this from icon.png
  // during the build process

  console.log('\n✅ Logo conversion complete!')
  console.log('\nNote: For production builds:')
  console.log('  - macOS: electron-builder will generate .icns from icon.png')
  console.log('  - Windows: Use a proper .ico generator if needed')
}

main().catch(console.error)
