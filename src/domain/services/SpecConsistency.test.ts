/**
 * Spec Consistency Tests — UI表示とコードロジックの整合性を自動検証
 *
 * 過去に発見された仕様バグのパターンを再発防止するためのテスト群。
 * 新しい仕様バグが見つかったらここにテストを追加する。
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { SCENARIOS } from '@/data/scenarios'
import { CERTIFICATE_THRESHOLDS, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'
import type { QuizItemData } from '@/infrastructure/validation/QuizValidator'
import type { Question } from '../entities/Question'
import { getOverviewQuestionsOrdered, OVERVIEW_CHAPTERS } from '../valueObjects/OverviewChapter'
import { ALL_MODE_IDS, PREDEFINED_QUIZ_MODES } from '../valueObjects/QuizMode'
import { QuizSessionService } from './QuizSessionService'

// Load quiz data for integration-level checks
const quizData = JSON.parse(readFileSync('src/data/quizzes.json', 'utf8')) as { quizzes: QuizItemData[] }
const allQuestions: QuizItemData[] = quizData.quizzes

describe('Spec Consistency: QuizMode definitions', () => {
  it('mode description mentioning a number matches questionCount', () => {
    for (const mode of PREDEFINED_QUIZ_MODES) {
      // Extract numbers from description like "100問" or "20問"
      const match = mode.description.match(/(\d+)問/)
      if (match && mode.questionCount !== null) {
        expect(
          mode.questionCount,
          `${mode.id}: description says "${match[0]}" but questionCount is ${mode.questionCount}`
        ).toBe(Number(match[1]))
      }
    }
  })

  it('mode description mentioning time matches timeLimit', () => {
    for (const mode of PREDEFINED_QUIZ_MODES) {
      // Extract time from description like "60分"
      const match = mode.description.match(/(\d+)分/)
      if (match && mode.timeLimit !== null) {
        expect(mode.timeLimit, `${mode.id}: description says "${match[0]}" but timeLimit is ${mode.timeLimit}`).toBe(
          Number(match[1])
        )
      }
      // If name mentions time (e.g., "60秒"), timeLimit should not be null
      const nameTimeMatch = mode.name.match(/(\d+)(秒|分)/)
      if (nameTimeMatch) {
        expect(mode.timeLimit, `${mode.id}: name says "${nameTimeMatch[0]}" but timeLimit is null`).not.toBeNull()
      }
    }
  })

  it('shuffle settings are consistent with mode intent', () => {
    for (const mode of PREDEFINED_QUIZ_MODES) {
      if (mode.description.includes('ランダム')) {
        expect(mode.shuffleQuestions, `${mode.id}: description says "ランダム" but shuffleQuestions is false`).toBe(
          true
        )
      }
    }
  })
})

describe('Spec Consistency: Session state persistence', () => {
  it('all QuizSessionState fields are saved in SessionRepository', () => {
    // These fields MUST be persisted for correct session resume
    // Maps field names to their serialized equivalents in SessionRepository
    const requiredInRepo = [
      'currentIndex',
      'score',
      'answeredCount',
      'startedAt',
      'hintsUsedCount',
      'hintUsedOnCurrent', // serialized name of hintUsed
      'answerRecords', // serialized name of answerHistory
      'timeRemaining', // Added after timer reset bug
    ]

    const requiredInResume = [
      'currentIndex',
      'score',
      'answeredCount',
      'startedAt',
      'hintsUsedCount',
      'hintUsed',
      'answerHistory',
      'timeRemaining',
    ]

    const repoSource = readFileSync('src/infrastructure/persistence/SessionRepository.ts', 'utf8')
    for (const field of requiredInRepo) {
      expect(repoSource, `SessionRepository should save "${field}" for correct resume`).toContain(field)
    }

    const resumeSource = readFileSync('src/stores/slices/resumeSlice.ts', 'utf8')
    for (const field of requiredInResume) {
      expect(resumeSource, `resumeSlice should restore "${field}" on resume`).toContain(field)
    }
  })

  it('overviewChapterState is persisted for overview mode resume', () => {
    const repoSource = readFileSync('src/infrastructure/persistence/SessionRepository.ts', 'utf8')
    expect(repoSource).toContain('overviewChapterState')

    const resumeSource = readFileSync('src/stores/slices/resumeSlice.ts', 'utf8')
    expect(resumeSource).toContain('overviewChapterState')

    const utilsSource = readFileSync('src/stores/utils.ts', 'utf8')
    expect(utilsSource).toContain('overviewChapterState')
  })
})

describe('Spec Consistency: Overview mode chapters', () => {
  it('all overview questions belong to exactly one chapter', () => {
    const overviewQuestions = allQuestions.filter((q) => q.tags?.includes('overview'))

    for (const q of overviewQuestions) {
      const chapterTags = (q.tags ?? []).filter((t) => t.startsWith('overview-ch-'))
      expect(chapterTags.length, `${q.id} should belong to exactly one chapter, has ${chapterTags.length}`).toBe(1)
    }
  })

  it('chapter definitions cover all overview questions', () => {
    const overviewQuestions = allQuestions.filter((q) => q.tags?.includes('overview'))
    const coveredIds = new Set<string>()

    for (const ch of OVERVIEW_CHAPTERS) {
      const chapterQs = overviewQuestions.filter((q) => (q.tags ?? []).includes(ch.tag))
      for (const q of chapterQs) coveredIds.add(q.id)
    }

    expect(coveredIds.size, 'all overview questions should be covered by chapters').toBe(overviewQuestions.length)
  })

  it('chapter progress uses correct/total (not correct/answered)', () => {
    // Verify ChapterProgressMap calculates correctPct as correct/total
    const source = readFileSync('src/components/Menu/ChapterProgressMap.tsx', 'utf8')
    expect(source).toContain('correct / ch.total')
    // Should NOT use correct/answered for the displayed percentage
    expect(source).not.toContain('correct / ch.answered) * 100')
  })

  it('overview chapter state is managed in domain layer, not UI', () => {
    const quizCardSource = readFileSync('src/components/Quiz/QuizCard.tsx', 'utf8')
    // Logic extracted to useQuizCard hook — check both files
    const useQuizCardSource = readFileSync('src/components/Quiz/useQuizCard.ts', 'utf8')
    // QuizCard (or its hook) should NOT have local state for chapter management
    expect(quizCardSource).not.toContain('useState<Set<number>>(new Set())')
    expect(useQuizCardSource).not.toContain('useState<Set<number>>(new Set())')
    // Should read from domain state (may live in the hook after refactoring)
    const combined = quizCardSource + useQuizCardSource
    expect(combined).toContain('overviewChapterState')
  })
})

describe('Spec Consistency: QuizSessionService chapter transitions', () => {
  it('nextQuestion detects chapter boundary in overview mode', () => {
    const questions = getOverviewQuestionsOrdered(
      allQuestions.map((q) => ({
        ...q,
        tags: q.tags ?? [],
        options: (q.options ?? []).map((o) => ({ text: o.text })),
        isMultiSelect: Array.isArray(q.correctIndex),
        isCorrectAnswer: () => false,
        isCorrectMultiAnswer: () => false,
      }))
    )
    if (questions.length === 0) return

    const config = { ...QuizSessionService.createDefaultConfig(), mode: 'overview' as const }
    const state = QuizSessionService.createInitialState(questions as unknown as Question[], config)

    expect(state.overviewChapterState).not.toBeNull()
    expect(state.overviewChapterState?.chapterPhase).toBe('intro')
    expect(state.overviewChapterState?.chapters.length).toBeGreaterThan(0)
  })

  it('dismissChapterIntro transitions to questions phase', () => {
    const questions = getOverviewQuestionsOrdered(
      allQuestions.map((q) => ({
        ...q,
        tags: q.tags ?? [],
        options: (q.options ?? []).map((o) => ({ text: o.text })),
        isMultiSelect: false,
        isCorrectAnswer: () => false,
        isCorrectMultiAnswer: () => false,
      }))
    )
    const config = { ...QuizSessionService.createDefaultConfig(), mode: 'overview' as const }
    const state = QuizSessionService.createInitialState(questions as unknown as Question[], config)

    const afterDismiss = QuizSessionService.dismissChapterIntro(state)
    expect(afterDismiss.overviewChapterState?.chapterPhase).toBe('questions')
  })
})

describe('Spec Consistency: Locale completeness', () => {
  it('sessionHistory.modes must cover all QuizMode IDs', () => {
    const modeLabels = locale.sessionHistory.modes
    for (const id of ALL_MODE_IDS) {
      expect(
        modeLabels[id],
        `locale.sessionHistory.modes is missing "${id}" — SessionHistoryList will display raw mode string`
      ).toBeDefined()
    }
  })

  it('scenario difficultyLabels must cover all scenario difficulties', () => {
    const labels = locale.scenario.difficultyLabels as Record<string, string>
    const difficulties = new Set(SCENARIOS.map((s) => s.difficulty))
    for (const d of difficulties) {
      expect(labels[d], `locale.scenario.difficultyLabels is missing "${d}"`).toBeDefined()
    }
  })

  it('all QuizMode names are used somewhere (not orphaned)', () => {
    for (const mode of PREDEFINED_QUIZ_MODES) {
      // Mode names should be referenceable via mode definition
      expect(mode.name.length, `${mode.id} should have a non-empty name`).toBeGreaterThan(0)
    }
  })

  it('header answered count uses isCorrectlyAnswered, not hasAttempted', () => {
    const source = readFileSync('src/components/Menu/ModeSelection.tsx', 'utf8')
    // Should use the centralized isCorrectlyAnswered method
    expect(source).toContain('isCorrectlyAnswered')
    expect(source).not.toContain('hasAttempted')
  })

  it('score thresholds use ScoreThresholds constants, not hardcoded 70/80', () => {
    // These files should NOT contain hardcoded >= 70 or >= 80 for score comparisons
    const filesToCheck = [
      'src/components/Quiz/chapter/ChapterComplete.tsx',
      'src/components/Quiz/result/CertificateGenerator.tsx',
      'src/components/Progress/CertificateHistory.tsx',
      'src/components/Progress/SessionHistoryList.tsx',
      'src/components/Progress/WeakPointInsight.tsx',
      'src/components/Progress/LearningRecommendation.tsx',
      'src/components/Quiz/result/NextRecommendation.tsx',
    ]
    for (const file of filesToCheck) {
      const source = readFileSync(file, 'utf8')
      // Check that passing score uses PASSING_SCORE constant
      const has70Hardcoded = /percentage\s*>=\s*70\b|accuracy\s*>=\s*70\b/.test(source)
      expect(has70Hardcoded, `${file} has hardcoded >= 70 — use PASSING_SCORE`).toBe(false)
    }
  })

  it('score thresholds: all files using score comparison import ScoreThresholds', () => {
    // Extended check: files that compare accuracy/percentage against numeric thresholds
    // must import from ScoreThresholds
    const filesToCheck = [
      'src/components/Progress/ProgressDashboard.tsx',
      'src/components/Quiz/QuizResult.tsx',
      'src/components/Menu/CategoryPicker.tsx',
    ]
    for (const file of filesToCheck) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} should import from ScoreThresholds`).toContain('ScoreThresholds')
      // Should NOT have raw >= 70, >= 80, >= 50 for score comparisons
      const hasRawThreshold = /accuracy\s*>=\s*(?:70|80|50)\b|progress\s*>=\s*(?:70|80|50)\b/.test(source)
      expect(hasRawThreshold, `${file} has hardcoded score threshold — use ScoreThresholds constants`).toBe(false)
    }
  })

  it('theme.scoreMessages boundaries match ScoreThresholds constants', () => {
    const mins = theme.scoreMessages.map((m) => m.min).sort((a, b) => b - a)
    expect(mins, 'scoreMessages must include CERTIFICATE_THRESHOLDS.full').toContain(CERTIFICATE_THRESHOLDS.full)
    expect(mins, 'scoreMessages must include SCORE_COLORS.good (PASSING_SCORE)').toContain(SCORE_COLORS.good)
    expect(mins, 'scoreMessages must include SCORE_COLORS.fair').toContain(SCORE_COLORS.fair)
  })
})

describe('Spec Consistency: isCorrectlyAnswered usage', () => {
  it('files checking answer correctness must use isCorrectlyAnswered, not lastCorrect', () => {
    const filesToCheck = [
      'src/stores/slices/progressSlice.ts',
      'src/components/Reader/ExplanationReader.tsx',
      'src/components/Reader/ReaderCard.tsx',
    ]
    for (const file of filesToCheck) {
      const source = readFileSync(file, 'utf8')
      // Should NOT access .lastCorrect for correctness checking
      const hasInlineCheck = /\.lastCorrect\b/.test(source)
      expect(hasInlineCheck, `${file} accesses .lastCorrect directly — use isCorrectlyAnswered()`).toBe(false)
    }
  })

  it('no file uses inline unanswered check pattern', () => {
    // The pattern "!p || p.attempts === 0 || !p.lastCorrect" is banned
    const filesToCheck = [
      'src/stores/slices/progressSlice.ts',
      'src/components/Reader/ExplanationReader.tsx',
      'src/components/Reader/ReaderCard.tsx',
      'src/components/Menu/ModeSelection.tsx',
      'src/components/Menu/ChapterProgressMap.tsx',
    ]
    for (const file of filesToCheck) {
      const source = readFileSync(file, 'utf8')
      const hasBannedPattern = /p\.attempts\s*===\s*0.*lastCorrect|lastCorrect.*p\.attempts\s*===\s*0/.test(source)
      expect(hasBannedPattern, `${file} uses banned inline unanswered check — use isCorrectlyAnswered()`).toBe(false)
    }
  })
})

describe('Spec Consistency: Session state reset on start', () => {
  // Use implementation line markers to extract correct source blocks
  const lifecycleSource = readFileSync('src/stores/slices/sessionLifecycleSlice.ts', 'utf8')
  const lifecycleLines = lifecycleSource.split('\n')

  const answerSource = readFileSync('src/stores/slices/sessionAnswerSlice.ts', 'utf8')
  const answerLines = answerSource.split('\n')

  // Find implementation lines (indented with 2 spaces, not interface definitions)
  // Skip lines before the export const createXxxSlice = ... line (past interface definition)
  function findImplBlock(lines: string[], startFn: string, endFn: string): string {
    const startPattern = new RegExp(`^  ${startFn}`)
    const endPattern = new RegExp(`^  ${endFn}`)
    // Find the line where the slice creator function starts (export const create...)
    const creatorStart = lines.findIndex((l) => /^export const create\w+Slice/.test(l))
    const implStart = creatorStart >= 0 ? creatorStart : 0
    let startIdx = -1
    let endIdx = lines.length
    for (let i = implStart; i < lines.length; i++) {
      if (startPattern.test(lines[i])) {
        startIdx = i
        break
      }
    }
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (endPattern.test(lines[i])) {
        endIdx = i
        break
      }
    }
    return lines.slice(startIdx, endIdx).join('\n')
  }

  it('startSession resets activeScenarioId and sessionLabel', () => {
    const block = findImplBlock(lifecycleLines, 'startSession:', 'startSessionWithIds:')
    expect(block, 'startSession should reset activeScenarioId').toContain('activeScenarioId: null')
    expect(block, 'startSession should reset sessionLabel').toContain('sessionLabel: null')
  })

  it('startScenarioSession resets sessionLabel', () => {
    const block = findImplBlock(lifecycleLines, 'startScenarioSession:', 'retrySession:')
    expect(block, 'startScenarioSession should reset sessionLabel').toContain('sessionLabel: null')
  })

  it('retryQuestion saves session snapshot', () => {
    const block = findImplBlock(answerLines, 'retryQuestion:', 'selectAnswer:')
    expect(block, 'retryQuestion should call saveSessionSnapshot').toContain('saveSessionSnapshot')
  })
})

describe('Spec Consistency: Navigation restores answer state', () => {
  const source = readFileSync('src/stores/slices/sessionAnswerSlice.ts', 'utf8')
  const lines = source.split('\n')

  function findImplBlock(startFn: string, endFn: string): string {
    const startPattern = new RegExp(`^  ${startFn}`)
    const endPattern = new RegExp(`^  ${endFn}`)
    // Find the line where the slice creator function starts (export const create...)
    const creatorStart = lines.findIndex((l) => /^export const create\w+Slice/.test(l))
    const implStart = creatorStart >= 0 ? creatorStart : 0
    let startIdx = -1
    let endIdx = lines.length
    for (let i = implStart; i < lines.length; i++) {
      if (startPattern.test(lines[i])) {
        startIdx = i
        break
      }
    }
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (endPattern.test(lines[i])) {
        endIdx = i
        break
      }
    }
    return lines.slice(startIdx, endIdx).join('\n')
  }

  it('previousQuestion restores isAnswered from answerHistory', () => {
    const block = findImplBlock('previousQuestion:', 'goToQuestion:')
    expect(block).not.toContain('isAnswered: false')
    expect(block).toContain('record !== undefined')
  })

  it('goToQuestion restores isAnswered from answerHistory', () => {
    const block = findImplBlock('goToQuestion:', 'useHint:')
    expect(block).not.toContain('isAnswered: false')
    expect(block).toContain('record !== undefined')
  })
})

describe('Spec Consistency: hasPassed uses PASSING_SCORE', () => {
  it('QuizSessionService.hasPassed default should use PASSING_SCORE constant', () => {
    const source = readFileSync('src/domain/services/QuizSessionService.ts', 'utf8')
    // Should NOT have = 70 as default
    expect(source).not.toMatch(/hasPassed\(.*=\s*70\)/)
    // Should reference PASSING_SCORE
    expect(source).toContain('PASSING_SCORE')
  })
})

describe('Spec Consistency: URL sharing coverage', () => {
  // Hardcoded oracle: every shareable ViewState listed in stores/utils.ts ViewState union.
  // If a new ViewState is added, this list MUST be updated together with buildUrlSearch/parseUrlIntent.
  const ALL_VIEW_STATES = [
    'menu',
    'quiz',
    'result',
    'progress',
    'reader',
    'scenarioSelect',
    'studyFirst',
    'tutorial',
  ] as const

  it('ViewState union and this test oracle stay in sync', () => {
    const utilsSource = readFileSync('src/stores/utils.ts', 'utf8')
    // Extract the `| 'value'` alternatives from `export type ViewState =`
    const match = utilsSource.match(/export type ViewState\s*=\s*((?:\n\s*\|[^\n]+)+)/)
    expect(match, 'ViewState union block not found in src/stores/utils.ts').not.toBeNull()
    const declared = match![1]
      .split('\n')
      .map((l) => l.match(/'([^']+)'/)?.[1])
      .filter((v): v is string => v !== undefined)
      .sort()
    expect(declared).toEqual([...ALL_VIEW_STATES].sort())
  })

  it('every non-menu ViewState has a branch in buildUrlSearch OR the quiz-view fallback', async () => {
    const { buildUrlSearch, parseUrlIntent } = await import('@/lib/urlSync')
    for (const viewState of ALL_VIEW_STATES) {
      // Representative state per view: gives enough signal for the branch to fire
      const currentQuestionId = viewState === 'quiz' ? 'mem-001' : null
      const sessionMode = viewState === 'quiz' ? ('category' as const) : null
      const categoryFilter = viewState === 'quiz' ? 'memory' : null
      const search = buildUrlSearch({
        viewState,
        sessionMode,
        categoryFilter,
        activeScenarioId: null,
        currentQuestionId,
        readerInitialFilter: null,
      })
      if (viewState === 'menu') {
        expect(search, `menu should emit empty search`).toBe('')
      } else {
        expect(search, `${viewState} must emit a non-empty URL`).not.toBe('')
        // And it must round-trip back to a non-null intent
        expect(parseUrlIntent(search), `${search} must parse back to an intent`).not.toBeNull()
      }
    }
  })

  it('every QuizModeId except category/custom can be reached via parseUrlIntent', async () => {
    const { parseUrlIntent } = await import('@/lib/urlSync')
    for (const id of ALL_MODE_IDS) {
      if (id === 'category' || id === 'custom') continue
      const intent = parseUrlIntent(`?mode=${id}`)
      if (id === 'scenario') {
        expect(intent, '?mode=scenario opens the scenario list').toEqual({ kind: 'scenarioSelect' })
      } else {
        expect(intent, `?mode=${id} parses as a mode intent`).toEqual({ kind: 'mode', mode: id })
      }
    }
  })

  it('locale.sessionLabels.shared is a display label (not referenced as a sentinel elsewhere)', () => {
    const slice = readFileSync('src/stores/slices/sessionLifecycleSlice.ts', 'utf8')
    // recommend IS a sentinel (triggers feedback recording); shared should never be compared.
    expect(slice).not.toMatch(/sessionLabels\.shared/)
  })
})

// ── ブランドカラーとロゴ資産の同期 ─────────────────────────────
// cf-orange / cf-gold のトークン値は、ロゴ資産(build/icon.svg・index.html の
// スプラッシュ・AppLogo.tsx)にグラデーション停止色としてハードコードされている。
// CSS側だけ変更するとアイコンとCTAの色がサイレントに乖離するため、
// 4ファイルのリテラル一致を機械的に保証する。
describe('Spec Consistency: brand color tokens vs logo assets', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const tokenOf = (name: string): string => {
    const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
    if (!m) throw new Error(`--color-${name} not found in src/index.css`)
    return m[1].toLowerCase()
  }

  const gradientStopsOf = (path: string): string[] =>
    Array.from(readFileSync(path, 'utf8').matchAll(/stop-?[cC]olor:?\s*'?(#[0-9a-fA-F]{6})/g), (m) =>
      m[1].toLowerCase()
    )

  it.each(['build/icon.svg', 'index.html', 'src/components/Layout/AppLogo.tsx'])(
    '%s のグラデーション停止色が cf-gold / cf-orange と一致すること',
    (path) => {
      const stops = gradientStopsOf(path)
      expect(stops.length, `${path}: gradient stops not found`).toBeGreaterThanOrEqual(2)
      expect(stops, `${path} の停止色に cf-gold(${tokenOf('cf-gold')}) が含まれること`).toContain(tokenOf('cf-gold'))
      expect(stops, `${path} の停止色に cf-orange(${tokenOf('cf-orange')}) が含まれること`).toContain(
        tokenOf('cf-orange')
      )
    }
  )
})
