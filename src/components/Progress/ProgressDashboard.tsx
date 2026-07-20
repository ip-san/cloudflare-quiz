import { ChevronDown, ChevronUp } from 'lucide-react'
import { locale } from '@/config/locale'
import { type Category, PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { calculateAccuracy, PASSING_SCORE, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'
import { getColorHex } from '@/lib/colors'
import { buttonStyles, cardStyles, headerStyles, pageStyles } from '@/lib/styles'
import { CategoryTrendChart } from './CategoryTrendChart'
import { CertificateHistory } from './CertificateHistory'
import { LearningRecommendation } from './LearningRecommendation'
import { MasteryLevel } from './MasteryLevel'
import { SessionHistoryChart } from './SessionHistoryChart'
import { SessionHistoryList } from './SessionHistoryList'
import { useProgressDashboard } from './useProgressDashboard'
import { WeakPointInsight } from './WeakPointInsight'

export function ProgressDashboard() {
  const {
    allQuestions,
    userProgress,
    setViewState,
    startSession,
    categoryStats,
    overallAccuracy,
    hasNoProgress,
    masteryIndex,
    trendInfo,
    teachableCategories,
    exportStatus,
    isStatusError,
    showCharts,
    showCategories,
    showDataManagement,
    setShowCharts,
    setShowCategories,
    setShowDataManagement,
    handleExport,
    handleImport,
    handleExportCsv,
    handleReset,
  } = useProgressDashboard()

  return (
    <div className={`min-h-dvh ${pageStyles.cream}`}>
      {/* Sticky header */}
      <div className={`${headerStyles.sticky} px-4 py-3 sm:px-6`}>
        <div className="mx-auto flex items-center justify-between sm:max-w-2xl lg:max-w-4xl">
          <h1 className="text-lg font-bold text-claude-dark">{locale.progress.title}</h1>
          <button
            onClick={() => setViewState('menu')}
            className="tap-highlight rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300"
          >
            {locale.common.close}
          </button>
        </div>
      </div>

      <div className="px-4 pb-8 pt-4 sm:px-6">
        <div className="mx-auto sm:max-w-2xl lg:max-w-4xl">
          {/* Empty State */}
          {hasNoProgress && (
            <div className={`mb-8 ${cardStyles.elevated} p-8 text-center`}>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-700">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="mb-2 text-lg font-medium text-claude-dark">{locale.progress.emptyTitle}</h3>
              <p className="mb-4 text-sm text-stone-500">{locale.progress.emptyMessage}</p>
              <button
                onClick={() => setViewState('menu')}
                className="tap-highlight rounded-2xl bg-claude-orange px-6 py-3 text-sm font-semibold text-white"
              >
                {locale.progress.startFirst}
              </button>
            </div>
          )}

          {/* Overall Stats — always visible */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={locale.progress.totalAnswers} value={userProgress.totalAttempts} icon="📝" />
            <StatCard label={locale.progress.correctCount} value={userProgress.totalCorrect} icon="✅" />
            <StatCard label={locale.progress.accuracy} value={`${overallAccuracy}%`} icon="📊" />
            <StatCard
              label={locale.progress.sessionCountLabel}
              value={`${userProgress.sessionHistory.length}${locale.progress.sessionCountSuffix}`}
              icon="📚"
            />
          </div>

          {/* AI Mastery Level + XP — unified level display */}
          {!hasNoProgress && (
            <MasteryLevel
              overallAccuracy={overallAccuracy}
              totalAttempts={userProgress.totalAttempts}
              totalXp={userProgress.totalXp}
              categoryStats={categoryStats}
            />
          )}

          {/* Certificate History — always visible */}
          {!hasNoProgress && (
            <CertificateHistory
              sessionHistory={userProgress.sessionHistory}
              masteryIndex={masteryIndex}
              overallAccuracy={overallAccuracy}
            />
          )}

          {/* Learning Recommendation — always visible */}
          {!hasNoProgress && (
            <LearningRecommendation
              categoryStats={categoryStats}
              totalAttempts={userProgress.totalAttempts}
              onStartSession={startSession}
            />
          )}

          {/* Weak Point Insight — always visible */}
          {!hasNoProgress && (
            <WeakPointInsight
              allQuestions={allQuestions}
              userProgress={userProgress}
              categoryStats={categoryStats}
              onStartSession={startSession}
            />
          )}

          {/* Action button — always visible */}
          {!hasNoProgress && (
            <button
              onClick={() => startSession({ mode: 'weak' })}
              className="tap-highlight mb-4 w-full rounded-2xl bg-claude-orange px-6 py-3 font-semibold text-white"
            >
              {`🎯 ${locale.progress.weakChallenge}`}
            </button>
          )}

          {/* ── Collapsible: Charts ── */}
          {!hasNoProgress && (
            <CollapsibleSection
              title={locale.progress.chartSection}
              isOpen={showCharts}
              onToggle={() => setShowCharts(!showCharts)}
            >
              <SessionHistoryChart sessions={userProgress.sessionHistory} />
              <div className="mt-4">
                <CategoryTrendChart sessions={userProgress.sessionHistory} />
              </div>
              {(trendInfo.trend !== null || trendInfo.best !== null) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {trendInfo.best !== null && (
                    <div className={`flex-1 ${cardStyles.base} p-4`}>
                      <div className="mb-1 text-xs text-stone-500">{locale.progress.bestAccuracy}</div>
                      <div className="text-2xl font-bold text-claude-orange">{trendInfo.best}%</div>
                    </div>
                  )}
                  {trendInfo.trend !== null && (
                    <div className={`flex-1 ${cardStyles.base} p-4`}>
                      <div className="mb-1 text-xs text-stone-500">{locale.progress.growthTrend}</div>
                      <div className={`text-2xl font-bold ${trendInfo.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {trendInfo.trend >= 0 ? '+' : ''}
                        {trendInfo.trend}%
                      </div>
                    </div>
                  )}
                </div>
              )}
              {userProgress.sessionHistory.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-stone-500">{locale.progress.recentSessions}</h3>
                  <SessionHistoryList sessions={userProgress.sessionHistory} limit={5} />
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ── Collapsible: Category Details ── */}
          {!hasNoProgress && (
            <CollapsibleSection
              title={locale.progress.categorySection}
              isOpen={showCategories}
              onToggle={() => setShowCategories(!showCategories)}
            >
              {/* Teaching readiness */}
              {teachableCategories.length > 0 && (
                <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-500/30 dark:bg-purple-500/10">
                  <p className="mb-2 text-sm font-bold text-purple-700 dark:text-purple-300">{`🎓 ${locale.progress.teachable}`}</p>
                  <div className="flex flex-wrap gap-2">
                    {teachableCategories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                      >
                        {cat.icon} {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {PREDEFINED_CATEGORIES.map((category: Category) => {
                  const stats = categoryStats[category.id]
                  const progress = stats ? calculateAccuracy(stats.correctAnswers, stats.attemptedQuestions) : 0
                  const attempted = stats?.attemptedQuestions ?? 0
                  const total = stats?.totalQuestions ?? 0
                  return (
                    <div key={category.id} className={`${cardStyles.base} p-4`}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          <span className="font-medium text-claude-dark">{category.name}</span>
                          {progress >= SCORE_COLORS.excellent + 10 && <span className="text-xs">🏆</span>}
                          {progress >= PASSING_SCORE && progress < SCORE_COLORS.excellent + 10 && (
                            <span className="text-xs">⭐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${progress >= PASSING_SCORE ? 'text-green-600' : progress >= SCORE_COLORS.fair ? 'text-amber-600' : 'text-stone-500'}`}
                          >
                            {progress}%
                          </span>
                          <span className="text-xs text-stone-500">
                            {attempted}/{total}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                        <div
                          className="h-full rounded-full progress-gradient"
                          style={{
                            width: `${(attempted / Math.max(total, 1)) * 100}%`,
                            backgroundColor: getColorHex(category.color ?? 'gray'),
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Collapsible: Data Management ── */}
          <CollapsibleSection
            title={locale.progress.dataManagement}
            isOpen={showDataManagement}
            onToggle={() => setShowDataManagement(!showDataManagement)}
          >
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={handleExport} className={`${buttonStyles.secondary} flex-1`}>
                  {`📥 ${locale.progress.exportLabel}`}
                </button>
                <button onClick={handleImport} className={`${buttonStyles.secondary} flex-1`}>
                  {`📤 ${locale.progress.importLabel}`}
                </button>
              </div>
              <button onClick={handleExportCsv} className={`${buttonStyles.secondary} w-full`}>
                {`📊 ${locale.progress.csvExport}`}
              </button>
              {exportStatus && (
                <div
                  className={`rounded-2xl px-4 py-2 text-center text-sm ${
                    isStatusError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {exportStatus}
                </div>
              )}
              <button
                onClick={handleReset}
                className="tap-highlight w-full rounded-2xl border border-red-600/50 px-6 py-3 font-semibold text-red-400"
              >
                {locale.progress.resetLabel}
              </button>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}

/** Collapsible section with chevron toggle */
function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="tap-highlight mb-2 flex w-full items-center justify-between rounded-xl px-1 py-2 text-left"
      >
        <h2 className="text-sm font-semibold text-stone-500">{title}</h2>
        {isOpen ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>
      {isOpen && <div className="animate-card-enter">{children}</div>}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className={`animate-card-enter ${cardStyles.elevated} p-3`}>
      <div className="mb-0.5 text-lg">{icon}</div>
      <div className="text-xl font-bold text-claude-dark">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  )
}
