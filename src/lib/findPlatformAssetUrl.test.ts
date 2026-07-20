import { describe, expect, it } from 'vitest'
import { findPlatformAssetUrl } from './findPlatformAssetUrl'

const makeAsset = (name: string) => ({
  name,
  browser_download_url: `https://github.com/releases/download/v1.0.0/${name}`,
})

describe('findPlatformAssetUrl', () => {
  // ── macOS ──────────────────────────────────────────────────

  describe('macOS (darwin)', () => {
    it('arm64 アーキテクチャに一致する DMG を選択', () => {
      const assets = [makeAsset('App-1.0.0-mac-arm64.dmg'), makeAsset('App-1.0.0-mac-x64.dmg')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'arm64')
      expect(url).toContain('arm64.dmg')
    })

    it('x64 アーキテクチャに一致する DMG を選択', () => {
      const assets = [makeAsset('App-1.0.0-mac-arm64.dmg'), makeAsset('App-1.0.0-mac-x64.dmg')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'x64')
      expect(url).toContain('x64.dmg')
    })

    it('アーキテクチャ指定なしの DMG にマッチ', () => {
      const assets = [makeAsset('App-1.0.0.dmg')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'arm64')
      expect(url).toContain('App-1.0.0.dmg')
    })

    it('アーキテクチャ不一致時にフォールバックで最初の DMG を返す', () => {
      const assets = [makeAsset('App-1.0.0-mac-x64.dmg')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'arm64')
      // arm64 にマッチしないが、フォールバックで x64 DMG を返す
      expect(url).toContain('x64.dmg')
    })

    it('DMG がない場合は null', () => {
      const assets = [makeAsset('App-1.0.0.exe'), makeAsset('App-1.0.0.AppImage')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'arm64')
      expect(url).toBeNull()
    })

    it('ファイル名の大文字小文字を無視', () => {
      const assets = [makeAsset('App-1.0.0-Mac-ARM64.DMG')]
      const url = findPlatformAssetUrl(assets, 'darwin', 'arm64')
      expect(url).toContain('ARM64.DMG')
    })
  })

  // ── Windows ────────────────────────────────────────────────

  describe('Windows (win32)', () => {
    it('.exe ファイルを選択', () => {
      const assets = [makeAsset('App-1.0.0.dmg'), makeAsset('App Setup 1.0.0.exe')]
      const url = findPlatformAssetUrl(assets, 'win32', 'x64')
      expect(url).toContain('.exe')
    })

    it('.exe がない場合は null', () => {
      const assets = [makeAsset('App-1.0.0.dmg'), makeAsset('App-1.0.0.AppImage')]
      const url = findPlatformAssetUrl(assets, 'win32', 'x64')
      expect(url).toBeNull()
    })
  })

  // ── Linux ──────────────────────────────────────────────────

  describe('Linux (linux)', () => {
    it('.appimage ファイルを選択', () => {
      const assets = [makeAsset('App-1.0.0.dmg'), makeAsset('App-1.0.0-x86_64.AppImage')]
      const url = findPlatformAssetUrl(assets, 'linux', 'x64')
      expect(url).toContain('.AppImage')
    })

    it('.appimage がない場合は null', () => {
      const assets = [makeAsset('App-1.0.0.dmg'), makeAsset('App-1.0.0.exe')]
      const url = findPlatformAssetUrl(assets, 'linux', 'x64')
      expect(url).toBeNull()
    })
  })

  // ── 共通 ──────────────────────────────────────────────────

  describe('共通', () => {
    it('空の assets 配列で null', () => {
      expect(findPlatformAssetUrl([], 'darwin', 'arm64')).toBeNull()
      expect(findPlatformAssetUrl([], 'win32', 'x64')).toBeNull()
      expect(findPlatformAssetUrl([], 'linux', 'x64')).toBeNull()
    })

    it('未知のプラットフォームで null', () => {
      const assets = [makeAsset('App-1.0.0.dmg'), makeAsset('App-1.0.0.exe')]
      expect(findPlatformAssetUrl(assets, 'freebsd', 'x64')).toBeNull()
    })
  })
})
