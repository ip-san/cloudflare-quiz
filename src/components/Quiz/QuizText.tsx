import { Fragment, type ReactNode } from 'react'
import { GLOSSARY, indexOfTerm } from '../../domain/valueObjects/Glossary'
import { GlossaryTerm } from './GlossaryTerm'

interface QuizTextProps {
  text: string
  className?: string | undefined
  /** Enable code highlight animation in explanation */
  animated?: boolean | undefined
  /** Base delay in ms for code highlight stagger */
  animationDelay?: number | undefined
  /**
   * 用語集のマークアップを付けるか。既定は付ける。
   *
   * **選択肢の中では必ず false にすること。** 選択肢自体が `<button>` なので、
   * その中に用語のボタンを置くと、用語をタップした時点でその選択肢が
   * 選ばれてしまう（2026-08-30 に実機で確認した）。
   * 入れ子の対話要素はアクセシビリティ上も不正。
   */
  glossary?: boolean | undefined
}

/**
 * Renders quiz text with:
 * - \n → line breaks
 * - `code` → <code> inline code elements (optionally animated)
 * - a line starting with 「※」 → rendered as a muted, smaller note
 * - a glossary term → tappable, shows a short description in place
 *
 * The note styling exists because glosses were being skimmed past. On
 * 2026-08-29 a beginner playtester reported that the term glosses appended to
 * ac-008's question "look exactly like the question text, so I braced myself
 * thinking they were more conditions I had to remember". The gloss had in fact
 * been added *because* an earlier tester missed the term — so the content fix
 * was being defeated by the rendering. A note has to look like a note.
 */
export function QuizText({ text, className, animated, animationDelay = 0, glossary = true }: QuizTextProps) {
  return <span className={className}>{parseQuizText(text, animated, animationDelay, glossary)}</span>
}

/** 行頭の「※」は注記の合図 */
const NOTE_LINE = /^\s*※/

function parseQuizText(text: string, animated?: boolean, baseDelay?: number, glossary = true): ReactNode[] {
  const lines = text.split('\n')
  const result: ReactNode[] = []
  let codeIndex = 0

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      result.push(<br key={`br-${i}`} />)
    }
    const { nodes, codeCount } = parseInlineCode(lines[i], animated, baseDelay, codeIndex, glossary)
    // 「※」で始まる行は注記。本文と同じ見た目だと注記だと分からず読み飛ばされる
    if (NOTE_LINE.test(lines[i])) {
      result.push(
        <span key={`line-${i}`} className="text-[0.9em] text-stone-500 dark:text-stone-400">
          {nodes}
        </span>
      )
    } else {
      result.push(<Fragment key={`line-${i}`}>{nodes}</Fragment>)
    }
    codeIndex += codeCount
  }

  return result
}

/**
 * 地の文から用語を見つけて、説明を開ける形にする。
 *
 * **同じ語は1つの本文につき最初の1回だけ**マークする。
 * 全部の出現に下線が付くと、本文が下線だらけで読みにくくなる。
 */
function markGlossaryTerms(text: string, used: Set<string>, keyBase: number): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let guard = 0
  while (rest.length > 0 && guard++ < 100) {
    // 長い語から順に見て、いちばん手前に現れるものを採る
    let best: { index: number; entry: (typeof GLOSSARY)[number] } | null = null
    for (const entry of GLOSSARY) {
      if (used.has(entry.term)) continue
      const i = indexOfTerm(rest, entry.term)
      if (i === -1) continue
      if (!best || i < best.index) best = { index: i, entry }
    }
    if (!best) break
    if (best.index > 0) out.push(rest.slice(0, best.index))
    out.push(<GlossaryTerm key={`gt-${keyBase}-${guard}`} entry={best.entry} />)
    used.add(best.entry.term)
    rest = rest.slice(best.index + best.entry.term.length)
  }
  if (rest.length > 0) out.push(rest)
  return out
}

function parseInlineCode(
  text: string,
  animated?: boolean,
  baseDelay?: number,
  startCodeIndex?: number,
  glossary = true
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

  // 用語のマークアップは**コード片を除いた地の文にだけ**当てる。
  // parts のうち文字列のものが地の文で、`code` は既に ReactNode になっている
  if (!glossary) return { nodes: parts, codeCount }

  const marked: ReactNode[] = []
  const usedInThisText = new Set<string>()
  for (const part of parts) {
    if (typeof part !== 'string') {
      marked.push(part)
      continue
    }
    marked.push(...markGlossaryTerms(part, usedInThisText, marked.length))
  }

  return { nodes: marked, codeCount }
}
