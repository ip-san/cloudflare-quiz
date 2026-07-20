/**
 * スコアに基づく結果メッセージを返すサービス
 * QuizResult から抽出した純粋関数
 */

import { theme } from '@/config/theme'

export interface ScoreMessage {
  readonly title: string
  readonly message: string
  readonly color: string
  readonly bgColor: string
  readonly borderColor: string
}

export function getScoreMessage(percentage: number): ScoreMessage {
  const messages = theme.scoreMessages
  return (messages.find((m) => percentage >= m.min) ?? messages[messages.length - 1]).result
}
