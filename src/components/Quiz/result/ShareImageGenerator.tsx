import { Check, Image } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'
import { haptics } from '@/lib/haptics'

type ShareStatus = 'idle' | 'generating' | 'copied' | 'downloaded'

interface ShareImageGeneratorProps {
  score: number
  total: number
  percentage: number
  streakDays: number
  totalXp: number
  masteryName: string
  masteryIcon: string
}

/**
 * セッション結果のシェア画像を Canvas API で生成
 *
 * OGP 標準サイズ (1200×630px) で生成。
 * 共有フロー: Web Share API → クリップボードコピー → ダウンロード（フォールバック順）
 * 全描画はクライアントサイドで完結（サーバー不要）。
 */
export function ShareImageGenerator({
  score,
  total,
  percentage,
  streakDays,
  totalXp,
  masteryName,
  masteryIcon,
}: ShareImageGeneratorProps) {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Cleanup timeout on unmount
  useEffect(() => () => clearTimeout(resetTimerRef.current), [])

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
  }, [])

  const generateImage = useCallback(async () => {
    setStatus('generating')
    haptics.light()

    try {
      const canvas = document.createElement('canvas')
      const width = 1200
      const height = 630 // OGP standard (1200×630)
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, width, height)
      grad.addColorStop(0, '#FAF9F5')
      grad.addColorStop(1, '#FFF5EB')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // Top accent bar
      const accentGrad = ctx.createLinearGradient(0, 0, width, 0)
      accentGrad.addColorStop(0, '#E07A3A')
      accentGrad.addColorStop(1, '#F59E0B')
      ctx.fillStyle = accentGrad
      ctx.fillRect(0, 0, width, 8)

      // App name
      ctx.fillStyle = '#E07A3A'
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
      ctx.fillText(theme.appName, 60, 80)

      // Score circle
      const cx = width / 2
      const cy = 270
      const r = 110

      // Background circle
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = '#E5E7EB'
      ctx.lineWidth = 16
      ctx.stroke()

      // Score arc
      const angle = (percentage / 100) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle)
      ctx.strokeStyle = percentage >= PASSING_SCORE ? '#22C55E' : percentage >= 40 ? '#F59E0B' : '#EF4444'
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      ctx.stroke()

      // Score text
      ctx.fillStyle = '#1C1917'
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${percentage}%`, cx, cy + 16)

      // Score detail
      ctx.font = '28px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#78716C'
      ctx.fillText(locale.shareImage.scoreDetail(score, total), cx, cy + 60)

      // Stats row
      const statsY = 460
      const stats = [
        { label: locale.shareImage.streakLabel, value: locale.shareImage.streakDays(streakDays) },
        { label: locale.shareImage.levelLabel, value: `${masteryIcon} ${masteryName}` },
        { label: 'XP', value: `${totalXp}` },
      ]

      const statWidth = width / stats.length
      stats.forEach((stat, i) => {
        const sx = statWidth * i + statWidth / 2
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = '#1C1917'
        ctx.fillText(stat.value, sx, statsY)
        ctx.font = '22px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = '#A8A29E'
        ctx.fillText(stat.label, sx, statsY + 40)
      })

      // Footer
      ctx.textAlign = 'left'
      ctx.font = '20px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#A8A29E'
      ctx.fillText(theme.shareHashtags, 60, height - 30)

      ctx.textAlign = 'right'
      ctx.fillText(new Date().toLocaleDateString('ja-JP'), width - 60, height - 30)

      // Convert to blob and trigger download/share
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return

      if ('share' in navigator && 'canShare' in navigator) {
        const file = new File([blob], 'quiz-result.png', { type: 'image/png' })
        const shareData = { files: [file] }
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      }

      // Fallback: try clipboard, then download
      if ('clipboard' in navigator && 'write' in navigator.clipboard) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          setStatus('copied')
          scheduleReset()
          return
        } catch {
          // Clipboard failed, fall through to download
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'quiz-result.png'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('downloaded')
      scheduleReset()
    } catch {
      setStatus('idle')
    }
  }, [score, total, percentage, streakDays, totalXp, masteryName, masteryIcon, scheduleReset])

  const buttonLabel = {
    idle: locale.shareImage.idle,
    generating: locale.shareImage.generating,
    copied: locale.shareImage.copied,
    downloaded: locale.shareImage.downloaded,
  }[status]

  return (
    <button
      onClick={generateImage}
      disabled={status === 'generating'}
      aria-busy={status === 'generating'}
      aria-live="polite"
      className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-300 bg-white px-6 py-3.5 text-base font-semibold text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400"
    >
      {status === 'copied' || status === 'downloaded' ? (
        <Check className="h-5 w-5" />
      ) : status === 'generating' ? null : (
        <Image className="h-5 w-5" />
      )}
      {buttonLabel}
    </button>
  )
}
