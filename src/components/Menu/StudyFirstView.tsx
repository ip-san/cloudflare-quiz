import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import {
  getOverviewQuestionsOrdered,
  OVERVIEW_CHAPTERS,
  type OverviewChapter,
} from '@/domain/valueObjects/OverviewChapter'
import { trackStudyFirst } from '@/lib/analytics'
import { haptics } from '@/lib/haptics'
import { headerStyles } from '@/lib/styles'

interface StudyFirstViewProps {
  allQuestions: readonly Question[]
  userProgress: UserProgress
  onBack: () => void
  onStartQuiz: (chapterId: number, startIndex: number) => void
}

/**
 * 「読んでから解く」モード
 *
 * チャプターを選択 → 解説を読む → クイズに挑戦 の3ステップ。
 * 初心者が解説を先に読んでから問題に取り組める導線を提供する。
 */
export function StudyFirstView({ allQuestions, userProgress, onBack, onStartQuiz }: StudyFirstViewProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [readingComplete, setReadingComplete] = useState(false)

  const overviewQuestions = useMemo(() => getOverviewQuestionsOrdered(allQuestions), [allQuestions])

  const chapters = useMemo(() => {
    return OVERVIEW_CHAPTERS.map((ch) => {
      // 「読んでから解く」では beginner のみ表示（初心者が読み進められる難易度）
      const questions = overviewQuestions.filter((q) => q.tags.includes(ch.tag) && q.difficulty === 'beginner')
      const startIndex = questions[0] ? overviewQuestions.indexOf(questions[0]) : 0
      let answered = 0
      for (const q of questions) {
        const p = userProgress.questionProgress[q.id]
        if (p && p.attempts > 0) answered++
      }
      return { ...ch, questions, startIndex, total: questions.length, answered }
    })
  }, [overviewQuestions, userProgress])

  const selectedChapter = selectedChapterId !== null ? chapters.find((ch) => ch.id === selectedChapterId) : null

  if (selectedChapter && !readingComplete) {
    return (
      <StudyReader
        chapter={selectedChapter}
        onBack={() => {
          setSelectedChapterId(null)
          setReadingComplete(false)
        }}
        onComplete={() => {
          trackStudyFirst(selectedChapter.id, 'finish_reading')
          setReadingComplete(true)
        }}
      />
    )
  }

  if (selectedChapter && readingComplete) {
    return (
      <ReadyToQuiz
        chapter={selectedChapter}
        questionCount={selectedChapter.total}
        onStartQuiz={() => {
          trackStudyFirst(selectedChapter.id, 'start_quiz')
          onStartQuiz(selectedChapter.id, selectedChapter.startIndex)
        }}
        onReread={() => setReadingComplete(false)}
        onBack={() => {
          setSelectedChapterId(null)
          setReadingComplete(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-dvh bg-cf-surface dark:bg-stone-900">
      {/* Header */}
      <div className={headerStyles.sticky}>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="tap-highlight rounded-full p-1" aria-label={locale.common.back}>
              <ArrowLeft className="h-5 w-5 text-stone-600 dark:text-stone-300" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-cf-ink dark:text-stone-100">{locale.studyFirst.title}</h1>
              <p className="text-xs text-stone-500">{locale.studyFirst.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {/* Explanation */}
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {locale.studyFirst.howToLearnTitle}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">{locale.studyFirst.howToLearnBody}</p>
            </div>
          </div>
        </div>

        {/* Chapter list */}
        <div className="space-y-3">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                haptics.light()
                trackStudyFirst(ch.id, 'start_reading')
                setSelectedChapterId(ch.id)
                setReadingComplete(false)
              }}
              className="tap-highlight flex w-full items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition-all hover:border-cf-accent/30 dark:border-stone-700 dark:bg-stone-800"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cf-accent/10">
                <span className="text-2xl">{ch.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-cf-accent">Ch.{ch.id}</span>
                  {ch.answered === ch.total && ch.total > 0 && <span className="text-xs">✅</span>}
                </div>
                <p className="text-sm font-semibold text-cf-ink dark:text-stone-200">{ch.name}</p>
                <p className="text-xs text-stone-500">{ch.subtitle}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {ch.total}
                  {locale.common.questionSuffix}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * チャプター導入読み物
 * クイズの解説ではなく、「このチャプターで何ができるようになるか」を
 * ワクワクする文章で伝える。初心者が読み進められる平易な内容。
 */
function StudyReader({
  chapter,
  onBack,
  onComplete,
}: {
  chapter: OverviewChapter
  onBack: () => void
  onComplete: () => void
}) {
  const introContent = chapter.introContent ?? []

  return (
    <div className="flex min-h-dvh flex-col bg-cf-surface dark:bg-stone-900">
      {/* Header */}
      <div className={headerStyles.sticky}>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="tap-highlight rounded-full p-1" aria-label={locale.common.back}>
              <ArrowLeft className="h-5 w-5 text-stone-600 dark:text-stone-300" />
            </button>
            <div>
              <span className="text-xs font-medium text-cf-accent">
                {chapter.icon} Ch.{chapter.id}
              </span>
              <p className="text-sm font-semibold text-cf-ink dark:text-stone-200">{chapter.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="animate-view-enter rounded-2xl bg-white p-6 shadow-xs dark:bg-stone-800">
            {/* Chapter icon + title */}
            <div className="mb-5 text-center">
              <span className="text-4xl">{chapter.icon}</span>
              <h2 className="mt-2 text-xl font-bold text-cf-ink dark:text-stone-100">{chapter.name}</h2>
              <p className="mt-1 text-sm text-stone-400">{chapter.subtitle}</p>
            </div>

            {/* Intro paragraphs */}
            <div className="space-y-4">
              {introContent.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed text-stone-600 dark:text-stone-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Action item */}
            <div className="mt-6 rounded-xl border border-cf-accent/20 bg-cf-accent/5 p-4">
              <p className="text-xs font-semibold text-cf-accent">{locale.studyFirst.afterLearning}</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{chapter.actionItem}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom button */}
      <div className="sticky bottom-0 border-t border-stone-200 bg-white/80 px-4 py-3 backdrop-blur-xs dark:border-stone-700 dark:bg-stone-800/80">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => {
              haptics.light()
              onComplete()
            }}
            className="tap-highlight flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cf-accent text-base font-semibold text-white"
          >
            {locale.studyFirst.doneReading}
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 読了後のクイズ開始確認画面
 */
function ReadyToQuiz({
  chapter,
  questionCount,
  onStartQuiz,
  onReread,
  onBack,
}: {
  chapter: OverviewChapter
  questionCount: number
  onStartQuiz: () => void
  onReread: () => void
  onBack: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cf-surface px-6 dark:bg-stone-900">
      <div className="w-full max-w-sm animate-view-enter text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-cf-ink dark:text-stone-100">{locale.studyFirst.readingDoneTitle}</h2>
        <p className="mb-1 text-sm text-stone-500">
          {chapter.icon} Ch.{chapter.id}: {chapter.name}
        </p>
        <p className="mb-6 text-xs text-stone-500">{locale.studyFirst.readingDoneBody(questionCount)}</p>

        <div className="space-y-3">
          <button
            onClick={() => {
              haptics.light()
              onStartQuiz()
            }}
            className="tap-highlight flex w-full items-center justify-center gap-2 rounded-2xl bg-cf-accent py-3.5 text-base font-semibold text-white shadow-md"
          >
            <Play className="h-5 w-5 fill-white" />
            {locale.studyFirst.startQuiz}
          </button>
          <button
            onClick={() => {
              haptics.light()
              onReread()
            }}
            className="tap-highlight w-full rounded-2xl border border-stone-200 bg-white py-3 text-sm font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          >
            {locale.studyFirst.reread}
          </button>
          <button onClick={onBack} className="tap-highlight w-full py-2 text-sm text-stone-400">
            {locale.studyFirst.backToChapters}
          </button>
        </div>
      </div>
    </div>
  )
}
