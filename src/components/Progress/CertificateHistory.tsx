import { Award, Download } from 'lucide-react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import type { SessionRecord } from '@/domain/entities/UserProgress'
import { isCertificateEligible, PASSING_SCORE, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'
import { generateCertificate, LEVEL_DESIGNS } from '@/lib/certificateCanvas'
import { useCertificateName } from '@/lib/useCertificateName'

interface CertificateHistoryProps {
  sessionHistory: readonly SessionRecord[]
  masteryIndex: number
  overallAccuracy: number
}

interface CertEntry {
  readonly key: string
  readonly levelIndex: number
  readonly icon: string
  readonly title: string
  readonly color: string
  readonly description: string
  readonly scoreLine: string
  readonly date?: string
}

const CERT_COLORS = ['', 'text-blue-600', 'text-green-600', 'text-purple-600', 'text-amber-600']
const CERT_BG = [
  '',
  'bg-blue-50 dark:bg-blue-950',
  'bg-green-50 dark:bg-green-950',
  'bg-purple-50 dark:bg-purple-950',
  'bg-amber-50 dark:bg-amber-950',
]

function estimateLevelFromScore(percentage: number): number {
  if (percentage >= SCORE_COLORS.excellent + 5) return 4 // 85%
  if (percentage >= SCORE_COLORS.excellent) return 3 // 80%
  if (percentage >= PASSING_SCORE) return 2 // 70%
  return 1
}

export function CertificateHistory({ sessionHistory, masteryIndex, overallAccuracy }: CertificateHistoryProps) {
  const [name, setName] = useCertificateName()
  const entries: CertEntry[] = []

  // 1. Mastery level certificates
  for (let i = masteryIndex; i >= 1; i--) {
    const level = theme.masteryLevels[i]
    entries.push({
      key: `mastery-${i}`,
      levelIndex: i,
      icon: level.icon,
      title: LEVEL_DESIGNS[i].title,
      color: CERT_COLORS[i],
      description: locale.mastery.levelReached(level.name, level.req ?? locale.common.start),
      scoreLine: `${locale.progress.accuracy} ${overallAccuracy}%`,
    })
  }

  // 2. Session-based certificates
  const modeLabel = (mode: string) =>
    mode === 'overview' ? locale.sessionHistory.modes.overview : locale.sessionHistory.modes.full
  sessionHistory
    .filter((s) => isCertificateEligible(s.mode, s.percentage))
    .reverse()
    .forEach((session) => {
      const levelIndex = estimateLevelFromScore(session.percentage)
      entries.push({
        key: `session-${session.id}`,
        levelIndex,
        icon: theme.masteryLevels[levelIndex].icon,
        title: LEVEL_DESIGNS[levelIndex].title,
        color: CERT_COLORS[levelIndex],
        description: `${modeLabel(session.mode)} — ${session.percentage}%（${session.score}/${session.totalQuestions}${locale.common.questionSuffix}）`,
        scoreLine: `${session.percentage}%`,
        date: new Date(session.completedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      })
    })

  const handleDownload = (cert: CertEntry) => {
    generateCertificate({
      levelIndex: cert.levelIndex,
      levelIcon: cert.icon,
      levelName: theme.masteryLevels[cert.levelIndex].name,
      name,
      scoreLine: cert.scoreLine,
      description: cert.description,
    })
  }

  if (entries.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-stone-300 dark:text-stone-600" />
          <div>
            <p className="text-sm font-medium text-stone-500">{locale.certificate.noCertificates}</p>
            <p className="text-xs text-stone-500">{locale.certificate.eligibilityHint}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Award className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-cf-ink">{locale.certificate.earnedCount(entries.length)}</h3>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={locale.certificate.nameWithContext}
        aria-label={locale.certificate.nameLabel}
        className="mb-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-sm dark:bg-stone-700 dark:border-stone-600 dark:text-white"
      />
      <div className="flex flex-col gap-2">
        {entries.map((cert) => (
          <div key={cert.key} className={`flex items-center gap-3 rounded-xl p-3 ${CERT_BG[cert.levelIndex]}`}>
            <span className="text-2xl">{cert.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${cert.color}`}>{cert.title}</p>
              <p className="text-xs text-stone-500">{cert.description}</p>
            </div>
            {cert.date && <p className="mr-1 text-xs text-stone-500 shrink-0">{cert.date}</p>}
            <button
              onClick={() => handleDownload(cert)}
              className="tap-highlight shrink-0 rounded-full p-2 text-stone-400 hover:text-cf-accent"
              aria-label={`${cert.title} ${locale.mastery.downloadCert}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
