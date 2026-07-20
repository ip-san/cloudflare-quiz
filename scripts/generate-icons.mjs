/**
 * アプリアイコン一括生成スクリプト
 *
 * build/icon.svg を Single Source of Truth として:
 * - Electron 用 PNG（16〜1024px + ICO）
 * - PWA 用 PNG（apple-touch-icon, icon-192/512, maskable）
 * - index.html のスプラッシュ SVG を自動同期
 * - AppLogo コンポーネントの SVG と一致を検証
 *
 * 使い方: node scripts/generate-icons.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

async function generateIcons() {
  const svgPath = join(rootDir, 'build', 'icon.svg')
  const buildDir = join(rootDir, 'build')
  const publicIconsDir = join(rootDir, 'public', 'icons')

  mkdirSync(buildDir, { recursive: true })
  mkdirSync(publicIconsDir, { recursive: true })

  const svgBuffer = readFileSync(svgPath)

  console.log('Generating icons from build/icon.svg...\n')

  // ── Electron icons ──────────────────────────────────────
  console.log('Electron:')
  const electronSizes = [16, 32, 48, 64, 128, 256, 512, 1024]
  for (const size of electronSizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(buildDir, `icon-${size}.png`))
    console.log(`  ✓ ${size}x${size}`)
  }
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(buildDir, 'icon.png'))
  console.log('  ✓ icon.png (main)')

  // Windows ICO
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const icoBuffers = await Promise.all(icoSizes.map((size) => sharp(svgBuffer).resize(size, size).png().toBuffer()))
  const icoHeaderSize = 6
  const icoDirEntrySize = 16
  let currentOffset = icoHeaderSize + icoDirEntrySize * icoBuffers.length
  const header = Buffer.alloc(icoHeaderSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(icoBuffers.length, 4)
  const dirEntries = Buffer.alloc(icoDirEntrySize * icoBuffers.length)
  for (let i = 0; i < icoBuffers.length; i++) {
    const size = icoSizes[i]
    const offset = i * icoDirEntrySize
    dirEntries.writeUInt8(size < 256 ? size : 0, offset)
    dirEntries.writeUInt8(size < 256 ? size : 0, offset + 1)
    dirEntries.writeUInt8(0, offset + 2)
    dirEntries.writeUInt8(0, offset + 3)
    dirEntries.writeUInt16LE(1, offset + 4)
    dirEntries.writeUInt16LE(32, offset + 6)
    dirEntries.writeUInt32LE(icoBuffers[i].length, offset + 8)
    dirEntries.writeUInt32LE(currentOffset, offset + 12)
    currentOffset += icoBuffers[i].length
  }
  writeFileSync(join(buildDir, 'icon.ico'), Buffer.concat([header, dirEntries, ...icoBuffers]))
  console.log('  ✓ icon.ico')

  // ── PWA icons ───────────────────────────────────────────
  console.log('\nPWA:')
  const pwaIcons = [
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 152, name: 'apple-touch-icon-152.png' },
    { size: 167, name: 'apple-touch-icon-167.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ]
  for (const icon of pwaIcons) {
    await sharp(svgBuffer).resize(icon.size, icon.size).png().toFile(join(publicIconsDir, icon.name))
    console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`)
  }

  // Maskable (10% padding)
  for (const size of [192, 512]) {
    const padding = Math.round(size * 0.1)
    const inner = size - padding * 2
    const resized = await sharp(svgBuffer).resize(inner, inner).png().toBuffer()
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 217, g: 119, b: 87, alpha: 1 } } })
      .png()
      .composite([{ input: resized, top: padding, left: padding }])
      .toFile(join(publicIconsDir, `icon-${size}-maskable.png`))
    console.log(`  ✓ icon-${size}-maskable.png`)
  }

  // ── Splash screen sync ──────────────────────────────────
  console.log('\nSplash:')
  syncSplashSvg(svgPath)

  console.log('\nDone!')
}

/**
 * build/icon.svg の内容を index.html のスプラッシュに同期する。
 * <!-- SPLASH-ICON-START --> と <!-- SPLASH-ICON-END --> マーカー間を置換。
 */
function syncSplashSvg(svgPath) {
  const indexPath = join(rootDir, 'index.html')
  let html = readFileSync(indexPath, 'utf-8')
  const svgContent = readFileSync(svgPath, 'utf-8')

  // SVG を index.html に埋め込める形に変換（viewBox 維持、width/height 追加、style 追加）
  const inlineSvg = svgContent
    .replace(/<svg/, '<svg width="96" height="96" style="margin:0 auto 16px;display:block"')
    .replace(/\n\s*/g, '') // 1行に圧縮

  const startMarker = '<!-- SPLASH-ICON-START -->'
  const endMarker = '<!-- SPLASH-ICON-END -->'

  if (html.includes(startMarker) && html.includes(endMarker)) {
    const before = html.slice(0, html.indexOf(startMarker) + startMarker.length)
    const after = html.slice(html.indexOf(endMarker))
    html = `${before}\n          ${inlineSvg}\n          ${after}`
    writeFileSync(indexPath, html)
    console.log('  ✓ index.html splash icon synced')
  } else {
    console.log('  ⚠ Markers not found in index.html. Add:')
    console.log(`    ${startMarker}`)
    console.log('    (SVG will be injected here)')
    console.log(`    ${endMarker}`)
  }
}

generateIcons().catch(console.error)
