import { Fragment, type ReactNode } from 'react'

interface QuizTextProps {
  text: string
  className?: string | undefined
  /** Enable code highlight animation in explanation */
  animated?: boolean | undefined
  /** Base delay in ms for code highlight stagger */
  animationDelay?: number | undefined
}

/**
 * Renders quiz text with:
 * - \n → line breaks
 * - `code` → <code> inline code elements (optionally animated)
 */
export function QuizText({ text, className, animated, animationDelay = 0 }: QuizTextProps) {
  return <span className={className}>{parseQuizText(text, animated, animationDelay)}</span>
}

function parseQuizText(text: string, animated?: boolean, baseDelay?: number): ReactNode[] {
  const lines = text.split('\n')
  const result: ReactNode[] = []
  let codeIndex = 0

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      result.push(<br key={`br-${i}`} />)
    }
    const { nodes, codeCount } = parseInlineCode(lines[i], animated, baseDelay, codeIndex)
    result.push(<Fragment key={`line-${i}`}>{nodes}</Fragment>)
    codeIndex += codeCount
  }

  return result
}

function parseInlineCode(
  text: string,
  animated?: boolean,
  baseDelay?: number,
  startCodeIndex?: number
): { nodes: ReactNode[]; codeCount: number } {
  const parts: ReactNode[] = []
  const regex = /`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let codeCount = 0

  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop pattern
  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    // Code element with optional highlight animation
    // Cap stagger at 100ms to keep total animation under 1.5s even with many codes
    const idx = (startCodeIndex ?? 0) + codeCount
    const delay = (baseDelay ?? 0) + idx * 100
    parts.push(
      <code
        key={match.index}
        className={`rounded px-1 py-0.5 font-mono text-[0.9em] text-stone-800 dark:text-stone-200 ${
          animated
            ? 'animate-code-highlight bg-linear-to-r from-amber-200/70 to-amber-100/50 bg-no-repeat bg-left dark:from-amber-700/40 dark:to-amber-600/30'
            : 'bg-stone-100 dark:bg-stone-700'
        }`}
        style={animated ? { animationDelay: `${delay}ms` } : undefined}
      >
        {match[1]}
      </code>
    )
    codeCount++
    lastIndex = regex.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return { nodes: parts, codeCount }
}
