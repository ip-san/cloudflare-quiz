/**
 * アプリロゴ — 稲妻マーク（オリジナル図案。Cloudflare 公式ロゴは使用しない）
 * ウェルカム画面、ローディング画面、チュートリアルで使用
 */
export function AppLogo({ size = 96 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#FBA857' }} />
          <stop offset="100%" style={{ stopColor: '#F6821F' }} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#logo-bg)" />
      {/* Lightning bolt */}
      <path d="M280 96 L152 296 L232 296 L216 416 L360 216 L272 216 Z" fill="white" />
    </svg>
  )
}
