import { ArrowRight, BookOpen, Brain, CheckCircle2 } from 'lucide-react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import type { OverviewChapter } from '@/domain/valueObjects/OverviewChapter'
import { OVERVIEW_CHAPTERS } from '@/domain/valueObjects/OverviewChapter'
import { trackChapterProgress } from '@/lib/analytics'
import { haptics } from '@/lib/haptics'

interface ChapterIntroProps {
  chapter: OverviewChapter
  onStart: () => void
}

/**
 * チャプター導入画面（全体像モード）
 *
 * 各チャプター開始時にフルページで表示。
 * 「知らなくて当然」のメッセージで初心者の不安を軽減し、
 * 何を学ぶかの概要を伝えてからクイズに進む。
 */

const CHAPTER_DETAILS = theme.chapterDetails

export function ChapterIntro({ chapter, onStart }: ChapterIntroProps) {
  const details = CHAPTER_DETAILS[chapter.id]
  const totalChapters = OVERVIEW_CHAPTERS.length
  const isFirstChapter = chapter.id === 1

  return (
    <div className="animate-view-enter space-y-4">
      {/* Chapter number badge */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-claude-orange/10">
          <span className="text-3xl">{chapter.icon}</span>
        </div>
        <p className="text-xs font-semibold text-claude-orange">
          Chapter {chapter.id} / {totalChapters}
        </p>
        <h2 className="mt-1 text-xl font-bold text-claude-dark dark:text-stone-100">{chapter.name}</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{chapter.subtitle}</p>
      </div>

      {/* Encouragement card */}
      {isFirstChapter && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                {locale.chapterIntro.mistakesOkTitle}
              </p>
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">{locale.chapterIntro.mistakesOkBody}</p>
            </div>
          </div>
        </div>
      )}

      {/* Learning points */}
      {details && (
        <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-stone-800">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-claude-orange" />
            <p className="text-sm font-semibold text-claude-dark dark:text-stone-200">
              {locale.chapterIntro.learningPointsHeading}
            </p>
          </div>
          <ul className="space-y-2">
            {details.learningPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-claude-orange/60" />
                <span className="text-sm text-stone-600 dark:text-stone-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Real world example */}
      {details && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800/50">
          <p className="text-xs text-stone-500 dark:text-stone-400">{details.realWorldExample}</p>
        </div>
      )}

      {/* Encouragement message */}
      {details && <p className="text-center text-xs text-stone-500 dark:text-stone-500">{details.encouragement}</p>}

      {/* Start button */}
      <div className="pt-2 text-center">
        <button
          onClick={() => {
            haptics.light()
            trackChapterProgress(chapter.id, 'start')
            onStart()
          }}
          className="tap-highlight inline-flex items-center gap-2 rounded-2xl bg-claude-orange px-8 py-3.5 text-base font-semibold text-white shadow-md"
        >
          {isFirstChapter ? locale.chapterIntro.startLearning : locale.chapterIntro.startChapter}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
