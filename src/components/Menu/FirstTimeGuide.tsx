import { BookOpen, ChevronRight, Map as MapIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'

interface FirstTimeGuideProps {
  onOpenModes: () => void
}

/**
 * 初回ユーザー向けの導入カード
 *
 * 初心者向け:
 * - クイズで学ぶ（全体像モード）
 * - 読んでから解く
 *
 * 経験者向け:
 * - 「すでに活用されている方へ」→ ハンバーガーメニューをクイズモード展開状態で開く
 */
export function FirstTimeGuide({ onOpenModes }: FirstTimeGuideProps) {
  const { startSession, setViewState } = useQuizStore(
    useShallow((state) => ({ startSession: state.startSession, setViewState: state.setViewState }))
  )

  return (
    <div className="mb-5 space-y-3">
      {/* 初心者向け */}
      <div className="rounded-2xl border-2 border-claude-orange/30 bg-linear-to-r from-claude-orange/5 to-transparent p-4 dark:border-claude-orange/40 dark:from-claude-orange/10">
        <p className="mb-1 text-xs font-semibold text-claude-orange">{locale.firstTimeGuide.beginnerLabel}</p>
        <p className="mb-4 text-sm text-claude-dark dark:text-stone-200">{locale.firstTimeGuide.beginnerDesc}</p>
        <div className="space-y-2">
          <button
            onClick={() => {
              haptics.light()
              startSession({ mode: 'overview' })
            }}
            className="tap-highlight flex w-full items-center gap-3 rounded-2xl bg-claude-orange px-4 py-3 text-left shadow-xs"
          >
            <MapIcon className="h-5 w-5 shrink-0 text-white/80" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">{locale.firstTimeGuide.quizLearnLabel}</p>
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {locale.firstTimeGuide.recommendedBadge}
                </span>
              </div>
              <p className="text-xs text-white/70">{locale.firstTimeGuide.quizLearnDesc}</p>
            </div>
          </button>
          <button
            onClick={() => {
              haptics.light()
              setViewState('studyFirst')
            }}
            className="tap-highlight flex w-full items-center gap-3 rounded-2xl border border-claude-orange/30 bg-white px-4 py-3 text-left dark:bg-stone-800"
          >
            <BookOpen className="h-5 w-5 shrink-0 text-claude-orange" />
            <div>
              <p className="text-sm font-semibold text-claude-dark dark:text-stone-200">
                {locale.firstTimeGuide.readFirstLabel}
              </p>
              <p className="text-xs text-stone-500">{locale.firstTimeGuide.readFirstDesc}</p>
            </div>
          </button>
        </div>
      </div>

      {/* 経験者向け */}
      <button
        onClick={() => {
          haptics.light()
          onOpenModes()
        }}
        className="tap-highlight flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left dark:border-stone-700 dark:bg-stone-800"
      >
        <span className="text-sm text-stone-400">🎯</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-claude-dark dark:text-stone-200">
            {locale.firstTimeGuide.experiencedLabel}
          </p>
          <p className="text-xs text-stone-500">{locale.firstTimeGuide.experiencedDesc}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600" />
      </button>
    </div>
  )
}
