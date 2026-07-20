/**
 * GitHub Release の assets 配列からプラットフォーム別の直接ダウンロード URL を抽出する。
 *
 * - macOS: .dmg（arm64/x64 アーキテクチャマッチ + フォールバック）
 * - Windows: .exe
 * - Linux: .appimage
 */
export function findPlatformAssetUrl(
  assets: Array<{ name: string; browser_download_url: string }>,
  platform: string,
  arch: string
): string | null {
  for (const asset of assets) {
    const name = asset.name.toLowerCase()
    if (platform === 'darwin' && name.endsWith('.dmg')) {
      // arm64 と x64 の区別: ファイル名に arch が含まれる場合はマッチさせる
      if (name.includes(arch) || (!name.includes('arm64') && !name.includes('x64'))) {
        return asset.browser_download_url
      }
    }
    if (platform === 'win32' && name.endsWith('.exe')) {
      return asset.browser_download_url
    }
    if (platform === 'linux' && name.endsWith('.appimage')) {
      return asset.browser_download_url
    }
  }
  // アーキテクチャ不問のフォールバック（macOS で arch 指定ファイルがない場合）
  if (platform === 'darwin') {
    const dmg = assets.find((a) => a.name.toLowerCase().endsWith('.dmg'))
    if (dmg) return dmg.browser_download_url
  }
  return null
}
