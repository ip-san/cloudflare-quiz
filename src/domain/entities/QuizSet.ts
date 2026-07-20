import { theme } from '@/config/theme'
import { Question, type QuestionProps } from './Question'

/**
 * QuizSetType - Distinguishes between default (read-only) and user (writable) sets
 */
export type QuizSetType = 'default' | 'user'

/**
 * QuizSet Entity
 * Represents a collection of questions with metadata
 */
export interface QuizSetProps {
  readonly id: string
  readonly title: string
  readonly description?: string | undefined
  readonly version?: string | undefined
  readonly type: QuizSetType
  readonly questions: Question[]
  readonly createdAt: number
  readonly updatedAt: number
}

export class QuizSet {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly version: string
  readonly type: QuizSetType
  readonly questions: readonly Question[]
  readonly createdAt: number
  readonly updatedAt: number

  private constructor(props: QuizSetProps) {
    this.id = props.id
    this.title = props.title
    this.description = props.description ?? ''
    this.version = props.version ?? '1.0.0'
    this.type = props.type
    this.questions = Object.freeze([...props.questions])
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  static create(
    props: Omit<QuizSetProps, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number }
  ): QuizSet {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('QuizSet ID is required')
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('QuizSet title is required')
    }
    if (props.questions.length === 0) {
      throw new Error('QuizSet must have at least one question')
    }

    const now = Date.now()
    return new QuizSet({
      ...props,
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now,
    })
  }

  /**
   * Create default quiz set from JSON data
   */
  static createDefault(data: {
    title?: string | undefined
    description?: string | undefined
    version?: string | undefined
    quizzes: QuestionProps[]
  }): QuizSet {
    const questions = data.quizzes.map((q) => Question.fromData(q)).filter((q): q is Question => q !== null)

    return QuizSet.create({
      id: 'default',
      title: data.title ?? `${theme.appName} マスタークイズ`,
      description: data.description,
      version: data.version,
      type: 'default',
      questions,
    })
  }

  /**
   * Check if this is a read-only set
   */
  isReadOnly(): boolean {
    return this.type === 'default'
  }

  /**
   * Get questions by category
   */
  getQuestionsByCategory(categoryId: string): Question[] {
    return this.questions.filter((q) => q.category === categoryId)
  }

  /**
   * Get questions by difficulty
   */
  getQuestionsByDifficulty(difficulty: string): Question[] {
    return this.questions.filter((q) => q.difficulty === difficulty)
  }

  /**
   * Get question count
   */
  getQuestionCount(): number {
    return this.questions.length
  }

  /**
   * Get unique categories in this set
   */
  getCategories(): string[] {
    return [...new Set(this.questions.map((q) => q.category))]
  }

  /**
   * Find question by ID
   */
  findQuestion(questionId: string): Question | undefined {
    return this.questions.find((q) => q.id === questionId)
  }

  equals(other: QuizSet): boolean {
    return this.id === other.id
  }

  toJSON(): {
    id: string
    title: string
    description: string
    version: string
    type: QuizSetType
    quizzes: QuestionProps[]
    createdAt: number
    updatedAt: number
  } {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      version: this.version,
      type: this.type,
      quizzes: this.questions.map((q) => q.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
