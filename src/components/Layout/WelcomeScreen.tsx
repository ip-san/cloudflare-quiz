import { ArrowRight, GraduationCap, Play, Sparkles, TrendingUp } from 'lucide-react'
import { AppLogo } from '@/components/Layout/AppLogo'
import { locale } from '@/config/locale'
import { getSubtitle, theme } from '@/config/theme'
import { haptics } from '@/lib/haptics'
import { hasSeenFlag, setSeenFlag } from '@/lib/storage'
import { buttonStyles } from '@/lib/styles'
import { useQuizStore } from '@/stores/quizStore'

const WELCOME_KEY = `${theme.storagePrefix}-welcomed`
const LEGACY_WELCOME_KEY = 'claude-quiz-welcomed'

interface WelcomeScreenProps {
  onComplete: () => void
}

// welcomeFeatures の各項目に対応するアイコン（項目数が多い場合は循環して使用）
const FEATURE_ICONS = [Sparkles, GraduationCap, TrendingUp] as const

/**
 * 初回起動時のウェルカム画面
 * localStorageで表示済みフラグを管理
 */
export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const questionCount = useQuizStore((s) => s.allQuestions.length)
  const allQuestions = useQuizStore((s) => s.allQuestions)
  const startSessionWithIds = useQuizStore((s) => s.startSessionWithIds)

  const handleStart = () => {
    setSeenFlag(WELCOME_KEY)
    onComplete()
  }

  const handleTryOne = () => {
    setSeenFlag(WELCOME_KEY)
    haptics.light()
    // Pick one random beginner question for instant value
    const beginners = allQuestions.filter((q) => q.difficulty === 'beginner')
    const pick = beginners[Math.floor(Math.random() * beginners.length)]
    if (pick) {
      onComplete()
      // Start session after navigation completes
      setTimeout(() => startSessionWithIds([pick.id], locale.welcome.tryOneSessionLabel), 100)
    } else {
      onComplete()
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cf-surface px-6">
      <div className="w-full max-w-sm animate-view-enter text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <AppLogo size={96} />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-cf-ink sm:text-2xl">{theme.appName}</h1>
        <p className="mb-2 text-sm text-cf-muted">{theme.tagline}</p>
        <p className="mb-6 text-xs text-stone-500">{getSubtitle(questionCount)}</p>

        {/* Features */}
        <div className="mb-8 space-y-3 text-left">
          {theme.welcomeFeatures.map((feature, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-xs animate-feedback-section dark:bg-stone-800"
                style={{ animationDelay: `${(i + 1) * 150}ms` }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50">
                  <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cf-ink">{feature.title}</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{feature.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA — two equal-weight buttons */}
        <button
          onClick={handleTryOne}
          className={`${buttonStyles.brand} tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-lg font-bold shadow-lg`}
        >
          <Play className="h-5 w-5 fill-cf-ink" />
          {locale.welcome.tryOneQuestion}
        </button>
        <button
          onClick={handleStart}
          className="tap-highlight mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-cf-accent px-6 py-3 text-base font-semibold text-cf-accent"
        >
          <span>{locale.welcome.startButton}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * ウェルカム画面の表示済み判定
 * レガシーキーもフォールバックで確認（テーマプレフィックス移行対応）
 */
export function hasSeenWelcome(): boolean {
  return hasSeenFlag(WELCOME_KEY) || hasSeenFlag(LEGACY_WELCOME_KEY)
}
