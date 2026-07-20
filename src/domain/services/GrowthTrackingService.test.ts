import { afterEach, describe, expect, it, vi } from 'vitest'
import { GrowthTrackingService } from './GrowthTrackingService'

describe('GrowthTrackingService', () => {
  afterEach(() => {
    localStorage.clear()
  })

  describe('computeMaturity', () => {
    it('returns zero ratios for empty prompts', () => {
      const m = GrowthTrackingService.computeMaturity([])
      expect(m.totalPrompts).toBe(0)
      expect(m.inquiryRatio).toBe(0)
      expect(m.specificityRatio).toBe(0)
    })

    it('detects inquiry prompts', () => {
      const prompts = [
        'なぜこのエラーが起きるのか教えてください',
        'src/App.tsx を修正して',
        'この仕組みはどうなっていますか',
      ]
      const m = GrowthTrackingService.computeMaturity(prompts)
      expect(m.inquiryRatio).toBeGreaterThan(0.5) // 2/3
      expect(m.totalPrompts).toBe(3)
    })

    it('detects specific prompts with file references', () => {
      const prompts = ['src/components/Quiz/QuizCard.tsx の行45を修正', 'なんとかして', 'package.json にスクリプト追加']
      const m = GrowthTrackingService.computeMaturity(prompts)
      expect(m.specificityRatio).toBeGreaterThan(0.6) // 2/3
    })

    it('skips short prompts (<=10 chars)', () => {
      const prompts = ['OK', 'はい', 'なぜこのエラーが起きるのか詳しく教えてください']
      const m = GrowthTrackingService.computeMaturity(prompts)
      expect(m.totalPrompts).toBe(1) // only the long one
    })
  })

  describe('saveSnapshot + loadHistory', () => {
    it('saves and loads a snapshot', () => {
      GrowthTrackingService.saveSnapshot(
        [{ pattern: '同じ修正を繰り返し指示', savedMinutes: 9 }],
        ['CLAUDE.md を更新して', 'CLAUDE.md にルール追加して', 'CLAUDE.md のルールを変更して']
      )
      const history = GrowthTrackingService.loadHistory()
      expect(history).toHaveLength(1)
      expect(history[0].patterns).toContain('同じ修正を繰り返し指示')
    })

    it('replaces snapshot for same date', () => {
      GrowthTrackingService.saveSnapshot(
        [{ pattern: 'パターンA', savedMinutes: 5 }],
        ['長いプロンプトをここに書きます']
      )
      GrowthTrackingService.saveSnapshot(
        [{ pattern: 'パターンB', savedMinutes: 3 }],
        ['長いプロンプトをここに書きます']
      )
      const history = GrowthTrackingService.loadHistory()
      expect(history).toHaveLength(1)
      expect(history[0].patterns).toContain('パターンB')
      expect(history[0].patterns).not.toContain('パターンA')
    })

    it('keeps max 10 snapshots', () => {
      for (let i = 0; i < 15; i++) {
        // Mock different dates
        vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
          `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`
        )
        GrowthTrackingService.saveSnapshot(
          [{ pattern: `pattern-${i}`, savedMinutes: 1 }],
          ['テスト用の長いプロンプト文字列です']
        )
        vi.restoreAllMocks()
      }
      expect(GrowthTrackingService.loadHistory().length).toBeLessThanOrEqual(10)
    })
  })

  describe('compareWithPrevious', () => {
    it('returns null when no history', () => {
      const result = GrowthTrackingService.compareWithPrevious(
        [{ pattern: '同じ修正を繰り返し指示', savedMinutes: 9 }],
        ['テスト用の長いプロンプト文字列です']
      )
      expect(result).toBeNull()
    })

    it('detects improvement when pattern is resolved', () => {
      // Save previous with a problem pattern
      GrowthTrackingService.saveSnapshot(
        [{ pattern: '同じ修正を繰り返し指示', savedMinutes: 9 }],
        ['テスト用の長いプロンプト文字列です']
      )

      // Compare with current: no patterns
      const result = GrowthTrackingService.compareWithPrevious([], ['テスト用の長いプロンプト文字列です'])
      expect(result).not.toBeNull()
      expect(result!.improved.length).toBe(1)
      expect(result!.improved[0].pattern).toBe('同じ修正を繰り返し指示')
      expect(result!.newIssues.length).toBe(0)
    })

    it('detects new issue', () => {
      // Save previous with no patterns
      GrowthTrackingService.saveSnapshot([], ['テスト用の長いプロンプト文字列です'])

      // Compare with current: new pattern
      const result = GrowthTrackingService.compareWithPrevious(
        [{ pattern: 'セッションが長い', savedMinutes: 5 }],
        ['テスト用の長いプロンプト文字列です']
      )
      expect(result).not.toBeNull()
      expect(result!.newIssues.length).toBe(1)
      expect(result!.newIssues[0].pattern).toBe('セッションが長い')
    })

    it('returns analysisCount on first comparison', () => {
      GrowthTrackingService.saveSnapshot(
        [{ pattern: '同じ修正を繰り返し指示', savedMinutes: 9 }],
        ['テスト用の長いプロンプト文字列です']
      )
      const result = GrowthTrackingService.compareWithPrevious([], ['テスト用の長いプロンプト文字列です'])
      expect(result!.analysisCount).toBe(2)
    })

    it('increments analysisCount on second+ comparison', () => {
      // First snapshot
      GrowthTrackingService.saveSnapshot(
        [{ pattern: '問題パターンX', savedMinutes: 5 }],
        ['テスト用の長いプロンプト文字列です']
      )
      // Manually add a second snapshot to simulate history > 1
      const history = GrowthTrackingService.loadHistory()
      const second = { ...history[0], date: '2026-01-01', patterns: ['同じ修正を繰り返し指示'] }
      localStorage.setItem(
        `${localStorage.getItem('cloudflare-codex-quiz-pattern-history') ? '' : ''}cloudflare-codex-quiz-pattern-history`,
        JSON.stringify([second, history[0]])
      )
      const result = GrowthTrackingService.compareWithPrevious([], ['テスト用の長いプロンプト文字列です'])
      expect(result).not.toBeNull()
      expect(result!.analysisCount).toBe(3)
    })

    it('reports stable when nothing changed', () => {
      GrowthTrackingService.saveSnapshot([], ['テスト用の長いプロンプト文字列です'])
      const result = GrowthTrackingService.compareWithPrevious([], ['テスト用の長いプロンプト文字列です'])
      expect(result).not.toBeNull()
      expect(result!.maturityChange.direction).toBe('stable')
    })
  })
})
