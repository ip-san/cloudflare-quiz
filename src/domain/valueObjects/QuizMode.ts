/**
 * QuizMode Value Object
 * Represents different quiz session modes
 */
import { theme } from '@/config/theme'

export type QuizModeId =
  | 'full'
  | 'category'
  | 'random'
  | 'quick'
  | 'weak'
  | 'unanswered'
  | 'custom'
  | 'bookmark'
  | 'review'
  | 'overview'
  | 'scenario'
  | 'practical'
  | 'trivia'

export interface QuizModeProps {
  readonly id: QuizModeId
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly questionCount: number | null
  readonly timeLimit: number | null
  readonly shuffleQuestions: boolean
  readonly shuffleOptions: boolean
}

/** QuizModeId に値を追加したら必ずここにも追加すること */
export const ALL_MODE_IDS: readonly QuizModeId[] = [
  'full',
  'category',
  'random',
  'quick',
  'weak',
  'unanswered',
  'custom',
  'bookmark',
  'review',
  'overview',
  'scenario',
  'practical',
  'trivia',
] as const

export class QuizMode {
  readonly id: QuizModeId
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly questionCount: number | null
  readonly timeLimit: number | null
  readonly shuffleQuestions: boolean
  readonly shuffleOptions: boolean

  private constructor(props: QuizModeProps) {
    this.id = props.id
    this.name = props.name
    this.description = props.description
    this.icon = props.icon
    this.questionCount = props.questionCount
    this.timeLimit = props.timeLimit
    this.shuffleQuestions = props.shuffleQuestions
    this.shuffleOptions = props.shuffleOptions
  }

  static create(props: QuizModeProps): QuizMode {
    if (!ALL_MODE_IDS.includes(props.id)) {
      throw new Error(`Invalid quiz mode: ${props.id}`)
    }
    return new QuizMode(props)
  }

  static fromId(id: QuizModeId): QuizMode {
    const mode = PREDEFINED_QUIZ_MODES.find((m) => m.id === id)
    if (!mode) {
      throw new Error(`Unknown quiz mode: ${id}`)
    }
    return mode
  }

  hasTimeLimit(): boolean {
    return this.timeLimit !== null && this.timeLimit > 0
  }

  hasQuestionLimit(): boolean {
    return this.questionCount !== null && this.questionCount > 0
  }

  equals(other: QuizMode): boolean {
    return this.id === other.id
  }

  toJSON(): QuizModeProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      questionCount: this.questionCount,
      timeLimit: this.timeLimit,
      shuffleQuestions: this.shuffleQuestions,
      shuffleOptions: this.shuffleOptions,
    }
  }
}

// Pre-defined quiz modes
export const PREDEFINED_QUIZ_MODES: QuizMode[] = [
  QuizMode.create({
    id: 'overview',
    name: '全体像モード',
    description: `${theme.subject}の全機能を幅広くカバー`,
    icon: '🗺️',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'full',
    name: '実力テスト',
    description: '全カテゴリから100問に挑戦（制限時間60分）',
    icon: '🎯',
    questionCount: 100,
    timeLimit: 60,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'category',
    name: 'カテゴリ別学習',
    description: '選択したカテゴリの問題に集中',
    icon: '📂',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'random',
    name: 'ランダム20問',
    description: '全カテゴリからランダムに20問',
    icon: '🎲',
    questionCount: 20,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'quick',
    name: '復習チェック',
    description: 'SRS復習期限の問題を優先出題',
    icon: '⚡',
    questionCount: 3,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'weak',
    name: '苦手克服モード',
    description: '正答率の低い問題を優先出題',
    icon: '🔥',
    questionCount: 20,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'unanswered',
    name: '未正解に挑戦',
    description: 'まだ正解していない問題をカテゴリ別に',
    icon: '❓',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'bookmark',
    name: '後で学ぶ',
    description: '保存した問題をまとめて学習',
    icon: '📌',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'review',
    name: '間違い復習',
    description: '間違えた問題を解説付きで復習',
    icon: '📖',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'scenario',
    name: '実践シナリオ',
    description: theme.scenarioModeDescription,
    icon: '📖',
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'practical',
    name: '実務即戦力20問',
    description: '明日から使える実務直結の機能を厳選',
    icon: '🛠️',
    questionCount: 20,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
  QuizMode.create({
    id: 'trivia',
    name: '上級トリビア20問',
    description: '細かい仕様や内部挙動でドヤれる知識を強化',
    icon: '🧠',
    questionCount: 20,
    timeLimit: null,
    shuffleQuestions: true,
    shuffleOptions: false,
  }),
]

export function getQuizModeById(id: QuizModeId): QuizMode | undefined {
  return PREDEFINED_QUIZ_MODES.find((m) => m.id === id)
}
