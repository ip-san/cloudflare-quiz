import { CheckCircle } from 'lucide-react'
import { useMemo } from 'react'
import { locale } from '@/config/locale'
import { getSkillDescription } from '@/config/theme'
import type { Question } from '@/domain/entities/Question'
import type { AnswerRecord } from '@/domain/services/QuizSessionService'

interface SkillsAcquiredProps {
  questions: readonly Question[]
  answerHistory: ReadonlyMap<number, AnswerRecord>
}

/**
 * 結果画面に表示する「身につけたスキル」セクション
 * 正解したカテゴリから、実務で何ができるようになったかを伝える
 */
export function SkillsAcquired({ questions, answerHistory }: SkillsAcquiredProps) {
  const acquiredSkills = useMemo(() => {
    const categoryCorrect = new Map<string, number>()

    answerHistory.forEach((record, index) => {
      if (record.isCorrect && questions[index]) {
        const cat = questions[index].category
        categoryCorrect.set(cat, (categoryCorrect.get(cat) ?? 0) + 1)
      }
    })

    // Only show categories where user got at least 1 correct
    return Array.from(categoryCorrect.entries())
      .filter(([, count]) => count > 0)
      .map(([catId]) => ({
        id: catId,
        description: getSkillDescription(catId),
      }))
      .filter((s) => s.description)
  }, [questions, answerHistory])

  if (acquiredSkills.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border border-green-200 bg-green-50/50 p-4 text-left dark:border-green-500/30 dark:bg-green-500/10">
      <p className="mb-2 text-xs font-semibold text-green-700 dark:text-green-400">{locale.skills.heading}</p>
      <div className="space-y-1.5">
        {acquiredSkills.map((skill) => (
          <div key={skill.id} className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <p className="text-sm text-stone-700 dark:text-stone-300">{skill.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
