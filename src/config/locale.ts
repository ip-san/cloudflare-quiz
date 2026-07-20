/**
 * ロケール設定 — UI テキストのインターフェース定義
 *
 * 言語別の実装は locales/ ディレクトリに配置する。
 * 別言語を追加する場合:
 * 1. locales/en.ts 等を作成し LocaleConfig を実装
 * 2. 下部の activeLocale を切り替え
 *
 * テーマ固有テキスト（アプリ名、カテゴリ名等）は theme.ts が管理し、
 * 汎用UIテキスト（ボタンラベル、フィードバック等）はこのファイルが管理する。
 */

export interface LocaleConfig {
  // === Session Labels (doubles as UI display + identity sentinel) ===
  readonly sessionLabels: {
    readonly recommend: string
    readonly shared: string
    readonly microQuizTip: string
  }

  // === Common ===
  readonly common: {
    readonly start: string
    readonly close: string
    readonly back: string
    readonly next: string
    readonly copied: string
    readonly questionSuffix: string
    readonly categorySuffix: string
    readonly approxMinutes: string
    readonly menu: string
  }

  // === Error Boundary ===
  readonly errorBoundary: {
    readonly title: string
    readonly message: string
    readonly reload: string
  }

  // === PWA Update ===
  readonly pwaUpdate: {
    readonly updated: string
    readonly reload: string
  }

  // === App Update Banner (Electron) ===
  readonly updateBanner: {
    readonly message: (version: string) => string
    readonly forceMessage: (version: string) => string
    readonly download: string
    readonly openRelease: string
    readonly dismiss: string
  }

  // === Offline ===
  readonly offline: {
    readonly indicator: string
  }

  // === Welcome ===
  readonly welcome: {
    readonly startButton: string
    readonly tryOneQuestion: string
    readonly tryOneSessionLabel: string
  }

  // === Quiz Feedback ===
  readonly feedback: {
    readonly correct: string
    readonly incorrect: string
    readonly explanation: string
    readonly yourAnswer: string
    readonly correctAnswer: string
    readonly whyWrong: string
    readonly officialDocs: string
    readonly openDocs: string
    readonly copyMarkdown: string
    readonly markdownCopied: string
    readonly copyExplanation: string
    readonly aiLearnMore: string
    readonly promptCopied: string
    readonly actionButtons: string
    readonly prompts: {
      readonly explain: { label: string; description: string }
      readonly practical: { label: string; description: string }
      readonly compare: { label: string; description: string }
    }
  }

  // === Quiz Card ===
  readonly quizCard: {
    readonly noQuestions: string
    readonly noQuestionsHint: string
    readonly backToMenu: string
    readonly bookmark: string
    readonly unbookmark: string
    readonly hint: string
    readonly usedHint: string
    readonly showHint: string
    readonly multiSelectGroup: string
    readonly singleSelectGroup: string
    readonly multiSelectHint: string
    readonly retryButton: string
    readonly retryLabel: string
    readonly defaultHint: string
    readonly docsLink: string
    readonly adaptiveTooltip: string
    readonly adaptiveLabel: string
    readonly reviewBadge: string
    readonly questionLabel: (index: number, answered: boolean) => string
    readonly submitAnswer: string
    readonly selectOption: string
    readonly optionBase: (label: string, text: string) => string
    readonly optionSelected: string
    readonly optionCorrect: string
    readonly optionIncorrect: string
    readonly finishTest: (answered: number, total: number) => string
    readonly nextQuestion: string
  }

  // === Quiz Result ===
  readonly result: {
    readonly reviewNote: string
    readonly passing: string
    readonly notPassing: string
    readonly reviewWrong: (count: number) => string
    readonly retryAgain: string
    readonly shareButton: string
    readonly textShare: string
    readonly answerProgress: (answered: number, total: number, unanswered: number) => string
  }

  // === Certificate ===
  readonly certificate: {
    readonly congrats: string
    readonly canIssue: string
    readonly namePlaceholder: string
    readonly nameWithContext: string
    readonly nameLabel: string
    readonly generating: string
    readonly download: string
    readonly noCertificates: string
    readonly eligibilityHint: string
    readonly earnedCount: (count: number) => string
  }

  // === Menu ===
  readonly menu: {
    readonly historyLabel: string
    readonly shortcutsLabel: string
    readonly themeToggle: string
    readonly answered: string
    readonly modeSection: string
    readonly otherModes: string
    readonly difficultySection: string
    readonly checkUpdate: string
  }

  // === Search ===
  readonly search: {
    readonly placeholder: string
    readonly label: string
    readonly closeLabel: string
    readonly noResults: string
    readonly resultsSuffix: string
    readonly searchResultsFor: string
    readonly searchReference: string
    readonly inputPlaceholder: string
    readonly categoryFilterLabel: string
    readonly allCategories: string
    readonly saved: string
    readonly learnLater: string
    readonly challengeQuestions: (count: number) => string
    readonly showAllRemaining: (remaining: number) => string
    readonly searchResultsTitle: (query: string) => string
    readonly correctMark: (score: number, total: number) => string
  }

  // === Daily ===
  readonly daily: {
    readonly todaysPlan: string
    readonly reviewPrefix: string
    readonly goalPrefix: string
    readonly achieved: string
    readonly dailyGoalLabel: string
    readonly dailyGoalProgress: string
  }

  // === Streak ===
  readonly streak: {
    readonly daySuffix: string
    readonly consecutive: string
    readonly amazing20: string
    readonly great10: string
    readonly nice5: string
    readonly good3: string
    readonly streakMessage: (label: string, count: number) => string
    readonly milestones: readonly { days: number; label: string; emoji: string }[]
    readonly learningToday: string
    readonly streakLabel: (days: number) => string
  }

  // === Progress ===
  readonly progress: {
    readonly title: string
    readonly totalAnswers: string
    readonly correctCount: string
    readonly accuracy: string
    readonly sessionCount: string
    readonly bestAccuracy: string
    readonly growthTrend: string
    readonly teachable: string
    readonly teachableDesc: string
    readonly accuracyPrefix: string
    readonly weakChallenge: string
    readonly exportLabel: string
    readonly importLabel: string
    readonly csvExport: string
    readonly resetLabel: string
    readonly chartTitle: string
    readonly chartLabel: string
    readonly past: string
    readonly latest: string
    readonly exported: string
    readonly exportFailed: string
    readonly imported: string
    readonly importFailed: string
    readonly invalidFile: string
    readonly csvExported: string
    readonly csvExportFailed: string
    readonly confirmOverwrite: string
    readonly confirmReset: string
    readonly errorPrefix: string
    readonly sessionCountLabel: string
    readonly sessionCountSuffix: string
    readonly emptyTitle: string
    readonly emptyMessage: string
    readonly startFirst: string
    readonly chartSection: string
    readonly recentSessions: string
    readonly categorySection: string
    readonly dataManagement: string
    readonly passingLine: (score: number) => string
    readonly needMoreSessions: string
  }

  // === Mastery ===
  readonly mastery: {
    readonly nextPrefix: string
    readonly nextLevelProgress: string
    readonly maxLevel: string
    readonly totalXpLabel: (xp: number) => string
    readonly avgXpLabel: (avg: string) => string
    readonly xpTooltip: string
    readonly downloadCert: string
    readonly downloadLevel: (title: string) => string
    readonly levelReached: (name: string, req: string) => string
    readonly nextLevel: (icon: string, name: string, req: string) => string
    readonly xpGained: (gain: number) => string
  }

  // === Skills Acquired ===
  readonly skills: {
    readonly heading: string
  }

  // === Personal Best ===
  readonly personalBest: {
    readonly updated: string
  }

  // === Resume Session ===
  readonly resumeSession: {
    readonly discardLabel: string
    readonly discardButton: string
    readonly hasResume: string
    readonly resumeButton: string
    readonly correctSuffix: string
    readonly progressText: (modeName: string, progress: string) => string
  }

  // === Install Prompt ===
  readonly install: {
    readonly useAsApp: string
    readonly iosStep1: string
    readonly iosStep2: string
    readonly installApp: string
    readonly installDesc: string
    readonly addButton: string
  }

  // === Diagrams ===
  readonly diagrams: {
    readonly hierarchy: string
    readonly cycle: string
    readonly comparison: string
    readonly flow: string
    readonly terminal: string
    readonly terminalSkip: string
    readonly terminalReplay: string
    readonly terminalCopy: string
    readonly config: string
    readonly network: string
    readonly sequence: string
    readonly layer: string
    readonly swimlane: string
    readonly venn: string
    readonly matrix: string
    readonly tree: string
    readonly formula: string
    readonly keyboard: string
    readonly highPriority: string
    readonly lowPriority: string
    readonly outerOverrides: string
    readonly innerBase: string
    readonly time: string
    readonly switchTrigger: (trigger: string) => string
    readonly switchSuffix: string
  }

  // === Category Trend ===
  readonly categoryTrend: {
    readonly heading: string
    readonly emptyMessage: string
    readonly insufficientData: string
    readonly chartLabel: string
  }

  // === Related Questions ===
  readonly relatedQuestions: {
    readonly heading: string
  }

  // === Timer ===
  readonly timer: {
    readonly remaining: (minutes: number, seconds: number) => string
  }

  // === Recommendation ===
  readonly recommendation: {
    readonly heading: string
    readonly newArea: string
    readonly allMastered: string
    readonly allMasteredMessage: string
    readonly fullTestAction: string
    readonly growthArea: string
    readonly expertGoal: string
    readonly retention: string
    readonly retentionMessage: string
    readonly weakModeAction: string
    readonly exploreMessage: (name: string, icon: string) => string
    readonly exploreAction: (name: string) => string
    readonly improveMessage: (name: string, icon: string, accuracy: number) => string
    readonly improveAction: (name: string) => string
    readonly masteryMessage: (name: string, icon: string, accuracy: number) => string
    readonly masteryAction: (name: string) => string
    readonly reviewAction: (name: string) => string
    readonly reviewDesc: (accuracy: number) => string
    readonly unansweredTitle: (name: string, count: number) => string
    readonly strengthenTitle: (name: string) => string
    readonly strengthenDesc: (accuracy: number) => string
  }

  // === Weak Point ===
  readonly weakPoint: {
    readonly heading: string
  }

  // === Session History ===
  readonly sessionHistory: {
    readonly modes: Record<string, string>
    readonly sessionLabel: (index: number) => string
    readonly noHistory: string
    readonly historyTitle: (count: number) => string
  }

  // === Reader ===
  readonly reader: {
    readonly title: string
    readonly subtitle: string
    readonly allQuestions: string
    readonly bookmarked: string
    readonly wrongAnswers: string
    readonly weakAreas: string
    readonly unanswered: string
    readonly noResults: string
    readonly correctAnswer: string
    readonly countLabel: (filtered: number, total: number) => string
    readonly allPages: string
  }

  // === Streak Banner ===
  readonly streakBanner: {
    readonly milestones: {
      readonly day100: string
      readonly day60: string
      readonly day30: string
      readonly day14: string
      readonly day7: string
      readonly day3: string
    }
    readonly streakAchieved: (days: number) => string
    readonly dailyGoalDone: string
    readonly dailyGoalProgress: (current: number, goal: number) => string
  }

  // === Category Breakthrough ===
  readonly categoryBreakthrough: {
    readonly bestUpdate: (icon: string, name: string, prev: number, now: number) => string
  }

  // === Tutorial ===
  readonly tutorial: {
    readonly skip: string
    readonly slideLabel: (index: number) => string
    readonly prevLabel: string
    readonly slides: ReadonlyArray<{
      readonly title: string
      readonly description: string
      readonly tip?: string
    }>
    readonly terminalYou: string
    readonly terminalClaude: string
    readonly terminalPrompt: string
    readonly terminalReply: string
    readonly terminalReplyCont: string
    readonly bubbles: readonly string[]
    readonly capabilities: ReadonlyArray<{ readonly label: string }>
    readonly pathSteps: ReadonlyArray<{
      readonly label: string
      readonly desc: string
    }>
  }

  // === Chapter Intro ===
  readonly chapterIntro: {
    readonly mistakesOkTitle: string
    readonly mistakesOkBody: string
    readonly learningPointsHeading: string
    readonly startLearning: string
    readonly startChapter: string
    readonly showOverview: string
  }

  // === Chapter Progress Map ===
  readonly chapterProgress: {
    readonly retryChapter: string
    readonly continueChapter: string
    readonly startChapter: string
    readonly allComplete: string
    readonly allClearMessage: (total: number) => string
    readonly fullTestButton: string
    readonly progressHeading: string
    readonly correctCount: (correct: number, total: number) => string
    readonly remainingCount: (n: number) => string
  }

  // === Chapter Complete ===
  readonly chapterComplete: {
    readonly complete: string
    readonly wellDone: string
    readonly reviewAdvice: string
    readonly nextChapter: string
    readonly seeResults: string
    readonly stopForToday: string
    readonly correctSuffix: (score: number, total: number) => string
  }

  // === Study First ===
  readonly studyFirst: {
    readonly title: string
    readonly subtitle: string
    readonly howToLearnTitle: string
    readonly howToLearnBody: string
    readonly afterLearning: string
    readonly doneReading: string
    readonly readingDoneTitle: string
    readonly readingDoneBody: (questionCount: number) => string
    readonly startQuiz: string
    readonly reread: string
    readonly backToChapters: string
  }

  // === First Time Guide ===
  readonly firstTimeGuide: {
    readonly beginnerLabel: string
    readonly beginnerDesc: string
    readonly recommendedBadge: string
    readonly quizLearnLabel: string
    readonly quizLearnDesc: string
    readonly readFirstLabel: string
    readonly readFirstDesc: string
    readonly experiencedLabel: string
    readonly experiencedDesc: string
  }

  // === Menu Header ===
  readonly menuHeader: {
    readonly openMenu: string
    readonly closeMenu: string
    readonly menuLabel: string
    readonly aboutClaude: string
    readonly aboutClaudeDesc: string
    readonly quizModes: string
    readonly scenarioLabel: string
    readonly scenarioDesc: string
    readonly bookmarkLabel: string
    readonly bookmarkSaving: (count: number) => string
    readonly bookmarkEmpty: string
    readonly bookmarkHint: string
    readonly progressDesc: string
    readonly readFirstLabel: string
    readonly readFirstDesc: string
    readonly lightMode: string
    readonly darkMode: string
    readonly keyboardShortcuts: string
    readonly checking: string
    readonly latestVersion: string
    readonly checkFailed: string
    readonly updateCheck: string
    readonly streakFooter: (streak: number, count: number, goal: number) => string
    readonly dailyGoalLabel: (count: number, goal: number) => string
    readonly quizModesButton: string
    readonly quizModesDesc: string
    readonly streakBadge: (days: number) => string
    readonly unansweredChallenge: string
    readonly unansweredChallengeDesc: string
    readonly categoryLabel: (name: string, answered: number, total: number) => string
    readonly answeredLabel: (answered: number, total: number) => string
    readonly bookmarkList: string
    readonly bookmarkListDesc: string
    readonly reloadApp: string
    readonly downloadUpdate: string
    readonly learningSection: string
    readonly referenceSection: string
    readonly settingsSection: string
    readonly aboutApp: string
  }

  // === Weak Point (extended) ===
  readonly weakPointDetail: {
    readonly wrongCountLabel: (count: number, accuracy: number) => string
    readonly reviewButton: string
    readonly weakTopics: string
    readonly openDocLabel: (label: string) => string
  }

  // === Scenario ===
  readonly scenario: {
    readonly epilogue: string
    readonly beforeQuestion: (current: number, total: number) => string
    readonly nextButton: string
    readonly difficultyLabels: Record<string, string>
    readonly questionStats: (total: number, answered: number) => string
  }

  // === Category Picker ===
  readonly categoryPicker: {
    readonly title: string
    readonly cancel: string
    readonly dialogLabel: string
  }

  // === Encouragement ===
  readonly encouragement: {
    readonly messages: readonly string[]
  }

  // === Next Recommendation (QuizResult) ===
  readonly nextRecommend: {
    readonly fullTest: string
    readonly fullTestDesc: string
    readonly unansweredDesc: string
    readonly randomTest: string
    readonly randomTestDesc: string
  }

  // === Keyboard Shortcuts ===
  readonly shortcuts: {
    readonly quizSection: string
    readonly selectOption: string
    readonly moveOption: string
    readonly submitNext: string
    readonly retry: string
    readonly shortcutSection: string
    readonly showHelp: string
    readonly closeDialog: string
    readonly title: string
    readonly showAnytime: string
  }

  // === Usage Recommend ===
  readonly recommend: {
    readonly questionCount: (n: number) => string
  }

  // === Growth Tracking ===
  readonly growth: {
    readonly resolved: (pattern: string) => string
    readonly improved: (pattern: string, pct: number, prev: number, curr: number) => string
    readonly newIssue: (pattern: string) => string
  }

  // === Memory Retention ===
  readonly retention: {
    readonly labels: readonly string[]
    readonly remainingMessage: (n: number) => string
    readonly meterLabel: string
    readonly helpTooltip: string
  }

  // === Share Image ===
  readonly shareImage: {
    readonly idle: string
    readonly generating: string
    readonly copied: string
    readonly downloaded: string
    readonly streakLabel: string
    readonly levelLabel: string
    readonly scoreDetail: (score: number, total: number) => string
    readonly streakDays: (days: number) => string
  }

  // === Daily Snapshot ===
  readonly snapshot: {
    readonly reviewDue: (n: number) => string
    readonly goalRemaining: (n: number) => string
    readonly lastSession: string
    readonly hoursAgo: (n: number) => string
    readonly daysAgo: (n: number) => string
    readonly forecastLabel: string
    readonly tomorrow: string
    readonly dayAfterTomorrow: string
    readonly daysLater: (n: number) => string
    readonly noDataMessage: string
    readonly todaysPlan: string
    readonly reviewAll: (n: number) => string
    readonly reviewAllLabel: (n: number) => string
    readonly quickCheck: string
    readonly quickCheckLabel: string
    readonly randomChallenge: string
    readonly randomChallengeLabel: string
    readonly reviewDueStrong: (n: number) => string
    readonly forecastCount: (n: number) => string
  }

  // === Notification ===
  readonly notification: {
    readonly title: string
    readonly desc: string
    readonly allow: string
    readonly later: string
  }

}

// ============================================================
// アクティブロケール — 言語切り替えはここを変更
// ============================================================

import { ja } from '@/config/locales/ja'

/** 現在のロケール設定。別言語に切り替える場合はインポートを差し替える */
export const locale: LocaleConfig = ja
