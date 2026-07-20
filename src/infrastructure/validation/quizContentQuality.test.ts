/**
 * Quiz Content Quality Tests
 *
 * quizzes.json の構造的品質を自動検証する。
 * Zod スキーマ検証（QuizValidator）では検出できない
 * コンテンツレベルの問題を検出する。
 *
 * 検出対象:
 * - ID重複・命名規則
 * - correctIndex / correctIndices の整合性と偏り
 * - wrongFeedback の構造（正解に付いていないか、不正解に欠けていないか）
 * - カテゴリの妥当性（PREDEFINED_CATEGORIES と一致するか）
 * - 問題文・解説の空チェック・重複チェック
 * - 選択肢テキストの重複
 * - referenceUrl のドキュメントページ妥当性
 * - タグの妥当性
 * - 全体像モードのタグ品質
 */

import { describe, expect, it } from 'vitest'
import quizData from '../../data/quizzes.json'
import { SCENARIOS } from '../../data/scenarios'
import { PREDEFINED_CATEGORIES } from '../../domain/valueObjects/Category'
import type { QuizItemData } from '../validation/QuizValidator'

const quizzes = quizData.quizzes as QuizItemData[]
const singleQuizzes = quizzes.filter((q) => q.type !== 'multi')
const multiQuizzes = quizzes.filter((q) => q.type === 'multi')
const validCategoryIds = PREDEFINED_CATEGORIES.map((c) => c.id)

/** ID prefix → category の対応表（quiz-data.md の ID 規約: wk-/wr-/kv-/d1-/r2-/dq-/pg-/ai-/ar- + 3桁連番） */
const ID_PREFIX_TO_CATEGORY: Record<string, string> = {
  wk: 'workers',
  wr: 'wrangler',
  kv: 'kv-cache',
  d1: 'd1',
  r2: 'r2',
  dq: 'do-queues',
  pg: 'pages-deploy',
  ai: 'ai-vectorize',
  ar: 'architecture',
}

/** 有効なドキュメントページパス — トピック差し替え時は quizzes.json と一緒に更新すること */
const VALID_DOC_PAGES = [
  'ai-gateway/',
  'ai-gateway/configuration/fallbacks/',
  'd1/',
  'd1/best-practices/local-development/',
  'd1/best-practices/read-replication/',
  'd1/get-started/',
  'd1/reference/migrations/',
  'd1/reference/time-travel/',
  'd1/reference/transactions/',
  'd1/worker-api/d1-database/',
  'd1/worker-api/prepared-statements/',
  'durable-objects/',
  'durable-objects/api/alarms/',
  'durable-objects/api/namespace/',
  'durable-objects/api/storage-api/',
  'durable-objects/best-practices/websockets/',
  'durable-objects/what-are-durable-objects/',
  'kv/api/list-keys/',
  'kv/api/read-key-value-pairs/',
  'kv/api/write-key-value-pairs/',
  'kv/concepts/how-kv-works/',
  'kv/platform/limits/',
  'pages/',
  'pages/configuration/build-configuration/',
  'pages/configuration/custom-domains/',
  'pages/configuration/environment-variables/',
  'pages/configuration/git-integration/',
  'pages/configuration/headers/',
  'pages/configuration/preview-deployments/',
  'pages/configuration/redirects/',
  'pages/configuration/rollbacks/',
  'pages/functions/routing/',
  'queues/',
  'queues/configuration/batching-retries/',
  'queues/configuration/dead-letter-queues/',
  'queues/reference/how-queues-works/',
  'r2/',
  'r2/api/s3/presigned-urls/',
  'r2/api/s3/tokens/',
  'r2/api/workers/workers-api-reference/',
  'r2/buckets/',
  'r2/buckets/event-notifications/',
  'r2/buckets/public-buckets/',
  'r2/objects/multipart-objects/',
  'r2/pricing/',
  'vectorize/',
  'vectorize/best-practices/create-indexes/',
  'vectorize/best-practices/insert-vectors/',
  'vectorize/reference/client-api/',
  'vectorize/reference/metadata-filtering/',
  'vectorize/reference/what-is-a-vector-database/',
  'waf/rate-limiting-rules/',
  'workers-ai/',
  'workers-ai/configuration/bindings/',
  'workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/',
  'workers-ai/models/',
  'workers/',
  'workers/configuration/cron-triggers/',
  'workers/configuration/secrets/',
  'workers/configuration/smart-placement/',
  'workers/configuration/versions-and-deployments/rollbacks/',
  'workers/frameworks/framework-guides/nextjs/',
  'workers/get-started/guide/',
  'workers/observability/logs/',
  'workers/platform/limits/',
  'workers/platform/pricing/',
  'workers/platform/storage-options/',
  'workers/reference/how-workers-works/',
  'workers/reference/migrate-to-module-workers/',
  'workers/runtime-apis/bindings/',
  'workers/runtime-apis/bindings/service-bindings/',
  'workers/runtime-apis/cache/',
  'workers/runtime-apis/context/',
  'workers/runtime-apis/handlers/fetch/',
  'workers/runtime-apis/nodejs/',
  'workers/runtime-apis/request/',
  'workers/static-assets/',
  'workers/wrangler/commands/',
  'workers/wrangler/configuration/',
  'workers/wrangler/environments/',
]

/**
 * 有効なタグパターン
 *
 * カテゴリID自体をタグとして付与する運用（例: 'workers', 'kv-cache'）があるため、
 * PREDEFINED_CATEGORIES 由来のIDも許可する。
 */
const VALID_TAG_PATTERNS = [
  /^overview$/,
  /^overview-\d+$/,
  /^overview-ch-\d+$/,
  /^topic-[a-z]+(-[a-z]+)*$/,
  /^practical$/,
  /^trivia$/,
  new RegExp(`^(${validCategoryIds.join('|')})$`),
]

describe('Quiz Content Quality', () => {
  describe('ID の一意性と命名規則', () => {
    it('すべてのIDが一意であること', () => {
      const ids = quizzes.map((q) => q.id)
      const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
      expect(duplicates).toEqual([])
    })

    it('IDが命名規則に準拠していること（prefix-NNN 形式）', () => {
      // prefix は英数字（例: d1）を許容する — quiz-data.md の ID 規約参照
      const violations = quizzes.filter((q) => !/^[a-z0-9]+-\d{3}$/.test(q.id))
      const ids = violations.map((q) => q.id)
      expect(ids, `命名規則違反: ${ids.join(', ')}`).toEqual([])
    })

    it('IDプレフィックスがカテゴリと対応していること（gs- レガシーを除く）', () => {
      const violations: string[] = []
      quizzes.forEach((q) => {
        const prefix = q.id.replace(/-\d+$/, '')
        if (prefix === 'gs') return // レガシーIDは除外
        const expectedCategory = ID_PREFIX_TO_CATEGORY[prefix]
        if (expectedCategory && q.category !== expectedCategory) {
          violations.push(`${q.id}: prefix "${prefix}" → expected "${expectedCategory}", got "${q.category}"`)
        }
        if (!expectedCategory && !ID_PREFIX_TO_CATEGORY[prefix]) {
          violations.push(`${q.id}: unknown prefix "${prefix}"`)
        }
      })
      expect(violations, `ID-カテゴリ不一致: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('correctIndex / correctIndices の整合性', () => {
    it('単一選択問題に correctIndex が必ず存在すること', () => {
      const violations = singleQuizzes.filter((q) => q.correctIndex == null)
      const ids = violations.map((q) => q.id)
      expect(ids, `correctIndex がない single 問題: ${ids.join(', ')}`).toEqual([])
    })

    it('単一選択問題に correctIndices が存在しないこと', () => {
      const violations = singleQuizzes.filter((q) => 'correctIndices' in q && q.correctIndices != null)
      const ids = violations.map((q) => q.id)
      expect(ids, `single 問題に correctIndices がある: ${ids.join(', ')}`).toEqual([])
    })

    it('複数選択問題に correctIndex が存在しないこと（correctIndices のみ使用）', () => {
      const violations = multiQuizzes.filter((q) => 'correctIndex' in q)
      const ids = violations.map((q) => q.id)
      expect(ids, `multi 問題に correctIndex がある: ${ids.join(', ')}`).toEqual([])
    })

    it('複数選択問題に correctIndices が2個以上あること', () => {
      const violations = multiQuizzes.filter((q) => !q.correctIndices || q.correctIndices.length < 2)
      const ids = violations.map((q) => q.id)
      expect(ids, `correctIndices が2個未満: ${ids.join(', ')}`).toEqual([])
    })

    it('複数選択問題の correctIndices が全て options 範囲内であること', () => {
      const violations: string[] = []
      multiQuizzes.forEach((q) => {
        ;(q.correctIndices ?? []).forEach((idx) => {
          if (idx < 0 || idx >= q.options.length) {
            violations.push(`${q.id} correctIndices[${idx}]`)
          }
        })
      })
      expect(violations, `範囲外の correctIndices: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('correctIndex の分布（単一選択問題）', () => {
    it('特定のインデックスに35%以上集中していないこと', () => {
      const counts = new Map<number, number>()
      singleQuizzes.forEach((q) => {
        const ci = q.correctIndex ?? 0
        counts.set(ci, (counts.get(ci) ?? 0) + 1)
      })
      const total = singleQuizzes.length

      for (const [index, count] of counts) {
        const pct = count / total
        expect(
          pct,
          `correctIndex=${index} が ${(pct * 100).toFixed(1)}% (${count}/${total}) で偏りすぎ`
        ).toBeLessThanOrEqual(0.35)
      }
    })

    it('少なくとも3つ以上の異なるインデックスが使用されていること', () => {
      const usedIndices = new Set(singleQuizzes.map((q) => q.correctIndex ?? 0))
      expect(usedIndices.size).toBeGreaterThanOrEqual(3)
    })
  })

  describe('wrongFeedback の構造（単一選択問題）', () => {
    it('正解選択肢に wrongFeedback が付いていないこと', () => {
      const violations = singleQuizzes.filter((q) => {
        const correct = q.options[q.correctIndex ?? 0]
        return 'wrongFeedback' in correct && correct.wrongFeedback !== undefined
      })
      const ids = violations.map((q) => q.id)
      expect(ids, `正解に wrongFeedback がある: ${ids.join(', ')}`).toEqual([])
    })

    it('不正解選択肢に wrongFeedback が存在すること', () => {
      const violations: string[] = []
      singleQuizzes.forEach((q) => {
        q.options.forEach((opt, i) => {
          if (i !== q.correctIndex && !opt.wrongFeedback) {
            violations.push(`${q.id} option[${i}]`)
          }
        })
      })
      expect(violations, `wrongFeedback が欠けている: ${violations.slice(0, 10).join(', ')}`).toEqual([])
    })
  })

  describe('wrongFeedback の構造（複数選択問題）', () => {
    it('正解選択肢に wrongFeedback が付いていないこと', () => {
      const violations: string[] = []
      multiQuizzes.forEach((q) => {
        const correctSet = new Set(q.correctIndices ?? [])
        q.options.forEach((opt, i) => {
          if (correctSet.has(i) && 'wrongFeedback' in opt && opt.wrongFeedback !== undefined) {
            violations.push(`${q.id} option[${i}]`)
          }
        })
      })
      expect(violations, `正解に wrongFeedback がある: ${violations.join(', ')}`).toEqual([])
    })

    it('不正解選択肢に wrongFeedback が存在すること', () => {
      const violations: string[] = []
      multiQuizzes.forEach((q) => {
        const correctSet = new Set(q.correctIndices ?? [])
        q.options.forEach((opt, i) => {
          if (!correctSet.has(i) && !opt.wrongFeedback) {
            violations.push(`${q.id} option[${i}]`)
          }
        })
      })
      expect(violations, `wrongFeedback が欠けている: ${violations.slice(0, 10).join(', ')}`).toEqual([])
    })
  })

  describe('カテゴリの妥当性', () => {
    it('すべてのカテゴリが PREDEFINED_CATEGORIES に含まれること', () => {
      const invalidCategories = quizzes.filter((q) => !validCategoryIds.includes(q.category))
      const details = invalidCategories.map((q) => `${q.id}: "${q.category}"`)
      expect(details, `無効なカテゴリ: ${details.join(', ')}`).toEqual([])
    })

    it('すべてのカテゴリに少なくとも1問存在すること', () => {
      const categoriesUsed = new Set(quizzes.map((q) => q.category))
      const missing = validCategoryIds.filter((id) => !categoriesUsed.has(id))
      expect(missing, `問題がないカテゴリ: ${missing.join(', ')}`).toEqual([])
    })
  })

  describe('選択肢の品質', () => {
    it('同一問題内に重複する選択肢テキストがないこと', () => {
      const violations: string[] = []
      quizzes.forEach((q) => {
        const seen = new Set<string>()
        q.options.forEach((opt, i) => {
          if (seen.has(opt.text)) {
            violations.push(`${q.id} option[${i}]: "${opt.text}"`)
          }
          seen.add(opt.text)
        })
      })
      expect(violations, `重複選択肢: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('コンテンツの品質', () => {
    it('問題文が10文字以上であること', () => {
      const tooShort = quizzes.filter((q) => q.question.length < 10)
      const details = tooShort.map((q) => `${q.id}: "${q.question}" (${q.question.length}文字)`)
      expect(details, `問題文が短すぎる: ${details.join(', ')}`).toEqual([])
    })

    it('解説文が10文字以上であること', () => {
      const tooShort = quizzes.filter((q) => q.explanation.length < 10)
      const details = tooShort.map((q) => `${q.id}: "${q.explanation}" (${q.explanation.length}文字)`)
      expect(details, `解説文が短すぎる: ${details.join(', ')}`).toEqual([])
    })

    it('問題文と解説文が同一でないこと', () => {
      const violations = quizzes.filter((q) => q.question === q.explanation)
      const ids = violations.map((q) => q.id)
      expect(ids, `問題文と解説が同一: ${ids.join(', ')}`).toEqual([])
    })

    it('すべての問題に referenceUrl があること', () => {
      const missing = quizzes.filter((q) => !q.referenceUrl)
      const ids = missing.map((q) => q.id)
      expect(ids, `referenceUrl がない: ${ids.join(', ')}`).toEqual([])
    })

    it('referenceUrl が公式ドキュメントURLであること', () => {
      // トピック差し替え時は quizzes.json の referenceUrl ドメインに合わせて更新すること
      const validPrefixes = ['https://developers.cloudflare.com/']
      const invalid = quizzes.filter((q) => {
        const url = q.referenceUrl
        return url && !validPrefixes.some((p) => url.startsWith(p))
      })
      const details = invalid.map((q) => `${q.id}: "${q.referenceUrl}"`)
      expect(details, `無効なURL: ${details.join(', ')}`).toEqual([])
    })

    it('referenceUrl のパスが既知のドキュメントページであること', () => {
      const prefixes = ['https://developers.cloudflare.com/']
      const violations: string[] = []
      quizzes.forEach((q) => {
        const url = q.referenceUrl
        if (!url) return
        const matchedPrefix = prefixes.find((p) => url.startsWith(p))
        if (!matchedPrefix) return // URL形式のチェックは別テストで実施済み
        const pathWithFragment = url.slice(matchedPrefix.length)
        const page = pathWithFragment.split('#')[0]
        if (!VALID_DOC_PAGES.includes(page)) {
          violations.push(`${q.id}: unknown page "${page}"`)
        }
      })
      expect(violations, `不明なドキュメントページ: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('タグの妥当性', () => {
    it('すべてのタグが既知のパターンに一致すること', () => {
      const violations: string[] = []
      quizzes.forEach((q) => {
        ;(q.tags ?? []).forEach((tag: string) => {
          if (!VALID_TAG_PATTERNS.some((p) => p.test(tag))) {
            violations.push(`${q.id}: unknown tag "${tag}"`)
          }
        })
      })
      expect(violations, `不明なタグ: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('実用度タグの排他性', () => {
    it('practical と trivia は同時に付与されないこと', () => {
      const violations = quizzes
        .filter((q) => (q.tags ?? []).includes('practical') && (q.tags ?? []).includes('trivia'))
        .map((q) => q.id)
      expect(violations, `practical と trivia が同時に付与: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('全体像モードのタグ品質', () => {
    const overviewQuizzes = quizzes.filter((q) => q.tags && q.tags.includes('overview'))

    it('overview タグ付き問題が30問以上あること', () => {
      expect(overviewQuizzes.length).toBeGreaterThanOrEqual(30)
    })

    it('すべてのoverview問題にソート用タグがあること', () => {
      const missingOrder = overviewQuizzes.filter((q) => !(q.tags ?? []).some((t: string) => /^overview-\d+$/.test(t)))
      const ids = missingOrder.map((q) => q.id)
      expect(ids, `ソートタグがない: ${ids.join(', ')}`).toEqual([])
    })

    it('ソート用タグに重複がないこと', () => {
      const orderTags = overviewQuizzes.flatMap((q) => (q.tags ?? []).filter((t: string) => /^overview-\d+$/.test(t)))
      const duplicates = orderTags.filter((t: string, i: number) => orderTags.indexOf(t) !== i)
      expect(duplicates, `重複タグ: ${duplicates.join(', ')}`).toEqual([])
    })

    it('全カテゴリが含まれていること（architecture は中上級向けのため除外）', () => {
      const categories = new Set(overviewQuizzes.map((q) => q.category))
      const missing = validCategoryIds.filter((c) => c !== 'architecture' && !categories.has(c))
      expect(missing, `欠落カテゴリ: ${missing.join(', ')}`).toEqual([])
    })
  })

  describe('基本統計', () => {
    it('問題数が100問以上であること', () => {
      expect(quizzes.length).toBeGreaterThanOrEqual(100)
    })

    it('3つの難易度すべてが使用されていること', () => {
      const difficulties = new Set(quizzes.map((q) => q.difficulty))
      expect(difficulties).toContain('beginner')
      expect(difficulties).toContain('intermediate')
      expect(difficulties).toContain('advanced')
    })

    it('各難易度が全体の10%以上を占めること', () => {
      const total = quizzes.length
      const counts: Record<string, number> = {}
      quizzes.forEach((q) => {
        counts[q.difficulty] = (counts[q.difficulty] || 0) + 1
      })

      for (const [difficulty, count] of Object.entries(counts)) {
        const pct = count / total
        expect(pct, `${difficulty} が ${(pct * 100).toFixed(1)}% で少なすぎ`).toBeGreaterThanOrEqual(0.1)
      }
    })
  })

  describe('ダイアグラムの品質', () => {
    // Flatten: each quiz's diagrams array into (quiz, diagram) pairs
    const diagramEntries = quizzes.flatMap((q) => (q.diagrams ?? []).map((d) => ({ id: q.id, diagram: d })))

    it('diagramフィールドが有効なtypeを持つこと', () => {
      const validTypes = [
        'hierarchy',
        'flow',
        'cycle',
        'comparison',
        'terminal',
        'config',
        'network',
        'sequence',
        'layer',
        'swimlane',
        'venn',
        'matrix',
        'tree',
        'formula',
        'keyboard',
      ]
      const violations = diagramEntries.filter((e) => !validTypes.includes(e.diagram.type))
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('hierarchyダイアグラムが2個以上のアイテムを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'hierarchy')
        .filter((e) => (((e.diagram as Record<string, unknown>).items as unknown[])?.length ?? 0) < 2)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('flowダイアグラムが2個以上のステップを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'flow')
        .filter((e) => (((e.diagram as Record<string, unknown>).steps as unknown[])?.length ?? 0) < 2)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('keyboardダイアグラムが1個以上のcomboを持ち各comboがkeysを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'keyboard')
        .filter((e) => {
          const combos = (e.diagram as Record<string, unknown>).combos as Array<{ keys?: unknown[] }> | undefined
          if (!combos || combos.length < 1) return true
          return combos.some((c) => !c.keys || c.keys.length < 1)
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('cycleダイアグラムが2個以上の状態を持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'cycle')
        .filter((e) => (((e.diagram as Record<string, unknown>).states as unknown[])?.length ?? 0) < 2)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('comparisonダイアグラムが2個以上のカラムを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'comparison')
        .filter((e) => (((e.diagram as Record<string, unknown>).columns as unknown[])?.length ?? 0) < 2)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('terminalダイアグラムが1個以上のlinesを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'terminal')
        .filter((e) => (((e.diagram as Record<string, unknown>).lines as unknown[])?.length ?? 0) < 1)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    // 旧スキーマ `{prompt, command, note}` は TerminalDiagram が text を読めず
    // 空白行として描画される。常に `{type: command|prompt|response|info, text}` を要求する。
    // 注: config.lines[].text === "" は ConfigDiagram で視覚的なブランク行として正常に描画される。
    it('terminal/config の各 line が新スキーマに従っていること（terminal は type と非空 text、config は text フィールド）', () => {
      const validTerminalTypes = new Set(['command', 'prompt', 'response', 'info'])
      const violations: { id: string; path: string; reason: string }[] = []
      diagramEntries.forEach((e) => {
        const d = e.diagram as Record<string, unknown>
        if (d.type !== 'terminal' && d.type !== 'config') return
        const lines = (d.lines as Array<Record<string, unknown>>) ?? []
        lines.forEach((line, li) => {
          if (typeof line.text !== 'string') {
            violations.push({ id: e.id, path: `${d.type}.lines[${li}]`, reason: 'missing text field' })
            return
          }
          if (d.type === 'terminal' && line.text.length < 1) {
            violations.push({ id: e.id, path: `terminal.lines[${li}]`, reason: 'empty text' })
          }
          if (d.type === 'terminal' && !validTerminalTypes.has(line.type as string)) {
            violations.push({
              id: e.id,
              path: `terminal.lines[${li}]`,
              reason: `invalid type: ${JSON.stringify(line.type)}`,
            })
          }
        })
      })
      const summary = violations.map((v) => `${v.id} [${v.path}] ${v.reason}`).join('\n')
      expect(violations, `旧スキーマのターミナル行:\n${summary}`).toEqual([])
    })

    it('configダイアグラムがfilepathとlinesを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'config')
        .filter((e) => {
          const d = e.diagram as Record<string, unknown>
          return !d.filepath || ((d.lines as unknown[])?.length ?? 0) < 1
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('layerダイアグラムが2個以上のlayersを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'layer')
        .filter((e) => (((e.diagram as Record<string, unknown>).layers as unknown[])?.length ?? 0) < 2)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('networkダイアグラムがnodesとedgesを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'network')
        .filter((e) => {
          const d = e.diagram as Record<string, unknown>
          return ((d.nodes as unknown[])?.length ?? 0) < 1 || !Array.isArray(d.edges)
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('sequenceダイアグラムがactorsとmessagesを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'sequence')
        .filter((e) => {
          const d = e.diagram as Record<string, unknown>
          return ((d.actors as unknown[])?.length ?? 0) < 1 || ((d.messages as unknown[])?.length ?? 0) < 1
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('treeダイアグラムがrootを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'tree')
        .filter((e) => !(e.diagram as Record<string, unknown>).root)
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('formulaダイアグラムがcomponentsとresultを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'formula')
        .filter((e) => {
          const d = e.diagram as Record<string, unknown>
          return ((d.components as unknown[])?.length ?? 0) < 1 || !d.result
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('matrixダイアグラムがrows,cols,cellsを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'matrix')
        .filter((e) => {
          const d = e.diagram as Record<string, unknown>
          return (
            ((d.rows as unknown[])?.length ?? 0) < 1 ||
            ((d.cols as unknown[])?.length ?? 0) < 1 ||
            ((d.cells as unknown[])?.length ?? 0) < 1
          )
        })
      expect(violations.map((e) => e.id)).toEqual([])
    })

    it('swimlaneダイアグラムがlanesを持つこと', () => {
      const violations = diagramEntries
        .filter((e) => e.diagram.type === 'swimlane')
        .filter((e) => (((e.diagram as Record<string, unknown>).lanes as unknown[])?.length ?? 0) < 1)
      expect(violations.map((e) => e.id)).toEqual([])
    })
  })

  describe('ダイアグラムの完全性', () => {
    it('すべての問題に diagrams 配列が存在すること', () => {
      const violations = quizzes.filter((q) => {
        const d = (q as Record<string, unknown>).diagrams
        return !Array.isArray(d) || (d as unknown[]).length === 0
      })
      expect(violations.map((q) => q.id)).toEqual([])
    })

    it('すべての問題が1〜3個のダイアグラムを持つこと（QuizValidator.ts と同一制約）', () => {
      const violations = quizzes.filter((q) => {
        const d = (q as Record<string, unknown>).diagrams
        const len = Array.isArray(d) ? (d as unknown[]).length : 0
        return len < 1 || len > 3
      })
      expect(violations.map((q) => q.id)).toEqual([])
    })

    it('explanation の {{diagram:N}} 参照が diagrams 配列の範囲内であること', () => {
      const violations: string[] = []
      quizzes.forEach((q) => {
        const diagramsLen = ((q as Record<string, unknown>).diagrams as unknown[] | undefined)?.length ?? 0
        const refs = [...q.explanation.matchAll(/\{\{diagram:(\d+)\}\}/g)]
        refs.forEach((match) => {
          const idx = parseInt(match[1], 10)
          if (idx >= diagramsLen) {
            violations.push(`${q.id}: {{diagram:${idx}}} but diagrams.length=${diagramsLen}`)
          }
        })
      })
      expect(violations, `範囲外の diagram 参照: ${violations.join(', ')}`).toEqual([])
    })

    it('{{diagram:N}} に不正な形式がないこと', () => {
      const violations: string[] = []
      quizzes.forEach((q) => {
        const malformed = [...q.explanation.matchAll(/\{\{diagram:[^}]*\}\}/g)]
          .map((m) => m[0])
          .filter((marker) => !/^\{\{diagram:\d+\}\}$/.test(marker))
        if (malformed.length > 0) {
          violations.push(`${q.id}: ${malformed.join(', ')}`)
        }
      })
      expect(violations, `不正な diagram マーカー: ${violations.join(', ')}`).toEqual([])
    })

    // 検出ロジックの本体は scripts/quiz-utils.mjs の `check-ellipsis` コマンドと同等。
    it('ダイアグラム本文に途中切れの「…」「...」が含まれないこと', () => {
      const violations: { id: string; path: string; text: string }[] = []

      const ALLOWED_END_PUNCT = '\\s)\\]」｝>✓✗⏳→'
      const allowedJpEllipsisAtEnd = (text: string, fieldPath: string): boolean => {
        if (!/^(terminal|config)\./.test(fieldPath)) return false
        return new RegExp(`…[${ALLOWED_END_PUNCT}]{0,3}$`).test(text) && (text.match(/…/g) || []).length === 1
      }
      const allowedAsciiProgress = (text: string, fieldPath: string): boolean => {
        if (!/^(terminal|config)\./.test(fieldPath)) return false
        if (text.includes('…')) return false
        if (/[{[]\s*\.\.\.\s*[}\]]/.test(text)) return false
        if (/[,:]\s*\.\.\.\s*[,}\]]/.test(text)) return false
        if (/["'=]\s*\.\.\.\s*["']/.test(text)) return false
        if (/[=][^\s]*\.\.\./.test(text)) return false
        if (/\.\.\.\s*\|/.test(text)) return false
        if (/[/\\]\.{3}/.test(text)) return false
        return new RegExp(`\\.\\.\\.[${ALLOWED_END_PUNCT}]{0,3}$`).test(text)
      }

      const visit = (text: unknown, path: string, qid: string) => {
        if (typeof text !== 'string') return
        if (text.includes('…') && !allowedJpEllipsisAtEnd(text, path)) {
          violations.push({ id: qid, path, text })
          return
        }
        if (/\.\.\./.test(text)) {
          const stripped = text.replace(/\[[A-Za-z_][A-Za-z0-9_-]*\.\.\.\]/g, '')
          if (/\.\.\./.test(stripped) && !allowedAsciiProgress(text, path)) {
            violations.push({ id: qid, path, text })
          }
        }
      }

      const walk = (d: Record<string, unknown> | null, prefix: string, qid: string) => {
        if (!d || typeof d !== 'object') return
        const t = d.type as string | undefined
        const arr = (key: string) => (Array.isArray(d[key]) ? (d[key] as unknown[]) : [])
        switch (t) {
          case 'comparison':
            arr('columns').forEach((col, ci) => {
              const c = col as { items?: unknown[] }
              ;(c.items ?? []).forEach((item, ii) => {
                visit(item, `${prefix}comparison.columns[${ci}].items[${ii}]`, qid)
              })
            })
            break
          case 'terminal':
          case 'config':
            arr('lines').forEach((line, li) => {
              const l = line as { text?: unknown }
              visit(l.text, `${prefix}${t}.lines[${li}].text`, qid)
            })
            break
          case 'flow':
          case 'hierarchy':
          case 'layer':
          case 'cycle': {
            const itemsKey = t === 'flow' ? 'steps' : t === 'hierarchy' ? 'items' : t === 'layer' ? 'layers' : 'states'
            arr(itemsKey).forEach((item, ii) => {
              const i = item as { text?: unknown; sub?: unknown }
              visit(i.text, `${prefix}${t}.${itemsKey}[${ii}].text`, qid)
              visit(i.sub, `${prefix}${t}.${itemsKey}[${ii}].sub`, qid)
            })
            if (t === 'cycle') visit(d.trigger, `${prefix}cycle.trigger`, qid)
            break
          }
          case 'sequence':
            arr('actors').forEach((a, ai) => visit(a, `${prefix}sequence.actors[${ai}]`, qid))
            arr('messages').forEach((m, mi) => {
              const msg = m as { text?: unknown }
              visit(msg.text, `${prefix}sequence.messages[${mi}].text`, qid)
            })
            break
          case 'matrix':
            arr('rows').forEach((r, ri) => visit(r, `${prefix}matrix.rows[${ri}]`, qid))
            arr('cols').forEach((c, ci) => visit(c, `${prefix}matrix.cols[${ci}]`, qid))
            arr('cells').forEach((row, ri) => {
              ;(row as unknown[]).forEach((cell, ci) => visit(cell, `${prefix}matrix.cells[${ri}][${ci}]`, qid))
            })
            break
        }
        if (typeof d.label === 'string') visit(d.label, `${prefix}${t || 'diagram'}.label`, qid)
      }

      quizzes.forEach((q: { id: string; diagrams?: unknown[]; diagram?: unknown }) => {
        const diagrams: unknown[] = []
        if (Array.isArray(q.diagrams)) diagrams.push(...q.diagrams)
        if (q.diagram) diagrams.push(q.diagram)
        diagrams.forEach((d) => walk(d as Record<string, unknown>, '', q.id))
      })

      const summary = violations.map((v) => `${v.id} [${v.path}] ${v.text.slice(0, 80)}`).join('\n')
      expect(violations, `途中切れダイアグラムテキスト:\n${summary}`).toEqual([])
    })
  })

  // ── Scenario reference integrity ──────────────────────────
  describe('シナリオ参照整合性', () => {
    const quizIds = new Set(quizzes.map((q: { id: string }) => q.id))

    it('全シナリオの questionId が quizzes.json に存在すること', () => {
      const missing: string[] = []
      for (const scenario of SCENARIOS) {
        for (const step of scenario.steps) {
          if (step.type === 'question' && step.questionId && !quizIds.has(step.questionId)) {
            missing.push(`${scenario.id}: ${step.questionId}`)
          }
        }
      }
      expect(missing, `存在しない questionId: ${missing.join(', ')}`).toEqual([])
    })
  })
})
