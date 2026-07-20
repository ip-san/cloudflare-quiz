/**
 * 実践シナリオデータ
 *
 * 実務に即したストーリー形式で既存の問題を出題する。
 * questionId は quizzes.json の ID を参照する。
 *
 * Cloudflare Codex Quiz では初回リリース時点でシナリオは未作成のため空配列。
 * MenuHeader は SCENARIOS.length > 0 でメニュー項目をガードしている。
 */

export interface ScenarioStep {
  readonly type: 'narrative' | 'question'
  readonly text?: string
  readonly questionId?: string
}

export interface ScenarioData {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced'
  readonly steps: readonly ScenarioStep[]
  readonly completionMessage: string
}

export const SCENARIOS: readonly ScenarioData[] = []
