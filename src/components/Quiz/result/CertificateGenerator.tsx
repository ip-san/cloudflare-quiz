import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { getMasteryLevel } from '@/domain/services/MasteryLevelService'
import { isCertificateEligible } from '@/domain/valueObjects/ScoreThresholds'
import { trackCertificate } from '@/lib/analytics'
import { generateCertificate, LEVEL_DESIGNS } from '@/lib/certificateCanvas'
import { useCertificateName } from '@/lib/useCertificateName'
import { useQuizStore } from '@/stores/quizStore'

interface CertificateGeneratorProps {
  score: number
  total: number
  percentage: number
  mode: string
}

/**
 * クイズ結果画面の修了証ダウンロード
 * 全体像モード 70%+ / 実力テスト 80%+ で表示
 */
export function CertificateGenerator({ score, total, percentage, mode }: CertificateGeneratorProps) {
  const [name, setName] = useCertificateName()
  const [generating, setGenerating] = useState(false)
  const { userProgress, getCategoryStats } = useQuizStore(
    useShallow((state) => ({ userProgress: state.userProgress, getCategoryStats: state.getCategoryStats }))
  )

  const isEligible = isCertificateEligible(mode, percentage)
  if (!isEligible) return null

  const categoryStats = getCategoryStats()
  const overallAccuracy = userProgress.getOverallAccuracy()
  const mastery = getMasteryLevel(overallAccuracy, userProgress.totalAttempts, categoryStats)
  const levelIndex = Math.max(mastery.index, 1)
  const design = LEVEL_DESIGNS[levelIndex]

  const handleGenerate = () => {
    setGenerating(true)
    const certDesc = mode === 'overview' ? theme.certificateDescOverview : theme.certificateDescFull
    generateCertificate({
      levelIndex,
      levelIcon: mastery.icon,
      levelName: mastery.name,
      name,
      scoreLine: `${percentage}%`,
      subScoreLine: `${score} / ${total} ${locale.common.questionSuffix}`,
      description: certDesc,
      overallAccuracy,
    })
    trackCertificate(mode)
    setGenerating(false)
  }

  const uiColors = [
    '',
    'border-blue-200 from-blue-50 to-sky-50 dark:from-blue-950 dark:to-sky-950 dark:border-blue-800',
    'border-green-200 from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 dark:border-green-800',
    'border-purple-200 from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 dark:border-purple-800',
    'border-amber-200 from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 dark:border-amber-800',
  ]
  const buttonColors = ['', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500']
  const textColors = [
    '',
    'text-blue-800 dark:text-blue-200',
    'text-green-800 dark:text-green-200',
    'text-purple-800 dark:text-purple-200',
    'text-amber-800 dark:text-amber-200',
  ]
  const subTextColors = [
    '',
    'text-blue-600 dark:text-blue-400',
    'text-green-600 dark:text-green-400',
    'text-purple-600 dark:text-purple-400',
    'text-amber-600 dark:text-amber-400',
  ]

  return (
    <div className={`mb-4 rounded-2xl border bg-linear-to-r p-4 text-center ${uiColors[levelIndex]}`}>
      <div className="mb-2 text-3xl">{mastery.icon}</div>
      <p className={`mb-1 text-sm font-bold ${textColors[levelIndex]}`}>{design.title}</p>
      <p className={`mb-3 text-xs ${subTextColors[levelIndex]}`}>{locale.certificate.canIssue}</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={locale.certificate.namePlaceholder}
        aria-label={locale.certificate.nameLabel}
        className="mb-3 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-center text-sm text-claude-dark dark:bg-stone-800 dark:text-white dark:border-stone-600"
      />
      <button
        onClick={handleGenerate}
        disabled={generating}
        className={`tap-highlight w-full rounded-2xl py-3 text-base font-semibold text-white ${buttonColors[levelIndex]}`}
      >
        {generating ? locale.certificate.generating : locale.certificate.download}
      </button>
    </div>
  )
}
