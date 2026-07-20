import { Info } from 'lucide-react'
import { locale } from '@/config/locale'
import type { OverviewChapter } from '@/domain/valueObjects/OverviewChapter'

interface ChapterIndicatorProps {
  chapter: OverviewChapter
  totalChapters: number
  onShowIntro?: () => void
}

/**
 * 全体像モードのチャプター区切り表示
 * 新しいチャプターに入ったタイミングで QuizCard の上に表示する
 * タップでチャプター導入画面を再表示可能
 */
export function ChapterIndicator({ chapter, totalChapters, onShowIntro }: ChapterIndicatorProps) {
  return (
    <div className="mb-4 rounded-xl border border-claude-orange/20 bg-linear-to-r from-claude-orange/5 to-transparent px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{chapter.icon}</span>
        <div className="flex-1">
          <p className="text-xs font-medium text-claude-orange">
            Chapter {chapter.id} / {totalChapters}
          </p>
          <p className="text-sm font-semibold text-claude-dark dark:text-stone-200">{chapter.name}</p>
          <p className="text-xs text-claude-gray">{chapter.subtitle}</p>
        </div>
        {onShowIntro && (
          <button
            onClick={onShowIntro}
            className="tap-highlight rounded-full p-2 text-claude-orange/60"
            aria-label={locale.chapterIntro.showOverview}
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
