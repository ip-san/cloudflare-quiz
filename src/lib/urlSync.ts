/**
 * URL ↔ AppState sync for the PWA web build.
 *
 * Schema:
 *   /                               → menu
 *   /?category=memory               → category mode with categoryFilter
 *   /?mode=<QuizModeId>             → any predefined mode (excluding 'category')
 *   /?mode=scenario                 → scenario select screen
 *   /?scenario=<scenario-id>        → specific scenario session
 *   /?q=<question-id>               → single-question custom session (shareable mid-quiz)
 *   /?ids=id1,id2                   → custom session from recommend (existing)
 *   /?view=progress                 → progress dashboard
 *   /?view=reader                   → explanation reader (all)
 *   /?view=reader&filter=bookmarked → explanation reader (bookmarked only)
 *   /?view=study                    → study-first view
 *   /?view=result                   → post-quiz result (falls back to menu if no session)
 *   /?view=tutorial                 → tutorial (re)display
 */

import { SCENARIOS } from '@/data/scenarios'
import type { QuizSessionConfig } from '@/domain/services/QuizSessionService'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { ALL_MODE_IDS, type QuizModeId } from '@/domain/valueObjects/QuizMode'
import type { ViewState } from '@/stores/utils'

export type ViewIntentTarget = 'progress' | 'reader' | 'study' | 'result' | 'tutorial'

/** Map a `?view=...` target to the store's ViewState identifier. */
export function viewTargetToViewState(target: ViewIntentTarget): ViewState {
  switch (target) {
    case 'study':
      return 'studyFirst'
    default:
      return target
  }
}

export type UrlIntent =
  | { kind: 'ids'; ids: string[] }
  | { kind: 'question'; questionId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'scenario'; scenarioId: string }
  | { kind: 'scenarioSelect' }
  | { kind: 'mode'; mode: QuizModeId }
  | { kind: 'view'; target: ViewIntentTarget; filter?: string }
  | null

const CATEGORY_IDS = new Set(PREDEFINED_CATEGORIES.map((c) => c.id))
const SCENARIO_IDS = new Set(SCENARIOS.map((s) => s.id))
const SHAREABLE_MODES = new Set<QuizModeId>(ALL_MODE_IDS.filter((m) => m !== 'category' && m !== 'custom'))
const VIEW_TARGETS = new Set<ViewIntentTarget>(['progress', 'reader', 'study', 'result', 'tutorial'])

export function parseUrlIntent(search: string): UrlIntent {
  const params = new URLSearchParams(search)

  const ids = params.get('ids')
  if (ids) {
    const list = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length > 0) return { kind: 'ids', ids: list }
  }

  const question = params.get('q')
  if (question && question.trim().length > 0) {
    return { kind: 'question', questionId: question.trim() }
  }

  const category = params.get('category')
  if (category && CATEGORY_IDS.has(category)) {
    return { kind: 'category', categoryId: category }
  }

  const scenario = params.get('scenario')
  if (scenario && SCENARIO_IDS.has(scenario)) {
    return { kind: 'scenario', scenarioId: scenario }
  }

  const view = params.get('view')
  if (view && VIEW_TARGETS.has(view as ViewIntentTarget)) {
    const target = view as ViewIntentTarget
    const filter = params.get('filter')
    if (target === 'reader' && filter) {
      return { kind: 'view', target, filter }
    }
    return { kind: 'view', target }
  }

  const mode = params.get('mode')
  if (mode === 'scenario') return { kind: 'scenarioSelect' }
  if (mode && SHAREABLE_MODES.has(mode as QuizModeId)) {
    return { kind: 'mode', mode: mode as QuizModeId }
  }

  return null
}

/**
 * Store actions needed to realise a URL intent. Keeping this typed interface
 * keeps `applyUrlIntent` decoupled from the Zustand store so it is unit-testable.
 */
export interface UrlIntentDispatchers {
  startSession: (config: Partial<QuizSessionConfig>) => void
  startSessionWithIds: (ids: string[], label?: string) => void
  startScenarioSession: (id: string) => void
  setViewState: (state: ViewState) => void
  openReaderWithFilter: (filter: string) => void
}

export interface ApplyIntentOptions {
  /** Called after dispatching an `?ids=` intent so the caller can clear the URL. */
  onIdsDispatched?: () => void
  /** Session labels to attach to sessions started from a URL intent. */
  labels: {
    recommend: string
    shared: string
  }
}

/**
 * Dispatch a parsed `UrlIntent` through the supplied store actions.
 * Returns true iff an action was actually dispatched (useful for tests / telemetry).
 */
export function applyUrlIntent(
  intent: UrlIntent,
  dispatchers: UrlIntentDispatchers,
  options: ApplyIntentOptions
): boolean {
  if (!intent) return false
  switch (intent.kind) {
    case 'ids':
      dispatchers.startSessionWithIds(intent.ids, options.labels.recommend)
      options.onIdsDispatched?.()
      return true
    case 'question':
      dispatchers.startSessionWithIds([intent.questionId], options.labels.shared)
      return true
    case 'category':
      dispatchers.startSession({ mode: 'category', categoryFilter: intent.categoryId })
      return true
    case 'mode':
      dispatchers.startSession({ mode: intent.mode })
      return true
    case 'scenario':
      dispatchers.startScenarioSession(intent.scenarioId)
      return true
    case 'scenarioSelect':
      dispatchers.setViewState('scenarioSelect')
      return true
    case 'view':
      if (intent.target === 'result') return false // fall back to menu (no session to show)
      if (intent.target === 'reader' && intent.filter) {
        dispatchers.openReaderWithFilter(intent.filter)
        return true
      }
      dispatchers.setViewState(viewTargetToViewState(intent.target))
      return true
  }
}

export interface AppUrlState {
  viewState: ViewState
  sessionMode: QuizModeId | null
  categoryFilter: string | null
  activeScenarioId: string | null
  currentQuestionId: string | null
  readerInitialFilter: string | null
}

/**
 * Compute the URL search string (including leading `?`, or '' for root)
 * that best represents the given app state.
 *
 * In quiz view we prefer `?q=<currentQuestionId>` so users can copy the address
 * bar to share whatever problem they are looking at, *except* for scenario mode
 * where the whole curated flow (`?scenario=<id>`) is the meaningful share unit.
 */
export function buildUrlSearch(state: AppUrlState): string {
  const { viewState, sessionMode, activeScenarioId, currentQuestionId, readerInitialFilter } = state

  if (viewState === 'menu') return ''

  if (viewState === 'scenarioSelect') return '?mode=scenario'

  if (viewState === 'quiz') {
    if (sessionMode === 'scenario' && activeScenarioId) {
      return `?scenario=${encodeURIComponent(activeScenarioId)}`
    }
    if (currentQuestionId) {
      return `?q=${encodeURIComponent(currentQuestionId)}`
    }
    return ''
  }

  if (viewState === 'reader') {
    return readerInitialFilter ? `?view=reader&filter=${encodeURIComponent(readerInitialFilter)}` : '?view=reader'
  }

  if (viewState === 'progress') return '?view=progress'
  if (viewState === 'studyFirst') return '?view=study'
  if (viewState === 'result') return '?view=result'
  if (viewState === 'tutorial') return '?view=tutorial'

  return ''
}
