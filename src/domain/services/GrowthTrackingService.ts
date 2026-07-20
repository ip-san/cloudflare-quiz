/**
 * GrowthTrackingService — 個人の成長を追跡するコーチングサービス
 *
 * detectWorkPatterns() の結果を履歴保存し、前回と比較して
 * 「改善」「悪化」「新規」を検出する。
 * ユーザーの使い方が段々改善しているかを可視化するための基盤。
 */

import { locale } from '@/config/locale'
import { theme } from '@/config/theme'

const STORAGE_KEY = `${theme.storagePrefix}-pattern-history`
const INSIGHT_CACHE_KEY = `${theme.storagePrefix}-growth-insight`
const MAX_SNAPSHOTS = 10

/** 保存する1回分のスナップショット */
export interface PatternSnapshot {
  /** ISO date string (YYYY-MM-DD) */
  readonly date: string
  /** 検出されたパターン名の配列 */
  readonly patterns: readonly string[]
  /** パターン名 → 具体的な回数/強度 */
  readonly patternCounts: Readonly<Record<string, number>>
  /** AI usage style（あれば） */
  readonly aiStyle?: string | undefined
  /** プロンプトの成熟度指標 */
  readonly maturity: {
    /** 平均プロンプト長 */
    readonly avgLength: number
    /** 探求系プロンプトの割合 (0-1) */
    readonly inquiryRatio: number
    /** 具体的な指示の割合（ファイル名・行番号含む）(0-1) */
    readonly specificityRatio: number
    /** 総プロンプト数 */
    readonly totalPrompts: number
  }
}

/** パターンの変化詳細 */
export interface PatternChange {
  readonly pattern: string
  readonly detail: string
  /** Haiku が生成した改善提案（利用可能な場合） */
  readonly tip?: string | undefined
  /** 前回の検出回数 */
  readonly prevCount: number
  /** 今回の検出回数 */
  readonly currentCount: number
  /** 改善率 (0-100)。完全解消=100 */
  readonly improvementPercent?: number | undefined
}

/** 前回と今回の比較結果 */
export interface GrowthInsight {
  /** 改善されたパターン（前回あったが今回なくなった or 回数が減った） */
  readonly improved: readonly PatternChange[]
  /** 新たに検出されたパターン */
  readonly newIssues: readonly PatternChange[]
  /** プロンプト成熟度の変化 */
  readonly maturityChange: {
    readonly direction: 'improving' | 'stable' | 'declining'
  }
  /** 比較回数（何回目の分析か） */
  readonly analysisCount: number
}

/** Prompt maturity detection patterns (reused across compute + assess) */
const INQUIRY_PATTERN = /なぜ|どう違|仕組み|理由|どういう|メリット|デメリット|比較|explain|why/i
const SPECIFICITY_PATTERN = /\.tsx?|\.jsx?|\.json|行\d|line \d|src\/|ファイル名/i
const MIN_PROMPT_LENGTH = 10

export class GrowthTrackingService {
  /**
   * プロンプト配列から成熟度指標を計算
   */
  static computeMaturity(prompts: string[]): PatternSnapshot['maturity'] {
    const meaningful = prompts.filter((p) => p.length > MIN_PROMPT_LENGTH)
    const total = meaningful.length || 1

    const avgLength = meaningful.reduce((sum, p) => sum + p.length, 0) / total

    const inquiryCount = meaningful.filter((p) => INQUIRY_PATTERN.test(p)).length
    const inquiryRatio = inquiryCount / total

    const specificCount = meaningful.filter((p) => SPECIFICITY_PATTERN.test(p)).length
    const specificityRatio = specificCount / total

    return {
      avgLength: Math.round(avgLength),
      inquiryRatio: round2(inquiryRatio),
      specificityRatio: round2(specificityRatio),
      totalPrompts: meaningful.length,
    }
  }

  /**
   * 現在のパターン結果をスナップショットとして保存
   */
  static saveSnapshot(
    patterns: { pattern: string; savedMinutes: number; aiStyle?: string }[],
    prompts: string[]
  ): void {
    const history = this.loadHistory()
    const today = new Date().toISOString().slice(0, 10)

    const patternCounts: Record<string, number> = {}
    let aiStyle: string | undefined
    for (const p of patterns) {
      patternCounts[p.pattern] = (patternCounts[p.pattern] ?? 0) + 1
      if (p.aiStyle) aiStyle = p.aiStyle
    }

    const snapshot: PatternSnapshot = {
      date: today,
      patterns: [...new Set(patterns.map((p) => p.pattern))],
      patternCounts,
      aiStyle,
      maturity: this.computeMaturity(prompts),
    }

    // Replace if same date exists, otherwise append
    const idx = history.findIndex((s) => s.date === today)
    if (idx >= 0) {
      history[idx] = snapshot
    } else {
      history.push(snapshot)
    }

    // Keep only recent snapshots
    const trimmed = history.slice(-MAX_SNAPSHOTS)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      /* ignore */
    }
  }

  /**
   * 前回のスナップショットと比較して成長インサイトを生成
   */
  static compareWithPrevious(
    currentPatterns: { pattern: string; tip?: string; category?: string; savedMinutes: number; aiStyle?: string }[],
    prompts: string[]
  ): GrowthInsight | null {
    const history = this.loadHistory()
    if (history.length === 0) return null

    const previous = history[history.length - 1]
    const currentMaturity = this.computeMaturity(prompts)

    // Build current pattern count map
    const currentCounts: Record<string, number> = {}
    for (const p of currentPatterns) {
      currentCounts[p.pattern] = (currentCounts[p.pattern] ?? 0) + 1
    }
    const prevCounts = previous.patternCounts ?? {}

    // Improved: was in previous but resolved or reduced
    const improved: PatternChange[] = []
    for (const p of previous.patterns) {
      const prev = prevCounts[p] ?? 1
      const curr = currentCounts[p] ?? 0
      if (curr < prev) {
        const pct = prev > 0 ? Math.round(((prev - curr) / prev) * 100) : 100
        const detail = curr === 0 ? locale.growth.resolved(p) : locale.growth.improved(p, pct, prev, curr)
        improved.push({ pattern: p, detail, prevCount: prev, currentCount: curr, improvementPercent: pct })
      }
    }

    // New issues: in current but not in previous — include Haiku tip if available
    const newIssues: PatternChange[] = []
    for (const p of Object.keys(currentCounts)) {
      if (!(p in prevCounts) || (prevCounts[p] ?? 0) === 0) {
        const matchingPattern = currentPatterns.find((cp) => cp.pattern === p)
        newIssues.push({
          pattern: p,
          detail: locale.growth.newIssue(p),
          tip: matchingPattern?.tip,
          prevCount: 0,
          currentCount: currentCounts[p],
        })
      }
    }

    // Maturity direction
    const maturityChange = this.assessMaturityChange(previous.maturity, currentMaturity)

    return {
      improved,
      newIssues,
      maturityChange,
      analysisCount: history.length + 1,
    }
  }

  /**
   * 直近の GrowthInsight を保存（キャッシュ復元用）
   */
  static saveInsight(insight: GrowthInsight): void {
    try {
      localStorage.setItem(INSIGHT_CACHE_KEY, JSON.stringify(insight))
    } catch {
      /* ignore */
    }
  }

  /**
   * 保存済みの GrowthInsight を復元する。
   * loadFromCache 時に使用（再計算・再保存を避ける）。
   */
  static loadCachedInsight(): GrowthInsight | null {
    try {
      const stored = localStorage.getItem(INSIGHT_CACHE_KEY)
      if (!stored) return null
      const parsed: unknown = JSON.parse(stored)
      if (!parsed || typeof parsed !== 'object' || !('improved' in parsed) || !('analysisCount' in parsed)) {
        return null
      }
      return parsed as GrowthInsight
    } catch {
      return null
    }
  }

  /**
   * 保存済み履歴を読み込み
   */
  static loadHistory(): PatternSnapshot[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      const parsed: unknown = JSON.parse(stored)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is PatternSnapshot => item && typeof item === 'object' && 'date' in item && 'patterns' in item
      )
    } catch {
      return []
    }
  }

  /**
   * 成熟度の変化を評価
   */
  private static assessMaturityChange(
    prev: PatternSnapshot['maturity'],
    current: PatternSnapshot['maturity']
  ): GrowthInsight['maturityChange'] {
    let score = 0

    // Inquiry ratio improvement
    if (current.inquiryRatio > prev.inquiryRatio + 0.05) score++
    else if (current.inquiryRatio < prev.inquiryRatio - 0.05) score--

    // Specificity improvement
    if (current.specificityRatio > prev.specificityRatio + 0.05) score++
    else if (current.specificityRatio < prev.specificityRatio - 0.05) score--

    // Prompt length: moderate is best (30-100 chars)
    const prevModerate = prev.avgLength >= 30 && prev.avgLength <= 100
    const currModerate = current.avgLength >= 30 && current.avgLength <= 100
    if (!prevModerate && currModerate) score++
    else if (prevModerate && !currModerate) score--

    if (score > 0) return { direction: 'improving' }
    if (score < 0) return { direction: 'declining' }
    return { direction: 'stable' }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
