import { Check, Clipboard, Play, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { platformAPI } from '@/lib/platformAPI'
import { BaseDiagram } from './BaseDiagram'
import { useTerminalAnimation } from './useTerminalAnimation'

interface TerminalLine {
  type: 'command' | 'prompt' | 'response' | 'info'
  text: string
}

interface TerminalDiagramProps {
  label?: string | undefined
  lines: TerminalLine[]
}

function formatLinesForCopy(lines: TerminalLine[]): string {
  return lines
    .filter((l) => l.type === 'command' || l.type === 'prompt')
    .map((l) => l.text)
    .join('\n')
}

/**
 * Shared className for the skip / replay / copy buttons in the title bar.
 * Mobile reserves a 32×32px tap target (≥ WCAG 2.5.8 / Apple HIG);
 * desktop (≥ sm) collapses back to the compact look so the title bar
 * stays visually tight when text labels are visible.
 */
const TITLEBAR_BTN =
  'flex shrink-0 items-center justify-center gap-1 rounded-sm min-h-8 min-w-8 px-1.5 py-0.5 text-[10px] text-stone-400 transition-colors hover:bg-stone-700 hover:text-stone-200 sm:min-h-0 sm:min-w-0 sm:justify-start'

/** Inner component so that useTerminalAnimation can be called as a top-level hook */
function TerminalBody({ lines, isVisible }: { lines: TerminalLine[]; isVisible: boolean }) {
  const [copied, setCopied] = useState(false)
  const { getLineState, isComplete, isPlaying, skipAnimation, replayAnimation } = useTerminalAnimation(lines, isVisible)

  return (
    /* Terminal window */
    <div className="overflow-hidden rounded-lg border border-stone-700 bg-stone-900 shadow-lg" aria-hidden="true">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-stone-700 bg-stone-800 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 min-w-0 flex-1 truncate text-[10px] text-stone-400">{theme.subject}</span>
        {/* Skip / Replay button */}
        {isPlaying && (
          <button
            type="button"
            onClick={skipAnimation}
            className={TITLEBAR_BTN}
            aria-label={locale.diagrams.terminalSkip}
          >
            <SkipForward className="h-3 w-3" />
            <span className="hidden sm:inline">{locale.diagrams.terminalSkip}</span>
          </button>
        )}
        {isComplete && (
          <>
            <button
              type="button"
              onClick={replayAnimation}
              className={TITLEBAR_BTN}
              aria-label={locale.diagrams.terminalReplay}
            >
              <Play className="h-3 w-3" />
              <span className="hidden sm:inline">{locale.diagrams.terminalReplay}</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const text = formatLinesForCopy(lines)
                if (!text) return
                const ok = await platformAPI.copyToClipboard(text)
                if (ok) {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }
              }}
              className={TITLEBAR_BTN}
              aria-label={locale.diagrams.terminalCopy}
            >
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Clipboard className="h-3 w-3" />}
              <span className="hidden sm:inline">{locale.diagrams.terminalCopy}</span>
            </button>
          </>
        )}
      </div>
      {/* Terminal body */}
      <div className="space-y-0.5 px-3 py-2.5 font-mono text-[13px] leading-relaxed">
        {lines.map((line, i) => {
          const state = getLineState(i)
          if (!state.visible) return <div key={i} className="h-5" />

          const revealClass = state.justRevealed ? 'animate-terminal-reveal' : ''

          return (
            <div key={i} className={revealClass}>
              {line.type === 'command' && (
                <p className="text-stone-300">
                  <span className="text-green-400">$</span>{' '}
                  <span>{state.typingChars !== null ? line.text.slice(0, state.typingChars) : line.text}</span>
                  {state.typingChars !== null && (
                    <span className="ml-px animate-terminal-cursor text-stone-400">▋</span>
                  )}
                </p>
              )}
              {line.type === 'prompt' && (
                <div className="-mx-3 border-y border-claude-orange/40 bg-claude-orange/5 px-3 py-1">
                  <p>
                    <span className="text-claude-orange">&gt;</span>{' '}
                    <span className="text-white">
                      {state.typingChars !== null ? line.text.slice(0, state.typingChars) : line.text}
                    </span>
                    {state.typingChars !== null && (
                      <span className="ml-px animate-terminal-cursor text-stone-400">▋</span>
                    )}
                  </p>
                </div>
              )}
              {line.type === 'response' && (
                <p>
                  <span className="text-claude-orange">✦</span> <span className="text-stone-300">{line.text}</span>
                </p>
              )}
              {line.type === 'info' && <p className="text-stone-500">{line.text}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Claude Code 風ターミナル図（タイピングアニメーション付き）
 *
 * 初回表示時に自動再生。完了後はリプレイボタンで再実行可能。
 *
 * line types:
 * - command: シェルコマンド（$ prefix）— タイプライター効果
 * - prompt: ユーザー入力（> prefix）— タイプライター効果
 * - response: Claude の応答（✦ prefix）— フェードイン
 * - info: 補足テキスト（dim）— フェードイン
 */
export function TerminalDiagram({ label, lines }: TerminalDiagramProps) {
  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.terminal} itemCount={lines.length} staggerMs={80}>
      {({ isVisible }) => (
        <>
          {/* Screen reader: full text always available */}
          <div className="sr-only">
            {lines.map((line, i) => (
              <p key={i}>
                {line.type === 'command' && `$ ${line.text}`}
                {line.type === 'prompt' && `> ${line.text}`}
                {line.type === 'response' && `✦ ${line.text}`}
                {line.type === 'info' && line.text}
              </p>
            ))}
          </div>
          <TerminalBody lines={lines} isVisible={isVisible} />
        </>
      )}
    </BaseDiagram>
  )
}
