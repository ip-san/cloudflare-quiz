import { BookOpen, ChevronDown, Home, RotateCcw, Share2 } from 'lucide-react'
import { useState } from 'react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { DailyGoalService } from '@/domain/services/DailyGoalService'
import { getMasteryLevel } from '@/domain/services/MasteryLevelService'
import { CERTIFICATE_THRESHOLDS } from '@/domain/valueObjects/ScoreThresholds'
import { trackShare } from '@/lib/analytics'
import { CategoryBreakthroughBadge } from './overlays/CategoryBreakthroughBadge'
import { ConfettiEffect } from './overlays/ConfettiEffect'
import { LevelUpBadge } from './overlays/LevelUpBadge'
import { DailyGoalBadge, StreakMilestoneBadge } from './overlays/StreakMilestoneBadge'
import { CertificateGenerator } from './result/CertificateGenerator'
import { NextRecommendation } from './result/NextRecommendation'
import { PersonalBest } from './result/PersonalBest'
import { ScoreRing } from './result/ScoreRing'
import { ShareImageGenerator } from './result/ShareImageGenerator'
import { SkillsAcquired } from './result/SkillsAcquired'
import { STAR_PERCENTAGE_DIVISOR, useQuizResult } from './useQuizResult'

export function QuizResult() {
  const {
    // Animation state
    showStars,
    showContent,
    noMotion,

    // Derived values
    percentage,
    isPassing,
    result,
    isFirstSession,

    // Store state
    sessionState,
    sessionConfig,
    sessionWrongAnswers,
    userProgress,
    categoryStats,
    score,
    answeredCount,
    totalQuestions,
    hasUnanswered,
    hintsUsedCount,
    isReviewMode,
    hasWrongAnswers,

    // Handlers
    handleRetry,
    handleBackToMenu,
    startReviewSession,
  } = useQuizResult()

  return (
    <div className="min-h-dvh overflow-y-auto px-4 py-8 sm:flex sm:items-center sm:justify-center">
      <div
        className={`mx-auto w-full rounded-2xl border sm:max-w-md ${result.borderColor} ${result.bgColor} p-5 text-center shadow-lg sm:p-8 ${
          noMotion ? '' : 'animate-result-enter'
        }`}
      >
        {/* Confetti on perfect/excellent score */}
        {percentage >= CERTIFICATE_THRESHOLDS.full && !noMotion && <ConfettiEffect />}

        {/* Score Ring */}
        <div className={`mb-4 ${noMotion ? '' : 'animate-bounce-in'}`}>
          <ScoreRing
            percentage={percentage}
            score={score}
            total={answeredCount}
            color={result.color}
            noMotion={noMotion}
          />
        </div>

        {/* Title + pass/fail — compact header */}
        <h2 className={`mb-1 text-xl font-bold sm:text-2xl ${result.color}`}>{result.title}</h2>
        <p className="mb-2 text-sm text-stone-500">{result.message}</p>
        <div className="mb-4 inline-flex flex-wrap items-center justify-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isPassing ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'
            }`}
          >
            {isPassing ? locale.result.passing : locale.result.notPassing}
          </span>
          {hintsUsedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">💡{hintsUsedCount}</span>
          )}
        </div>

        {/* Unanswered note (timer expired) */}
        {hasUnanswered && (
          <p className="mb-2 text-xs text-stone-500">
            {locale.result.answerProgress(answeredCount, totalQuestions, totalQuestions - answeredCount)}
          </p>
        )}

        {/* Personal best + review mode note */}
        <PersonalBest sessionHistory={userProgress.sessionHistory} currentPercentage={percentage} />
        {isReviewMode && <p className="mb-4 text-xs text-stone-500">{locale.result.reviewNote}</p>}

        {/* Achievement badges — grouped as one cluster */}
        {showStars && !isReviewMode && sessionState && (
          <div className="mb-4 space-y-2">
            <CategoryBreakthroughBadge
              questions={sessionState.questions}
              answerHistory={sessionState.answerHistory}
              userProgress={userProgress}
            />
            <LevelUpBadge previousXp={sessionState.initialXp ?? 0} currentXp={userProgress.totalXp} />
            <StreakMilestoneBadge
              currentStreak={userProgress.streakDays}
              previousStreak={sessionState.initialStreakDays ?? 0}
            />
            <DailyGoalBadge
              previousTodayCount={sessionState.initialTodayCount ?? 0}
              currentTodayCount={userProgress.getDailyCount(DailyGoalService.getTodayString())}
              dailyGoal={userProgress.dailyGoal}
            />
          </div>
        )}

        {/* Content below stars fades in after stars */}
        <div
          className={noMotion || showContent ? 'opacity-100' : 'opacity-0'}
          style={{ transition: noMotion ? 'none' : 'opacity 0.3s ease-out' }}
        >
          {/* Next recommendation — single unified CTA */}
          {!isReviewMode && !isFirstSession && <NextRecommendation mode={sessionConfig.mode} percentage={percentage} />}

          {/* Skills acquired — hidden on first session to keep it simple */}
          {!isReviewMode && !isFirstSession && sessionState && (
            <SkillsAcquired questions={sessionState.questions} answerHistory={sessionState.answerHistory} />
          )}

          {/* Certificate — hidden on first session */}
          {!isFirstSession && (
            <CertificateGenerator
              score={score}
              total={answeredCount}
              percentage={percentage}
              mode={sessionConfig.mode}
            />
          )}

          {/* Action buttons — primary CTAs first, share collapsed */}
          <div className="flex flex-col gap-3">
            {hasWrongAnswers && !isReviewMode && (
              <button
                onClick={startReviewSession}
                className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-white"
              >
                <BookOpen className="h-5 w-5" />
                {locale.result.reviewWrong(sessionWrongAnswers.length)}
              </button>
            )}
            <button
              onClick={handleRetry}
              className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-claude-orange px-6 py-3.5 text-base font-semibold text-white"
            >
              <RotateCcw className="h-5 w-5" />
              {locale.result.retryAgain}
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleBackToMenu}
                className="tap-highlight inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
              >
                <Home className="h-4 w-4" />
                {locale.common.menu}
              </button>
              <ShareSection
                score={score}
                answeredCount={answeredCount}
                percentage={percentage}
                isPassing={isPassing}
                userProgress={userProgress}
                categoryStats={categoryStats}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** シェア機能を折りたたみにまとめたセクション */
function ShareSection({
  score,
  answeredCount,
  percentage,
  isPassing,
  userProgress,
  categoryStats,
}: {
  score: number
  answeredCount: number
  percentage: number
  isPassing: boolean
  userProgress: { streakDays: number; totalXp: number; totalAttempts: number; getOverallAccuracy: () => number }
  categoryStats: Record<string, { accuracy: number; attemptedQuestions: number; totalQuestions: number }>
}) {
  const [open, setOpen] = useState(false)
  const mastery = getMasteryLevel(userProgress.getOverallAccuracy(), userProgress.totalAttempts, categoryStats)

  return (
    <div className="relative flex-1">
      <button
        onClick={() => setOpen(!open)}
        className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300"
      >
        <Share2 className="h-4 w-4" />
        {locale.result.shareButton}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {'share' in navigator && (
            <button
              onClick={() => {
                const stars = '⭐'.repeat(Math.ceil(percentage / STAR_PERCENTAGE_DIVISOR))
                navigator
                  .share({
                    title: theme.appName,
                    text: `${stars}\n${theme.appName}: ${score}/${answeredCount}${locale.common.questionSuffix} (${percentage}%)\n${isPassing ? locale.result.passing : locale.result.notPassing}\n${mastery.icon} ${mastery.name} | ${userProgress.totalXp} XP\n${theme.shareHashtags}`,
                    url: window.location.href,
                  })
                  .then(() => trackShare('native'))
                  .catch(() => {
                    /* user cancelled share */
                  })
              }}
              className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300"
            >
              <Share2 className="h-4 w-4" />
              {locale.result.textShare}
            </button>
          )}
          <ShareImageGenerator
            score={score}
            total={answeredCount}
            percentage={percentage}
            streakDays={userProgress.streakDays}
            totalXp={userProgress.totalXp}
            masteryName={mastery.name}
            masteryIcon={mastery.icon}
          />
        </div>
      )}
    </div>
  )
}
