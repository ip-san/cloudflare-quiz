/**
 * アナリティクス抽象レイヤー
 *
 * GTM (Google Tag Manager) 経由で GA4 にイベントを送信する。
 * - GTM ID が未設定の場合は全操作が no-op になる
 * - dataLayer への push で GTM にイベントを渡す
 */

// Vite の環境変数から GTM ID を取得
const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined

/** アナリティクスが有効かどうか */
export const isAnalyticsEnabled = !!GTM_ID

/** プラットフォーム識別子（全イベントに自動付与） */
const PLATFORM = 'pwa'

// GTM の dataLayer 型定義
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

/**
 * GTM スクリプトを動的に挿入する
 * index.html に直接書くとCSPの管理が煩雑になるため、
 * ランタイムで挿入し、環境変数で制御可能にする
 */
export function initGTM(): void {
  if (!isAnalyticsEnabled || !GTM_ID) return

  // dataLayer 初期化
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({
    'gtm.start': Date.now(),
    event: 'gtm.js',
  })

  // GTM スクリプト挿入
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
  document.head.appendChild(script)
}

/**
 * dataLayer にイベントを送信する
 */
function pushEvent(event: string, params?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled) return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ event, platform: PLATFORM, ...params })
}

// ============================================================
// Real User Detection (bot filtering)
// ============================================================

/**
 * ボットと実ユーザーを分離するための検出ロジック。
 * 条件: 5秒以上滞在 AND (スクロール OR クリック) → real_user イベントを1回だけ発火。
 * GA4 側でこのイベントの有無でセグメント分離が可能。
 */
export function initRealUserDetection(): void {
  if (!isAnalyticsEnabled) return

  let interacted = false
  let fired = false

  const onInteraction = () => {
    interacted = true
  }

  window.addEventListener('scroll', onInteraction, { once: true, passive: true })
  window.addEventListener('click', onInteraction, { once: true })
  window.addEventListener('touchstart', onInteraction, { once: true, passive: true })

  setTimeout(() => {
    if (interacted && !fired) {
      fired = true
      pushEvent('real_user', { detection: 'interaction_5s' })
    }
    // If no interaction by 5s, keep listening — covers slower users who interact after the timer
    if (!fired) {
      const checkLater = () => {
        if (interacted && !fired) {
          fired = true
          pushEvent('real_user', { detection: 'interaction_delayed' })
        }
      }
      window.addEventListener('scroll', checkLater, { once: true, passive: true })
      window.addEventListener('click', checkLater, { once: true })
      window.addEventListener('touchstart', checkLater, { once: true, passive: true })
    }
  }, 5000)
}

// ============================================================
// ユーザープロパティ
// ============================================================

/**
 * GA4 ユーザープロパティを設定する。
 * セッション開始時やレベル変動時に呼び出し、ユーザーセグメント分析を可能にする。
 */
export function setUserProperties(props: {
  mastery_level?: string
  total_quizzes?: number
  preferred_mode?: string
}): void {
  if (!isAnalyticsEnabled) return
  window.dataLayer = window.dataLayer ?? []
  // platform はイベントパラメータとしても必須（gtm/events.json）。user_properties 内だけだと
  // GTM の dataLayer 変数が未初期化の初回訪問で platform が空になり、ボット除外フィルタから漏れる
  window.dataLayer.push({
    event: 'set_user_properties',
    platform: PLATFORM,
    user_properties: { platform: PLATFORM, ...props },
  })
}

// ============================================================
// イベント定義
// ============================================================

/** チュートリアル完了/スキップ */
export function trackTutorial(action: 'complete' | 'skip', slideIndex?: number): void {
  pushEvent('tutorial_progress', {
    action,
    slide_index: slideIndex,
  })
}

/** クイズモード開始 */
export function trackQuizStart(mode: string, questionCount: number, category?: string): void {
  pushEvent('quiz_start', {
    quiz_mode: mode,
    question_count: questionCount,
    category,
  })
}

/** クイズモード完了 */
export function trackQuizComplete(
  mode: string,
  score: number,
  total: number,
  accuracy: number,
  durationSec: number
): void {
  pushEvent('quiz_complete', {
    quiz_mode: mode,
    score,
    total,
    accuracy,
    duration_sec: durationSec,
  })
}

/** チャプター進捗（全体像モード） */
export function trackChapterProgress(chapterId: number, action: 'start' | 'complete', accuracy?: number): void {
  pushEvent('chapter_progress', {
    chapter_id: chapterId,
    action,
    accuracy,
  })
}

/** 「読んでから解く」モード利用 */
export function trackStudyFirst(chapterId: number, action: 'start_reading' | 'finish_reading' | 'start_quiz'): void {
  pushEvent('study_first', {
    chapter_id: chapterId,
    action,
  })
}

/** ブックマーク操作 */
export function trackBookmark(action: 'add' | 'remove'): void {
  pushEvent('bookmark', { action })
}

/** 検索利用 */
export function trackSearch(resultCount: number): void {
  pushEvent('quiz_search', { result_count: resultCount })
}

/** 解説リーダー利用 */
export function trackReaderOpen(): void {
  pushEvent('reader_open')
}

/** シェア */
export function trackShare(method: string): void {
  pushEvent('share_result', { method })
}

/** 修了証ダウンロード */
export function trackCertificate(mode: string): void {
  pushEvent('certificate_download', { quiz_mode: mode })
}

/** 個別問題の回答 */
export function trackAnswer(
  questionId: string,
  category: string,
  difficulty: string,
  isCorrect: boolean,
  quizType: 'practical' | 'trivia' | 'neutral' = 'neutral'
): void {
  pushEvent('quiz_answer', {
    question_id: questionId,
    category,
    difficulty,
    is_correct: isCorrect,
    quiz_type: quizType,
  })
}

/** クイズ途中離脱 */
export function trackQuizQuit(mode: string, answeredCount: number, totalQuestions: number): void {
  pushEvent('quiz_quit', {
    quiz_mode: mode,
    answered_count: answeredCount,
    total_questions: totalQuestions,
  })
}

/** テーマ切替 */
export function trackThemeChange(newTheme: string): void {
  pushEvent('theme_change', { theme: newTheme })
}

/** セッション復帰 */
export function trackSessionResume(mode: string, questionsRemaining: number): void {
  pushEvent('session_resume', {
    quiz_mode: mode,
    questions_remaining: questionsRemaining,
  })
}

/** 利用履歴レコメンド（Electron限定） */
export function trackRecommend(
  action: 'analyze' | 'view_list' | 'start_quiz',
  topCategories: string[],
  questionCount: number,
  hasReasons?: boolean
): void {
  pushEvent('usage_recommend', {
    recommend_action: action,
    top_categories: topCategories.join(','),
    question_count: questionCount,
    ...(hasReasons !== undefined && { has_reasons: hasReasons }),
  })
}

/** レコメンド結果フィードバック（レコメンドセッション完了時） */
export function trackRecommendFeedback(total: number, correct: number, accuracy: number): void {
  pushEvent('recommend_feedback', {
    total,
    correct,
    accuracy,
  })
}

/** XP レベルアップ（大きなXP獲得時） */
export function trackLevelUp(xpGained: number, totalXp: number): void {
  pushEvent('level_up', { xp_gained: xpGained, total_xp: totalXp })
}

/** ストリークマイルストーン達成（3/7/14/30/60/100日） */
export function trackStreakMilestone(streakDays: number, milestone: string): void {
  pushEvent('streak_milestone', { streak_days: streakDays, milestone })
}

/** デイリーゴール達成 */
export function trackDailyGoal(todayCount: number, dailyGoal: number): void {
  pushEvent('daily_goal_achieved', { today_count: todayCount, daily_goal: dailyGoal })
}

/** シナリオモード完了 */
export function trackScenarioComplete(scenarioId: string, score: number, total: number, accuracy: number): void {
  pushEvent('scenario_complete', { scenario_id: scenarioId, score, total, accuracy })
}

/** カテゴリ自己ベスト更新 */
export function trackCategoryBest(category: string, previousAccuracy: number, newAccuracy: number): void {
  pushEvent('category_best', { category, previous_accuracy: previousAccuracy, new_accuracy: newAccuracy })
}

/**
 * エラーレートリミッター（同一エラーをウィンドウ内で最大 maxCount 回に制限）
 *
 * - 各キーが maxCount に達するとそれ以降はブロック
 * - キーごとの初回ブロック時のみ onFirstDrop コールバックを発火（可視化用）
 * - Map サイズが maxKeys に達したら期限切れエントリを GC（メモリリーク対策）
 */
export class ErrorRateLimiter {
  private counts = new Map<string, { count: number; dropped: number; resetAt: number }>()
  constructor(
    private maxCount: number = 5,
    private windowMs: number = 60_000,
    private maxKeys: number = 200,
    private onFirstDrop?: (key: string) => void
  ) {}

  /** 送信可能なら true、レート超過なら false */
  allow(key: string, now: number = Date.now()): boolean {
    const entry = this.counts.get(key)
    if (entry && now < entry.resetAt) {
      if (entry.count >= this.maxCount) {
        entry.dropped++
        if (entry.dropped === 1) this.onFirstDrop?.(key)
        return false
      }
      entry.count++
      return true
    }
    // New entry or expired — GC if we're growing unbounded
    if (this.counts.size >= this.maxKeys) this.gc(now)
    this.counts.set(key, { count: 1, dropped: 0, resetAt: now + this.windowMs })
    return true
  }

  private gc(now: number): void {
    for (const [key, entry] of this.counts) {
      if (now >= entry.resetAt) this.counts.delete(key)
    }
  }
}

const errorLimiter = new ErrorRateLimiter(5, 60_000, 200, (key) => {
  // Emit a one-shot signal so we know rate limiting kicked in (per key, per window)
  pushEvent('app_error_rate_limited', { error_key: key.substring(0, 200) })
})

/**
 * 非アクションなノイズエラーの denylist（Layer 0 フィルタ）。
 *
 * これらはユーザー影響がなく、レートリミッタ閾値の下で恒常的に流れるため
 * DEV ガード + rate limit では完全には抑えられない。GA4 汚染を防ぐため
 * 送信前に弾く。
 */
export const NOISY_ERROR_PATTERNS: readonly RegExp[] = [
  // Vite HMR / ブラウザ内 WebSocket 切断（Electron パッケージ版でも稀に流入）
  /send was called before connect/i,
  // SharedWorker は本アプリで使用しない（CSP/blob によるブラウザ側のブロック）
  /Failed to construct 'SharedWorker'/i,
]

export function isNoisyError(message: string): boolean {
  return NOISY_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/** アプリエラー（開発環境では送信しない、既知ノイズは弾く、同一エラーは1分間に最大5回まで） */
export function trackError(message: string, source: string, action: 'caught' | 'uncaught' = 'uncaught'): void {
  if (import.meta.env.DEV) return
  if (isNoisyError(message)) return
  const key = `${source}:${message.substring(0, 100)}`
  if (!errorLimiter.allow(key)) return

  pushEvent('app_error', {
    action,
    error_message: message.substring(0, 200),
    error_source: source,
  })
}

/**
 * try/catch 内のエラーを console と GA4 の両方にレポートするヘルパー。
 *
 * - error は unknown 型を Error.message or String() に正規化
 * - 任意の contextLabel を console.error に前置（人間向け文脈）
 * - trackError には action='caught' を渡す（明示的にハンドル済み）
 *
 * @example
 * try { ... } catch (e) { reportError(e, 'progress_save', 'Failed to save progress') }
 */
export function reportError(error: unknown, source: string, contextLabel?: string): void {
  const message = error instanceof Error ? error.message : String(error)
  if (contextLabel) console.error(`${contextLabel}:`, error)
  else console.error(error)
  trackError(message, source, 'caught')
}
