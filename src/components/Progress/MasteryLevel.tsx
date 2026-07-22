import { Download } from 'lucide-react'
import { useState } from 'react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { getMasteryLevel } from '@/domain/services/MasteryLevelService'
import { generateCertificate, LEVEL_DESIGNS } from '@/lib/certificateCanvas'
import { useCertificateName } from '@/lib/useCertificateName'

interface MasteryLevelProps {
  overallAccuracy: number
  totalAttempts: number
  totalXp: number
  categoryStats: Record<string, { accuracy: number; attemptedQuestions: number; totalQuestions: number }>
}

export function MasteryLevel({ overallAccuracy, totalAttempts, totalXp, categoryStats }: MasteryLevelProps) {
  const levels = theme.masteryLevels
  const mastery = getMasteryLevel(overallAccuracy, totalAttempts, categoryStats)
  const currentIndex = mastery.index
  const current = levels[currentIndex]
  const next = currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null
  const canDownload = currentIndex >= 1

  const [name, setName] = useCertificateName()
  const [showDownload, setShowDownload] = useState(false)

  const handleDownload = () => {
    generateCertificate({
      levelIndex: currentIndex,
      levelIcon: mastery.icon,
      levelName: mastery.name,
      name,
      scoreLine: `${locale.progress.accuracy} ${overallAccuracy}%`,
      description: locale.mastery.levelReached(mastery.name, locale.common.start),
    })
  }

  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-xs dark:bg-stone-800">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{current.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${current.color}`}>{current.name}</span>
            <div
              className="flex gap-1"
              role="img"
              aria-label={`${locale.shareImage.levelLabel} ${currentIndex + 1} / ${levels.length}`}
            >
              {levels.map((level, i) => (
                <div
                  key={level.name}
                  className={`h-1.5 w-4 rounded-full ${i <= currentIndex ? 'bg-cf-accent' : 'bg-stone-200 dark:bg-stone-600'}`}
                />
              ))}
            </div>
          </div>
          {next && (
            <p className="mt-0.5 text-xs text-stone-500">
              {locale.mastery.nextLevel(next.icon, next.name, next.req ?? '')}
            </p>
          )}
          <p className="mt-0.5 text-xs text-stone-400" title={locale.mastery.xpTooltip}>
            {locale.mastery.totalXpLabel(totalXp)}
            {totalAttempts > 0 && locale.mastery.avgXpLabel((totalXp / totalAttempts).toFixed(1))}
          </p>
        </div>
        {canDownload && (
          <button
            onClick={() => setShowDownload((v) => !v)}
            className="tap-highlight rounded-full p-2 text-stone-400 hover:text-cf-accent"
            aria-label={locale.mastery.downloadCert}
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>
      {showDownload && canDownload && (
        <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-700">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={locale.certificate.namePlaceholder}
            aria-label={locale.certificate.nameLabel}
            className="mb-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-center text-sm dark:bg-stone-700 dark:border-stone-600 dark:text-white"
          />
          <button
            onClick={handleDownload}
            className="tap-highlight w-full rounded-xl bg-cf-accent py-2 text-sm font-semibold text-white"
          >
            {locale.mastery.downloadLevel(LEVEL_DESIGNS[currentIndex].title)}
          </button>
        </div>
      )}
    </div>
  )
}
