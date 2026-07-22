import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import type { QuizModeId } from '@/domain/valueObjects/QuizMode'
import { calculateAccuracy, PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'

interface WeakPointInsightProps {
  allQuestions: readonly Question[]
  userProgress: UserProgress
  categoryStats: Record<string, { totalQuestions: number; attemptedQuestions: number; correctAnswers: number }>
  onStartSession: (config: { mode: QuizModeId; categoryFilter?: string | null }) => void
}

/** referenceUrl からドキュメントページのスラッグを抽出 */
function getDocSlug(url: string | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/docs\/(?:ja|en)\/(.+?)(?:#.*)?$/)
  return m ? m[1] : null
}

/** スラッグを人間が読みやすいラベルに変換 */
function slugToLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SubtopicStat {
  slug: string
  label: string
  url: string
  attempted: number
  correct: number
  accuracy: number
}

/**
 * 弱点パターン可視化
 *
 * カテゴリ別の弱点を表示し、展開すると
 * そのカテゴリ内のどのサブトピック（ドキュメントページ）が弱いかを具体的に表示。
 */
export function WeakPointInsight({ allQuestions, userProgress, categoryStats, onStartSession }: WeakPointInsightProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const weakPoints = useMemo(() => {
    return PREDEFINED_CATEGORIES.map((cat) => {
      const stats = categoryStats[cat.id]
      if (!stats || stats.attemptedQuestions < 3) return null
      const accuracy = calculateAccuracy(stats.correctAnswers, stats.attemptedQuestions)
      const wrongCount = stats.attemptedQuestions - stats.correctAnswers
      if (accuracy >= PASSING_SCORE) return null

      // サブトピック分析: このカテゴリの問題を referenceUrl のページ別に集計
      const subtopics = new Map<string, { slug: string; url: string; attempted: number; correct: number }>()
      for (const q of allQuestions) {
        if (q.category !== cat.id) continue
        const slug = getDocSlug(q.referenceUrl)
        if (!slug) continue
        const qp = userProgress.questionProgress[q.id]
        if (!qp || qp.attempts === 0) continue

        const existing = subtopics.get(slug) ?? { slug, url: q.referenceUrl ?? '', attempted: 0, correct: 0 }
        existing.attempted += qp.attempts
        existing.correct += qp.correctCount
        subtopics.set(slug, existing)
      }

      const subtopicStats: SubtopicStat[] = [...subtopics.values()]
        .map((s) => ({
          ...s,
          label: slugToLabel(s.slug),
          accuracy: calculateAccuracy(s.correct, s.attempted),
        }))
        .filter((s) => s.accuracy < PASSING_SCORE) // 弱いサブトピックのみ
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5)

      return { id: cat.id, name: cat.name, icon: cat.icon, accuracy, wrongCount, subtopics: subtopicStats }
    })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
  }, [allQuestions, userProgress, categoryStats])

  if (weakPoints.length === 0) return null

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{locale.weakPoint.heading}</p>
      </div>
      <div className="space-y-2">
        {weakPoints.map((wp) => {
          const isExpanded = expandedCategory === wp.id
          return (
            <div key={wp.id} className="rounded-xl bg-white dark:bg-stone-800">
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : wp.id)}
                  className="tap-highlight flex flex-1 items-center gap-2 text-left"
                >
                  <span>{wp.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-cf-ink dark:text-stone-200">{wp.name}</p>
                    <p className="text-xs text-stone-500">
                      {locale.weakPointDetail.wrongCountLabel(wp.wrongCount, wp.accuracy)}
                    </p>
                  </div>
                  {wp.subtopics.length > 0 &&
                    (isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-stone-400" />
                    ))}
                </button>
                <button
                  onClick={() => onStartSession({ mode: 'category', categoryFilter: wp.id })}
                  className="tap-highlight ml-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {locale.weakPointDetail.reviewButton}
                </button>
              </div>

              {/* サブトピック詳細 */}
              {isExpanded && wp.subtopics.length > 0 && (
                <div className="border-t border-stone-100 px-3 pb-3 pt-2 dark:border-stone-700">
                  <p className="mb-2 text-xs font-medium text-stone-500">{locale.weakPointDetail.weakTopics}</p>
                  <div className="space-y-1.5">
                    {wp.subtopics.map((st) => (
                      <div key={st.slug} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  st.accuracy < 30 ? '#ef4444' : st.accuracy < 50 ? '#f59e0b' : '#eab308',
                              }}
                            />
                            <span className="text-xs text-cf-ink dark:text-stone-300">{st.label}</span>
                          </div>
                          {/* ミニプログレスバー */}
                          <div className="ml-3 mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${st.accuracy}%`,
                                backgroundColor:
                                  st.accuracy < 30 ? '#ef4444' : st.accuracy < 50 ? '#f59e0b' : '#eab308',
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-stone-500">{st.accuracy}%</span>
                        <a
                          href={st.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tap-highlight p-1 text-stone-300 dark:text-stone-600"
                          aria-label={locale.weakPointDetail.openDocLabel(st.label)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
