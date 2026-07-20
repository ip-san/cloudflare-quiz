/**
 * QuizValidator - Zod を使用したデータ検証
 *
 * 【このモジュールの役割】
 * 外部から入力されるデータ（JSON ファイル等）を検証し、
 * 型安全なオブジェクトに変換する「Anti-Corruption Layer」。
 *
 * 【Anti-Corruption Layer とは】
 * DDD のパターンの一つ。外部システムからのデータが
 * ドメインモデルを汚染しないよう、境界でデータを検証・変換する。
 *
 *   外部 JSON ────▶ QuizValidator ────▶ Domain Entity
 *   (信頼できない)    (検証・変換)        (型安全)
 *
 * 【なぜ Zod を使うのか】
 * - TypeScript との統合が優れている
 * - スキーマから型を自動生成できる（z.infer）
 * - エラーメッセージがわかりやすい
 * - 軽量で依存が少ない
 *
 * 【バリデーションの流れ】
 * 1. JSON 文字列をパース
 * 2. Zod スキーマで検証
 * 3. 成功時: ValidationResult<T> で型付きデータを返す
 * 4. 失敗時: errors 配列でエラー詳細を返す
 */

import { z } from 'zod'

// ============================================================
// Zod Schemas
// ============================================================

/**
 * 難易度スキーマ
 *
 * 3段階の難易度を定義。
 * Domain Layer の DifficultyLevel と一致させる。
 */
export const DifficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])

/**
 * 選択肢スキーマ
 *
 * wrongFeedback はオプショナル。
 * 設定されていると、不正解時に「なぜ間違いか」を表示できる。
 */
export const QuizOptionSchema = z.object({
  text: z.string().min(1, 'Option text is required'),
  wrongFeedback: z.string().optional(),
})

/**
 * 問題スキーマ
 *
 * 【検証ルール】
 * - id: 必須、1文字以上
 * - question: 必須、1文字以上
 * - options: 2〜6個の選択肢
 * - correctIndex: 0以上の整数、options の範囲内
 * - explanation: 必須（正解・不正解に関わらず表示される解説）
 * - referenceUrl: オプション、有効な URL 形式
 * - category: 必須（カテゴリ ID）
 * - difficulty: beginner / intermediate / advanced のいずれか
 *
 * 【refine による追加検証】
 * correctIndex が options.length 未満であることを確認。
 * これは単純な min/max では表現できないため refine を使用。
 */
/**
 * 問題タイプスキーマ
 * - single: 単一選択（デフォルト）
 * - multi: 複数選択（「該当するものを全て選んでください」）
 */
export const QuestionTypeSchema = z.enum(['single', 'multi']).default('single')

// ============================================================
// Diagram Schemas
// ============================================================

const DiagramItemSchema = z.object({
  text: z.string().min(1),
  sub: z.string().optional(),
})

const HierarchyDiagramSchema = z.object({
  type: z.literal('hierarchy'),
  label: z.string().optional(),
  items: z.array(DiagramItemSchema).min(2).max(10),
})

const FlowDiagramSchema = z.object({
  type: z.literal('flow'),
  label: z.string().optional(),
  steps: z.array(DiagramItemSchema).min(2).max(10),
})

const CycleDiagramSchema = z.object({
  type: z.literal('cycle'),
  label: z.string().optional(),
  trigger: z.string().optional(),
  states: z.array(DiagramItemSchema).min(2).max(8),
})

const ComparisonColumnSchema = z.object({
  heading: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
})

const ComparisonDiagramSchema = z.object({
  type: z.literal('comparison'),
  label: z.string().optional(),
  columns: z.array(ComparisonColumnSchema).min(2).max(5),
})

const TerminalLineSchema = z.object({
  type: z.enum(['command', 'prompt', 'response', 'info']),
  text: z.string().min(1),
})

const TerminalDiagramSchema = z.object({
  type: z.literal('terminal'),
  label: z.string().optional(),
  lines: z.array(TerminalLineSchema).min(1).max(12),
})

const ConfigLineSchema = z.object({
  text: z.string().min(1),
  highlight: z.boolean().optional(),
})

const ConfigDiagramSchema = z.object({
  type: z.literal('config'),
  label: z.string().optional(),
  filepath: z.string().min(1),
  lines: z.array(ConfigLineSchema).min(1).max(15),
})

const NetworkNodeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sub: z.string().optional(),
})

const NetworkEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  dashed: z.boolean().optional(),
})

const NetworkDiagramSchema = z.object({
  type: z.literal('network'),
  label: z.string().optional(),
  nodes: z.array(NetworkNodeSchema).min(2).max(12),
  edges: z.array(NetworkEdgeSchema).min(1).max(20),
})

const SequenceMessageSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  text: z.string().min(1),
  dashed: z.boolean().optional(),
})

const SequenceDiagramSchema = z.object({
  type: z.literal('sequence'),
  label: z.string().optional(),
  actors: z.array(z.string().min(1)).min(2).max(6),
  messages: z.array(SequenceMessageSchema).min(1).max(12),
})

const LayerDiagramSchema = z.object({
  type: z.literal('layer'),
  label: z.string().optional(),
  layers: z.array(DiagramItemSchema).min(2).max(8),
})

const SwimlaneLaneSchema = z.object({
  name: z.string().min(1),
  segments: z
    .array(
      z.object({
        start: z.number().min(0),
        end: z.number().min(0),
        text: z.string().optional(),
      })
    )
    .min(1)
    .max(6),
})

const SwimlaneDiagramSchema = z.object({
  type: z.literal('swimlane'),
  label: z.string().optional(),
  lanes: z.array(SwimlaneLaneSchema).min(2).max(8),
  totalSteps: z.number().min(1).optional(),
})

const VennSetSchema = z.object({
  text: z.string().min(1),
  items: z.array(z.string().min(1)).optional(),
})

const VennDiagramSchema = z.object({
  type: z.literal('venn'),
  label: z.string().optional(),
  sets: z.array(VennSetSchema).min(2).max(3),
  intersectionLabel: z.string().optional(),
})

const MatrixDiagramSchema = z.object({
  type: z.literal('matrix'),
  label: z.string().optional(),
  rowHeader: z.string().optional(),
  colHeader: z.string().optional(),
  rows: z.array(z.string().min(1)).min(2).max(10),
  cols: z.array(z.string().min(1)).min(2).max(8),
  cells: z.array(z.array(z.string())),
})

interface TreeNodeInput {
  text: string
  sub?: string | undefined
  children?: TreeNodeInput[] | undefined
}

const TreeNodeSchema: z.ZodType<TreeNodeInput> = z.lazy(() =>
  z.object({
    text: z.string().min(1),
    sub: z.string().optional(),
    children: z.array(TreeNodeSchema).optional(),
  })
)

const TreeDiagramSchema = z.object({
  type: z.literal('tree'),
  label: z.string().optional(),
  root: TreeNodeSchema,
})

const FormulaComponentSchema = z.object({
  text: z.string().min(1),
  sub: z.string().optional(),
  highlight: z.boolean().optional(),
})

const FormulaDiagramSchema = z.object({
  type: z.literal('formula'),
  label: z.string().optional(),
  result: z.string().min(1),
  components: z.array(FormulaComponentSchema).min(2).max(8),
  operator: z.string().optional(),
})

const KeyCapSchema = z.object({
  label: z.string().min(1),
  highlight: z.boolean().optional(),
})

const KeyComboSchema = z.object({
  keys: z.array(KeyCapSchema).min(1).max(4),
  caption: z.string().optional(),
})

const KeyboardDiagramSchema = z.object({
  type: z.literal('keyboard'),
  label: z.string().optional(),
  combos: z.array(KeyComboSchema).min(1).max(6),
  sequence: z.boolean().optional(),
  caption: z.string().optional(),
})

export const DiagramSchema = z.discriminatedUnion('type', [
  HierarchyDiagramSchema,
  FlowDiagramSchema,
  CycleDiagramSchema,
  ComparisonDiagramSchema,
  TerminalDiagramSchema,
  ConfigDiagramSchema,
  NetworkDiagramSchema,
  SequenceDiagramSchema,
  LayerDiagramSchema,
  SwimlaneDiagramSchema,
  VennDiagramSchema,
  MatrixDiagramSchema,
  TreeDiagramSchema,
  FormulaDiagramSchema,
  KeyboardDiagramSchema,
])

// DiagramData type is owned by the domain layer (single source of truth).
// Re-exported here for backward compat; new code should import from
// '@/domain/valueObjects/Diagram'. The compile-time assertion below
// guarantees the Zod schema's inferred shape stays in sync with the
// domain type — if they diverge, the export fails to compile.
import type { DiagramData as _DomainDiagramData } from '@/domain/valueObjects/Diagram'

// Bidirectional structural assertion — fails to compile if Zod schema
// and domain type drift apart. The function is never called; it exists
// purely as a type-level guard.
function _assertDiagramSchemaMatchesDomain(value: z.infer<typeof DiagramSchema>): _DomainDiagramData {
  return value
}
function _assertDomainMatchesDiagramSchema(value: _DomainDiagramData): z.infer<typeof DiagramSchema> {
  return value
}
// Reference both functions so unused-export rules don't fire
export const __diagramTypeAssertions = [_assertDiagramSchemaMatchesDomain, _assertDomainMatchesDiagramSchema] as const

export type { DiagramData } from '@/domain/valueObjects/Diagram'

// ============================================================
// Quiz Item Schema
// ============================================================

export const QuizItemSchema = z
  .object({
    id: z.string().min(1, 'Quiz ID is required'),
    question: z.string().min(1, 'Question is required'),
    options: z.array(QuizOptionSchema).min(2, 'At least 2 options are required').max(6, 'Maximum 6 options allowed'),
    correctIndex: z.number().int().min(0).optional(),
    explanation: z.string().min(1, 'Explanation is required'),
    referenceUrl: z
      .string()
      .url('Must be a valid URL')
      .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
        message: 'URL must start with http:// or https://',
      })
      .optional(),
    aiPrompt: z.string().optional(),
    hint: z.string().optional(),
    category: z.string().min(1, 'Category is required'),
    difficulty: DifficultySchema,
    tags: z.array(z.string()).optional(),
    type: QuestionTypeSchema,
    correctIndices: z.array(z.number().int().min(0)).optional(),
    diagram: DiagramSchema.optional(),
    diagrams: z.array(DiagramSchema).min(1).max(3),
  })
  .refine(
    (data) => {
      if (data.type === 'multi') {
        // multi: correctIndices must exist with at least 2 entries, all within bounds
        if (!data.correctIndices || data.correctIndices.length < 2) return false
        const unique = new Set(data.correctIndices)
        if (unique.size !== data.correctIndices.length) return false
        return data.correctIndices.every((i) => i < data.options.length)
      }
      // single: correctIndex is required and must be within bounds
      if (data.correctIndex == null) return false
      return data.correctIndex < data.options.length
    },
    {
      message: 'correctIndex/correctIndices must be within options array bounds',
    }
  )

/**
 * クイズファイルスキーマ（インポート/エクスポート用）
 *
 * 【対応フォーマット】
 * 1. オブジェクト形式: { title?, description?, quizzes: [...] }
 * 2. 配列形式: [...] （validateQuizFile で自動変換）
 *
 * title, description, version はすべてオプショナル。
 * 最低限 quizzes 配列があればインポート可能。
 */
export const QuizFileSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  quizzes: z.array(QuizItemSchema).min(1, 'At least one quiz is required'),
})

/**
 * クイズセットストレージスキーマ（内部保存用）
 *
 * QuizFileSchema に加えて、メタデータ（id, type, timestamps）を持つ。
 * localStorage への保存時に使用。
 */
export const QuizSetStorageSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  type: z.enum(['default', 'user']),
  quizzes: z.array(QuizItemSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// ============================================================
// User Progress Schemas
// ============================================================

/**
 * 問題進捗スキーマ
 */
export const QuestionProgressSchema = z.object({
  questionId: z.string(),
  attempts: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  lastAttemptAt: z.number(),
  lastCorrect: z.boolean(),
  nextReviewAt: z.number().optional(),
  correctStreak: z.number().int().min(0).optional(),
})

/**
 * カテゴリ進捗スキーマ
 */
export const CategoryProgressSchema = z.object({
  categoryId: z.string(),
  totalQuestions: z.number().int().min(0),
  attemptedQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
})

/**
 * ユーザー進捗スキーマ
 *
 * 進捗データのインポート/エクスポート時に使用。
 */
export const UserProgressSchema = z.object({
  modifiedAt: z.number(),
  questionProgress: z.record(z.string(), QuestionProgressSchema),
  categoryProgress: z.record(z.string(), CategoryProgressSchema),
  totalAttempts: z.number().int().min(0),
  totalCorrect: z.number().int().min(0),
  streakDays: z.number().int().min(0),
  lastSessionAt: z.number(),
  bookmarkedQuestionIds: z.array(z.string()).optional(),
  dailyGoal: z.number().int().min(1).optional(),
  dailyAnswerCounts: z.record(z.string(), z.number().int().min(0)).optional(),
  sessionHistory: z
    .array(
      z.object({
        id: z.string(),
        completedAt: z.number(),
        mode: z.string(),
        categoryFilter: z.string().nullable(),
        score: z.number().int().min(0),
        totalQuestions: z.number().int().min(0),
        percentage: z.number().min(0).max(100),
      })
    )
    .optional(),
})

// ============================================================
// Type Inference
// ============================================================

/**
 * スキーマから TypeScript 型を生成
 *
 * 【z.infer の利点】
 * スキーマと型が常に同期される。
 * スキーマを変更すれば型も自動的に変わる。
 */
export type QuizItemData = z.infer<typeof QuizItemSchema>
export type QuizFileData = z.infer<typeof QuizFileSchema>
export type QuizSetStorageData = z.infer<typeof QuizSetStorageSchema>
export type UserProgressData = z.infer<typeof UserProgressSchema>

// ============================================================
// Validation Functions
// ============================================================

/**
 * バリデーション結果の型
 *
 * 【設計】
 * success: true の場合は data が必ず存在
 * success: false の場合は errors が必ず存在
 */
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: string[]
}

/** Zod の safeParse 結果を ValidationResult に変換（共通ヘルパー） */
function toValidationResult<T>(
  result: { success: true; data: T } | { success: false; error: z.ZodError }
): ValidationResult<T> {
  if (result.success) return { success: true, data: result.data }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
  return { success: false, errors }
}

/** JSON 文字列をパースして Zod スキーマで検証（共通ヘルパー） */
function validateJsonString<T>(
  jsonString: string,
  schema: z.ZodType<T>,
  preprocess?: (parsed: unknown) => unknown
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(jsonString)
    return toValidationResult(schema.safeParse(preprocess ? preprocess(parsed) : parsed))
  } catch (error) {
    if (error instanceof SyntaxError) return { success: false, errors: ['Invalid JSON format'] }
    return { success: false, errors: ['Unknown validation error'] }
  }
}

/** クイズファイルを検証（オブジェクト/配列両対応） */
export function validateQuizFile(jsonString: string): ValidationResult<QuizFileData> {
  try {
    const parsed = JSON.parse(jsonString)
    const data = Array.isArray(parsed) ? { quizzes: parsed } : parsed
    return toValidationResult(QuizFileSchema.safeParse(data))
  } catch (error) {
    if (error instanceof SyntaxError) return { success: false, errors: ['Invalid JSON format'] }
    return { success: false, errors: ['Unknown validation error'] }
  }
}

/** ユーザー進捗データを検証 */
export function validateUserProgress(jsonString: string): ValidationResult<UserProgressData> {
  return validateJsonString(jsonString, UserProgressSchema)
}

/** クイズセットストレージデータを検証（パース済みオブジェクト） */
export function validateQuizSetStorage(data: unknown): ValidationResult<QuizSetStorageData> {
  return toValidationResult(QuizSetStorageSchema.safeParse(data))
}
