import { theme } from '@/config/theme'

/** Level-specific certificate design */
export const LEVEL_DESIGNS = [
  { title: '', border: '', accent: '', bg: '' },
  { title: '基礎修了証', border: '#3B82F6', accent: '#2563EB', bg: '#EFF6FF' },
  { title: '実践者認定証', border: '#22C55E', accent: '#16A34A', bg: '#F0FDF4' },
  { title: '推進者認定証', border: '#A855F7', accent: '#9333EA', bg: '#FAF5FF' },
  { title: 'マスター認定証', border: '#EAB308', accent: '#CA8A04', bg: '#FEFCE8' },
]

interface CertificateOptions {
  levelIndex: number
  levelIcon: string
  levelName: string
  name: string
  /** Main score line (e.g. "75%" or "総合正答率 82%") */
  scoreLine: string
  /** Sub score line (e.g. "27 / 36 問正解") */
  subScoreLine?: string
  /** Description (e.g. "全体像モード修了" or "AI推進者レベル到達") */
  description: string
  /** Overall accuracy to show separately */
  overallAccuracy?: number
}

export function generateCertificate(opts: CertificateOptions): void {
  const design = LEVEL_DESIGNS[opts.levelIndex]
  if (!design.border) return

  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 560
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = design.bg
  ctx.fillRect(0, 0, 800, 560)

  // Borders
  ctx.strokeStyle = design.border
  ctx.lineWidth = 4
  ctx.strokeRect(20, 20, 760, 520)
  ctx.strokeStyle = `${design.border}40`
  ctx.lineWidth = 2
  ctx.strokeRect(30, 30, 740, 500)

  // Level icon
  ctx.font = '40px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(opts.levelIcon, 70, 70)

  // Title
  ctx.fillStyle = design.accent
  ctx.font = 'bold 36px -apple-system, sans-serif'
  ctx.fillText(design.title, 400, 90)

  // Subtitle
  ctx.fillStyle = '#6B6B6B'
  ctx.font = '16px -apple-system, sans-serif'
  ctx.fillText(theme.certificateTitle, 400, 120)

  // Level badge
  ctx.fillStyle = design.accent
  ctx.font = 'bold 18px -apple-system, sans-serif'
  ctx.fillText(`${opts.levelIcon} ${opts.levelName}`, 400, 160)

  // Name
  ctx.fillStyle = '#1A1A1A'
  ctx.font = 'bold 32px -apple-system, sans-serif'
  ctx.fillText(opts.name || 'Anonymous', 400, 220)

  // Score
  ctx.fillStyle = design.accent
  ctx.font = 'bold 48px -apple-system, sans-serif'
  ctx.fillText(opts.scoreLine, 400, 300)

  if (opts.subScoreLine) {
    ctx.fillStyle = '#6B6B6B'
    ctx.font = '18px -apple-system, sans-serif'
    ctx.fillText(opts.subScoreLine, 400, 330)
  }

  if (opts.overallAccuracy !== undefined) {
    ctx.fillStyle = '#9CA3AF'
    ctx.font = '14px -apple-system, sans-serif'
    ctx.fillText(`総合正答率: ${opts.overallAccuracy}%`, 400, 360)
  }

  // Description
  ctx.fillStyle = '#1A1A1A'
  ctx.font = '16px -apple-system, sans-serif'
  ctx.fillText(opts.description, 400, 410)

  // Date
  ctx.fillStyle = '#6B6B6B'
  ctx.font = '14px -apple-system, sans-serif'
  ctx.fillText(new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }), 400, 460)

  // Footer
  ctx.fillStyle = `${design.border}40`
  ctx.font = '12px -apple-system, sans-serif'
  ctx.fillText(theme.certificateFooter, 400, 520)

  // Download
  const link = document.createElement('a')
  link.download = `${theme.storagePrefix}-certificate-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
