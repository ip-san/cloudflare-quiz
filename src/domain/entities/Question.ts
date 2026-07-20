/**
 * Question Entity - クイズ問題を表すエンティティ
 *
 * 【エンティティとは】
 * DDD におけるエンティティは、識別子（ID）によって区別されるオブジェクト。
 * 同じ内容でも ID が異なれば別の問題として扱われる。
 *
 * 【不変性（Immutability）の設計】
 * このエンティティは不変（immutable）として設計している。
 * - すべてのプロパティは readonly
 * - 配列は Object.freeze() で凍結
 * - 変更が必要な場合は新しいインスタンスを作成
 *
 * 【なぜ不変にするのか】
 * - 予期しない状態変更を防ぐ
 * - React の再レンダリング判定（===）と相性が良い
 * - デバッグが容易（状態の履歴が追跡しやすい）
 *
 * 【ファクトリパターン】
 * - private constructor: 直接 new できない
 * - Question.create(): バリデーション付きで作成
 * - Question.fromData(): 外部データから安全に作成（例外を投げない）
 */

import { theme } from '@/config/theme'
import type { DiagramData } from '../valueObjects/Diagram'
import type { DifficultyLevel } from '../valueObjects/Difficulty'

/**
 * 選択肢の値オブジェクト
 *
 * wrongFeedback は間違った選択肢を選んだときのフィードバック。
 * なぜその選択肢が間違いなのかを説明する。
 */
export interface QuizOption {
  readonly text: string
  readonly wrongFeedback?: string | undefined
}

/**
 * Question のプロパティ型
 *
 * 外部からの入力データ型として使用される。
 * Question.create() の引数として渡される。
 */
/**
 * 問題タイプ
 * - single: 単一選択（従来の4択）
 * - multi: 複数選択（「該当するものを全て選んでください」）
 */
export type QuestionType = 'single' | 'multi'

export interface QuestionProps {
  readonly id: string
  readonly question: string
  readonly options: QuizOption[]
  readonly correctIndex?: number | undefined
  readonly explanation: string
  readonly referenceUrl?: string | undefined
  readonly aiPrompt?: string | undefined
  readonly hint?: string | undefined
  readonly category: string
  readonly difficulty: DifficultyLevel
  readonly tags?: string[] | undefined
  readonly type?: QuestionType | undefined
  readonly correctIndices?: number[] | undefined
  readonly diagram?: DiagramData | undefined
  readonly diagrams?: DiagramData[] | undefined
}

export class Question {
  readonly id: string
  readonly question: string
  readonly options: readonly QuizOption[]
  readonly correctIndex: number
  readonly explanation: string
  readonly referenceUrl?: string | undefined
  readonly aiPrompt?: string | undefined
  readonly hint?: string | undefined
  readonly category: string
  readonly difficulty: DifficultyLevel
  readonly tags: readonly string[]
  readonly type: QuestionType
  readonly correctIndices: readonly number[]
  readonly diagram?: DiagramData | undefined
  readonly diagrams: readonly DiagramData[]

  /**
   * Private constructor - 外部から直接 new できない
   *
   * これにより、バリデーションを経ずにインスタンスを作成することを防ぐ。
   */
  private constructor(props: QuestionProps) {
    this.id = props.id
    this.question = props.question
    this.options = Object.freeze([...props.options])
    this.explanation = props.explanation
    this.referenceUrl = props.referenceUrl
    this.aiPrompt = props.aiPrompt
    this.hint = props.hint
    this.category = props.category
    this.difficulty = props.difficulty
    this.tags = Object.freeze(props.tags ?? [])
    this.diagram = props.diagram ? Object.freeze(props.diagram) : undefined
    // diagrams 優先、なければ diagram から配列化（後方互換）
    this.diagrams = Object.freeze(props.diagrams ? [...props.diagrams] : props.diagram ? [props.diagram] : [])
    this.type = props.type ?? 'single'
    if (this.type === 'multi' && props.correctIndices) {
      this.correctIndices = Object.freeze([...props.correctIndices])
      this.correctIndex = props.correctIndex ?? props.correctIndices[0]
    } else {
      this.correctIndex = props.correctIndex ?? 0
      this.correctIndices = Object.freeze([this.correctIndex])
    }
  }

  /**
   * ファクトリメソッド - バリデーション付きで Question を作成
   *
   * 【バリデーションルール】
   * - ID: 必須、空文字不可
   * - question: 必須、空文字不可
   * - options: 2〜6個
   * - correctIndex: options の範囲内
   * - explanation: 必須
   * - referenceUrl: 指定時は有効な URL 形式
   *
   * バリデーション失敗時は例外を投げる。
   */
  static create(props: QuestionProps): Question {
    // Validation
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Question ID is required')
    }
    if (!props.question || props.question.trim().length === 0) {
      throw new Error('Question text is required')
    }
    if (props.options.length < 2) {
      throw new Error('At least 2 options are required')
    }
    if (props.options.length > 6) {
      throw new Error('Maximum 6 options allowed')
    }
    if (props.type === 'multi') {
      if (!props.correctIndices || props.correctIndices.length < 2) {
        throw new Error('Multi-select questions require at least 2 correct indices')
      }
      const uniqueIndices = new Set(props.correctIndices)
      if (uniqueIndices.size !== props.correctIndices.length) {
        throw new Error('correctIndices must not contain duplicates')
      }
      for (const idx of props.correctIndices) {
        if (idx < 0 || idx >= props.options.length) {
          throw new Error('All correctIndices must be within options array bounds')
        }
      }
    } else {
      const ci = props.correctIndex ?? 0
      if (ci < 0 || ci >= props.options.length) {
        throw new Error('correctIndex must be within options array bounds')
      }
    }
    if (!props.explanation || props.explanation.trim().length === 0) {
      throw new Error('Explanation is required')
    }
    if (props.referenceUrl) {
      try {
        const url = new URL(props.referenceUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Reference URL must use http or https protocol')
        }
      } catch {
        throw new Error('Reference URL must be a valid HTTP/HTTPS URL')
      }
    }

    return new Question(props)
  }

  /**
   * 外部データから安全に Question を作成
   *
   * 【fromData と create の違い】
   * - create: バリデーション失敗時に例外を投げる
   * - fromData: バリデーション失敗時に null を返す
   *
   * JSON インポート時など、データが信頼できない場合に使用。
   * 例外を投げないため、呼び出し側でエラーハンドリングしやすい。
   */
  static fromData(data: unknown): Question | null {
    try {
      if (!data || typeof data !== 'object') return null
      const d = data as Record<string, unknown>

      // correctIndex の型変換（multi では省略可能）
      const correctIndex = d.correctIndex != null ? Number(d.correctIndex) : undefined
      if (correctIndex != null && Number.isNaN(correctIndex)) {
        return null // 不正な数値は拒否
      }

      const questionType = d.type === 'multi' ? ('multi' as QuestionType) : ('single' as QuestionType)
      const correctIndices = Array.isArray(d.correctIndices)
        ? d.correctIndices.map(Number).filter((n) => !Number.isNaN(n))
        : undefined

      return Question.create({
        id: String(d.id ?? ''),
        question: String(d.question ?? ''),
        options: Array.isArray(d.options)
          ? d.options.map((o) => ({
              text: String((o as Record<string, unknown>).text ?? ''),
              wrongFeedback: (o as Record<string, unknown>).wrongFeedback
                ? String((o as Record<string, unknown>).wrongFeedback)
                : undefined,
            }))
          : [],
        correctIndex,
        explanation: String(d.explanation ?? ''),
        referenceUrl: d.referenceUrl ? String(d.referenceUrl) : undefined,
        aiPrompt: d.aiPrompt ? String(d.aiPrompt) : undefined,
        hint: d.hint ? String(d.hint) : undefined,
        category: String(d.category ?? ''),
        difficulty: (d.difficulty as DifficultyLevel) ?? 'beginner',
        tags: Array.isArray(d.tags) ? d.tags.map(String) : undefined,
        type: questionType,
        correctIndices,
        diagram: d.diagram as DiagramData | undefined,
        diagrams: Array.isArray(d.diagrams) ? (d.diagrams as DiagramData[]) : undefined,
      })
    } catch {
      return null
    }
  }

  /**
   * 複数選択問題かどうか
   */
  get isMultiSelect(): boolean {
    return this.type === 'multi'
  }

  /**
   * 回答が正解かどうかを判定（単一選択用）
   */
  isCorrectAnswer(answerIndex: number): boolean {
    return answerIndex === this.correctIndex
  }

  /**
   * 複数選択の回答が正解かどうかを判定
   *
   * 完全一致のみ正解：全正解を選び、かつ不正解を1つも選んでいない場合のみ true
   */
  isCorrectMultiAnswer(selectedIndices: number[]): boolean {
    if (!this.isMultiSelect) return false
    if (selectedIndices.length !== this.correctIndices.length) return false
    const selected = new Set(selectedIndices)
    const correct = new Set(this.correctIndices as number[])
    for (const idx of selected) {
      if (!correct.has(idx)) return false
    }
    return true
  }

  /**
   * 正解の選択肢を取得（単一選択の後方互換用）
   */
  getCorrectOption(): QuizOption {
    return this.options[this.correctIndex]
  }

  /**
   * 全正解の選択肢を取得
   */
  getCorrectOptions(): QuizOption[] {
    return this.correctIndices.map((i) => this.options[i])
  }

  /**
   * 指定インデックスが正解かどうか
   */
  isCorrectIndex(index: number): boolean {
    if (this.isMultiSelect) {
      return this.correctIndices.includes(index)
    }
    return index === this.correctIndex
  }

  /**
   * 不正解時のフィードバックを取得
   */
  getWrongFeedback(answerIndex: number): string | undefined {
    if (this.isCorrectIndex(answerIndex)) return undefined
    return this.options[answerIndex]?.wrongFeedback
  }

  /**
   * AI に質問するためのプロンプトを生成
   *
   * aiPrompt が設定されていればそれを使用、
   * なければデフォルトのプロンプトを生成。
   */
  generateAIPrompt(): string {
    return this.generateAIPromptByType('explain')
  }

  /**
   * タイプ別 AI プロンプトを生成
   *
   * - explain: 噛み砕いて解説（初心者向け）
   * - practical: 実践的なシナリオ・活用例
   * - compare: 類似概念との比較・使い分け
   */
  generateAIPromptByType(type: 'explain' | 'practical' | 'compare'): string {
    // explain タイプのみ、問題固有のカスタムプロンプトがあればそれを優先
    if (type === 'explain' && this.aiPrompt) return this.aiPrompt

    // 複数選択の場合、prefix に最初の "- " を含め、join で後続を "\n- " で繋ぐ
    const correctAnswers = this.isMultiSelect
      ? this.getCorrectOptions()
          .map((o) => o.text)
          .join('\n- ')
      : this.getCorrectOption().text
    const prefix = this.isMultiSelect ? '正解（複数）:\n- ' : '正解: '

    const context = `問題: ${this.question}\n${prefix}${correctAnswers}\n解説: ${this.explanation}`

    const subject = theme.subject

    switch (type) {
      case 'explain':
        return `${subject}の以下のトピックについて、初心者にもわかるように噛み砕いて説明してください。専門用語には簡単な補足を添えてください。

${context}

この機能が「なぜ必要なのか」を日常の例え話も交えて教えてください。`
      case 'practical':
        return `${subject}の以下の機能について、実際の開発プロジェクトでの活用シナリオを3つ教えてください。それぞれ「どんな場面で」「具体的にどう使うか」「得られる効果」を含めてください。

${context}`
      case 'compare':
        return `${subject}の以下のトピックに関連する類似機能や概念との違いを整理してください。「どんな場面でどちらを選ぶべきか」の判断基準も教えてください。

${context}`
    }
  }

  /**
   * Markdown 形式でエクスポート
   *
   * 「AIに質問」機能でクリップボードにコピーする際に使用。
   */
  toMarkdown(): string {
    const correctSection = this.isMultiSelect
      ? `**正解（複数）:**\n${this.getCorrectOptions()
          .map((o) => `- ${o.text}`)
          .join('\n')}`
      : `**正解:** ${this.getCorrectOption().text}`

    return `## ${theme.appName}

**問題:** ${this.question}

${correctSection}

**解説:** ${this.explanation}

${this.referenceUrl ? `**参考:** ${this.referenceUrl}` : ''}

---

この問題について詳しく説明してください。具体的な使用例も含めて教えていただけると助かります。`
  }

  /**
   * 等価性の判定
   *
   * エンティティは ID で等価性を判定する。
   * 内容が同じでも ID が異なれば別のエンティティ。
   */
  equals(other: Question): boolean {
    return this.id === other.id
  }

  /**
   * JSON シリアライズ用
   */
  toJSON(): QuestionProps {
    return {
      id: this.id,
      question: this.question,
      options: [...this.options],
      correctIndex: this.isMultiSelect ? undefined : this.correctIndex,
      explanation: this.explanation,
      referenceUrl: this.referenceUrl,
      aiPrompt: this.aiPrompt,
      hint: this.hint,
      category: this.category,
      difficulty: this.difficulty,
      tags: [...this.tags],
      type: this.type,
      correctIndices: this.isMultiSelect ? [...this.correctIndices] : undefined,
      diagram: this.diagram,
      diagrams: this.diagrams.length > 0 ? [...this.diagrams] : undefined,
    }
  }
}
