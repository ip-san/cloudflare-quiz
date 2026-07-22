import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Code2,
  FileText,
  MessageSquare,
  Shield,
  Terminal,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { AppLogo } from '@/components/Layout/AppLogo'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { trackTutorial } from '@/lib/analytics'
import { haptics } from '@/lib/haptics'
import { hasSeenFlag, setSeenFlag } from '@/lib/storage'

interface TutorialScreenProps {
  onComplete: (action: 'complete' | 'skip') => void
}

interface SlideData {
  iconType: 'terminal' | 'message' | 'zap' | 'logo'
  title: string
  description: string
  visualType: 'terminal' | 'bubbles' | 'capabilities' | 'path'
  tip?: string | undefined
}

const SLIDE_DATA: SlideData[] = locale.tutorial.slides.map((slide, i) => ({
  iconType: (['terminal', 'logo'] as const)[i],
  title: slide.title,
  description: slide.description,
  visualType: (['terminal', 'path'] as const)[i],
  tip: slide.tip,
}))

function SlideIcon({ type }: { type: SlideData['iconType'] }) {
  switch (type) {
    case 'terminal':
      return <Terminal className="h-8 w-8 text-cf-accent" />
    case 'message':
      return <MessageSquare className="h-8 w-8 text-blue-500" />
    case 'zap':
      return <Zap className="h-8 w-8 text-purple-500" />
    case 'logo':
      return <AppLogo size={32} />
  }
}

function SlideVisual({ type }: { type: SlideData['visualType'] }) {
  switch (type) {
    case 'terminal':
      return (
        <div className="rounded-xl bg-stone-900 p-4 font-mono text-sm">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-stone-500">Terminal</span>
          </div>
          <p className="text-stone-400">
            {/* 派生元(Claude Code版)ではチャット形式だったが、wrangler は
                コマンド→出力の形が自然なので、テーマのprompt/replyをそのまま
                ターミナル出力として描画する */}
            <span className="text-green-400">$</span> {locale.tutorial.terminalPrompt}
          </p>
          <p className="mt-2 text-stone-300">{locale.tutorial.terminalReply}</p>
          <p className="text-stone-300">{locale.tutorial.terminalReplyCont}</p>
          <span className="animate-pulse text-cf-orange">|</span>
        </div>
      )
    case 'bubbles':
      return (
        <div className="space-y-3">
          {locale.tutorial.bubbles.map((text, i) => {
            const colors = [
              'bg-blue-50 dark:bg-blue-900/30',
              'bg-green-50 dark:bg-green-900/30',
              'bg-purple-50 dark:bg-purple-900/30',
              'bg-amber-50 dark:bg-amber-900/30',
            ]
            return (
              <div key={text} className={`flex items-center gap-2 rounded-xl ${colors[i]} px-4 py-2.5`}>
                <span>💬</span>
                <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{text}</span>
              </div>
            )
          })}
        </div>
      )
    case 'capabilities':
      return (
        <div className="grid grid-cols-2 gap-2">
          {[Code2, FileText, Terminal, Shield].map((Icon, i) => (
            <div
              key={locale.tutorial.capabilities[i].label}
              className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow-xs dark:bg-stone-800"
            >
              <div className="text-cf-accent">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                {locale.tutorial.capabilities[i].label}
              </span>
            </div>
          ))}
        </div>
      )
    case 'path':
      return (
        <div className="space-y-2">
          {locale.tutorial.pathSteps.map((item, i) => (
            <div key={i + 1} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-xs dark:bg-stone-800">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cf-accent/10 text-sm font-bold text-cf-accent">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-cf-ink dark:text-stone-200">{item.label}</p>
                <p className="text-xs text-stone-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )
  }
}

/**
 * Cloudflare 紹介チュートリアル
 *
 * ウェルカム画面の後、初回ユーザー向けに表示。
 * スワイプ or ボタンで2画面を進む形式。
 */
export function TutorialScreen({ onComplete }: TutorialScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slide = SLIDE_DATA[currentSlide]
  const isLast = currentSlide === SLIDE_DATA.length - 1

  const goNext = () => {
    haptics.light()
    if (isLast) {
      trackTutorial('complete')
      onComplete('complete')
    } else {
      setCurrentSlide((prev) => prev + 1)
    }
  }

  const goPrev = () => {
    haptics.light()
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1)
    }
  }

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-cf-surface dark:bg-stone-900">
      {/* Skip button — made more prominent to reduce frustration */}
      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={() => {
            haptics.light()
            trackTutorial('skip', currentSlide)
            onComplete('skip')
          }}
          className="tap-highlight flex items-center gap-1 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 dark:border-stone-600 dark:text-stone-300"
        >
          {locale.tutorial.skip}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Slide content — fills remaining space, content centered */}
      <div className="flex items-center px-6" key={currentSlide} aria-live="polite">
        <div className="mx-auto w-full max-w-sm animate-view-enter">
          <div className="mb-2 flex justify-center">
            <SlideIcon type={slide.iconType} />
          </div>
          <h2 className="mb-1 text-center text-lg font-bold text-cf-ink dark:text-stone-100">{slide.title}</h2>
          <p className="mb-3 text-center text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            {slide.description}
          </p>
          <div className="mb-2">
            <SlideVisual type={slide.visualType} />
          </div>
          {slide.tip && <p className="text-center text-xs text-stone-500 dark:text-stone-500">💡 {slide.tip}</p>}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-6">
        <div className="mx-auto w-full max-w-sm">
          {/* Progress dots */}
          <div className="mb-4 flex justify-center gap-2">
            {SLIDE_DATA.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  haptics.light()
                  setCurrentSlide(i)
                }}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide ? 'w-6 bg-cf-accent' : 'w-2 bg-stone-300 dark:bg-stone-600'
                }`}
                aria-label={locale.tutorial.slideLabel(i + 1)}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              disabled={currentSlide === 0}
              className={`tap-highlight flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                currentSlide === 0
                  ? 'border-stone-200 text-stone-300 dark:border-stone-700 dark:text-stone-600'
                  : 'border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300'
              }`}
              aria-label={locale.tutorial.prevLabel}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goNext}
              className="tap-highlight flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-cf-accent text-base font-semibold text-white shadow-md"
            >
              {isLast ? locale.common.start : locale.common.next}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TUTORIAL_KEY = `${theme.storagePrefix}-tutorial-seen`

export function hasSeenTutorial(): boolean {
  return hasSeenFlag(TUTORIAL_KEY)
}

export function markTutorialSeen(): void {
  setSeenFlag(TUTORIAL_KEY)
}
