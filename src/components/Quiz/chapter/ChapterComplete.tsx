import { ArrowRight, Home, Trophy } from 'lucide-react'
import { locale } from '@/config/locale'
import type { OverviewChapter } from '@/domain/valueObjects/OverviewChapter'
import { calculateAccuracy, PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'
import { haptics } from '@/lib/haptics'

interface ChapterCompleteProps {
  chapter: OverviewChapter
  score: number
  total: number
  onContinue: () => void
  onQuit: () => void
  isLastChapter: boolean
}

/**
 * チャプター完了オーバーレイ（全体像モード）
 *
 * チャプターの最後の問題に回答した後、次のチャプターに進む前に表示。
 * 達成感を出し、「続ける/やめる」の選択肢を提供する。
 */
export function ChapterComplete({ chapter, score, total, onContinue, onQuit, isLastChapter }: ChapterCompleteProps) {
  const percentage = calculateAccuracy(score, total)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 animate-view-enter">
      <div className="w-full max-w-sm text-center">
        <div className="mb-3 text-4xl">{percentage >= PASSING_SCORE ? '🎉' : '📚'}</div>
        <p className="mb-1 text-xs font-semibold text-cf-accent">
          Ch.{chapter.id} {locale.chapterComplete.complete}
        </p>
        <h2 className="mb-2 text-lg font-bold text-cf-ink dark:text-stone-100">{chapter.name}</h2>

        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-cf-accent" />
            <span className="text-2xl font-bold text-cf-ink dark:text-white">{percentage}%</span>
          </div>
          <span className="text-sm text-stone-500">{locale.chapterComplete.correctSuffix(score, total)}</span>
        </div>

        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
          {percentage >= PASSING_SCORE ? locale.chapterComplete.wellDone : locale.chapterComplete.reviewAdvice}
        </p>

        <div className="space-y-2">
          {!isLastChapter && (
            <button
              onClick={() => {
                haptics.light()
                onContinue()
              }}
              className="tap-highlight flex w-full items-center justify-center gap-2 rounded-2xl bg-cf-accent px-6 py-3.5 text-base font-semibold text-white shadow-md"
            >
              {locale.chapterComplete.nextChapter}
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => {
              haptics.light()
              onQuit()
            }}
            className="tap-highlight flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-300 px-6 py-3.5 text-base font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
          >
            <Home className="h-5 w-5" />
            {isLastChapter ? locale.chapterComplete.seeResults : locale.chapterComplete.stopForToday}
          </button>
        </div>
      </div>
    </div>
  )
}
