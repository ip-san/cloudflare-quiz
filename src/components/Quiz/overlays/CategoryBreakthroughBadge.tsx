import { TrendingUp } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import type { AnswerRecord } from '@/domain/services/QuizSessionService'
import { getCategoryById } from '@/domain/valueObjects/Category'
import { calculateAccuracy } from '@/domain/valueObjects/ScoreThresholds'
import { trackCategoryBest } from '@/lib/analytics'

interface CategoryBreakthroughBadgeProps {
  questions: readonly Question[]
  answerHistory: ReadonlyMap<number, AnswerRecord>
  userProgress: UserProgress
}

/**
 * カテゴリ別の自己ベスト更新を検出して表示
 * 「停滞している」と感じるユーザーに「実は成長している」ことを伝える
 */
export function CategoryBreakthroughBadge({ questions, answerHistory, userProgress }: CategoryBreakthroughBadgeProps) {
  const breakthroughs = useMemo(() => {
    // 今回のセッションでのカテゴリ別正答率を計算
    const categoryResults = new Map<string, { correct: number; total: number }>()
    answerHistory.forEach((record, index) => {
      const q = questions[index]
      if (!q) return
      const entry = categoryResults.get(q.category) ?? { correct: 0, total: 0 }
      entry.total++
      if (record.isCorrect) entry.correct++
      categoryResults.set(q.category, entry)
    })

    // 各カテゴリで過去の最高正答率と比較
    const results: { categoryName: string; icon: string; prev: number; now: number }[] = []
    categoryResults.forEach((result, catId) => {
      if (result.total < 3) return // 3問未満はノイズが大きいのでスキップ
      const nowAccuracy = calculateAccuracy(result.correct, result.total)
      // 過去のカテゴリ正答率を計算（questionProgress は Record<string, QuestionProgress>）
      let prevCorrect = 0
      let prevTotal = 0
      for (const [qId, progress] of Object.entries(userProgress.questionProgress)) {
        const q = questions.find((qu) => qu.id === qId)
        if (q?.category === catId && progress.attempts > 0) {
          prevTotal += progress.attempts
          prevCorrect += progress.correctCount
        }
      }
      const prevAccuracy = prevTotal > 0 ? Math.round((prevCorrect / prevTotal) * 100) : 0

      // 5%以上の改善があれば「ブレークスルー」
      if (nowAccuracy > prevAccuracy && nowAccuracy - prevAccuracy >= 5) {
        const cat = getCategoryById(catId)
        if (cat) {
          results.push({ categoryName: cat.name, icon: cat.icon, prev: prevAccuracy, now: nowAccuracy })
        }
      }
    })

    return results
  }, [questions, answerHistory, userProgress.questionProgress])

  useEffect(() => {
    for (const bt of breakthroughs) {
      trackCategoryBest(bt.categoryName, bt.prev, bt.now)
    }
  }, [breakthroughs])

  if (breakthroughs.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {breakthroughs.map((bt) => (
        <div
          key={bt.categoryName}
          className="flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-green-400 to-emerald-500 px-4 py-2.5 text-white shadow-md animate-bounce-in"
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-sm font-bold">
            {locale.categoryBreakthrough.bestUpdate(bt.icon, bt.categoryName, bt.prev, bt.now)}
          </span>
        </div>
      ))}
    </div>
  )
}
