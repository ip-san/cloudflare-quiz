/**
 * ProgressExportService - 進捗データのCSVエクスポートサービス
 *
 * 学習進捗をCSV形式でエクスポートする機能を提供。
 * QuizSessionService と同様、すべてのメソッドが static でステートレス。
 */

import type { Question } from '../entities/Question'
import type { UserProgress } from '../entities/UserProgress'
import { calculateAccuracy } from '../valueObjects/ScoreThresholds'

export class ProgressExportService {
  /** ヘッダー行 + データ行を CSV 文字列に結合 */
  private static toCsv(headers: string[], rows: (string | number)[][]): string {
    return [headers.join(','), ...rows.map((row) => row.map((v) => this.escapeCsvValue(String(v))).join(','))].join(
      '\r\n'
    )
  }

  /**
   * 問題別の進捗CSVを生成
   */
  static generateQuestionCsv(questions: Question[], progress: UserProgress): string {
    const headers = ['問題ID', 'カテゴリ', '難易度', '回答回数', '正解回数', '正答率(%)', '最終回答日時']
    const rows = questions.map((q) => {
      const qp = progress.questionProgress[q.id]
      const attempts = qp?.attempts ?? 0
      const correctCount = qp?.correctCount ?? 0
      const accuracy = calculateAccuracy(correctCount, attempts)
      const lastAttempt = qp?.lastAttemptAt ? new Date(qp.lastAttemptAt).toISOString() : ''
      return [q.id, q.category, q.difficulty, attempts, correctCount, accuracy, lastAttempt]
    })

    return this.toCsv(headers, rows)
  }

  /**
   * カテゴリ別サマリーCSVを生成
   */
  static generateCategoryCsv(questions: Question[], progress: UserProgress): string {
    const headers = ['カテゴリ', '総問題数', '回答済み', '正答率(%)']
    const categoryMap = new Map<string, { total: number; attempted: number; correct: number }>()

    for (const q of questions) {
      if (!categoryMap.has(q.category)) {
        categoryMap.set(q.category, { total: 0, attempted: 0, correct: 0 })
      }
      const cat = categoryMap.get(q.category)
      if (!cat) continue
      cat.total++
      const qp = progress.questionProgress[q.id]
      if (qp && qp.attempts > 0) {
        cat.attempted++
        cat.correct += qp.correctCount
      }
    }

    const rows = Array.from(categoryMap.entries()).map(([category, stats]) => {
      const totalAttempts = questions
        .filter((q) => q.category === category)
        .reduce((sum, q) => {
          const qp = progress.questionProgress[q.id]
          return sum + (qp?.attempts ?? 0)
        }, 0)
      const accuracy = calculateAccuracy(stats.correct, totalAttempts)
      return [category, stats.total, stats.attempted, accuracy]
    })

    return this.toCsv(headers, rows)
  }

  /**
   * CSVの値をエスケープ（カンマ、引用符、改行対応）
   */
  private static escapeCsvValue(value: string): string {
    // Prevent CSV formula injection (=, +, -, @ are interpreted as formulas by spreadsheets)
    let safe = value
    if (/^[=+\-@]/.test(safe)) {
      safe = `'${safe}`
    }
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`
    }
    return safe
  }
}
