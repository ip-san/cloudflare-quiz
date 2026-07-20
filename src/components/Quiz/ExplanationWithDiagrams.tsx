import type { DiagramData } from '@/domain/valueObjects/Diagram'
import { DiagramRenderer } from './diagrams/DiagramRenderer'
import { QuizText } from './QuizText'

interface ExplanationWithDiagramsProps {
  explanation: string
  diagrams: readonly DiagramData[]
  animated?: boolean | undefined
  animationDelay?: number | undefined
}

const DIAGRAM_MARKER = /\{\{diagram:(\d+)\}\}/g

/**
 * 解説テキストとダイアグラムを統合表示。
 *
 * explanation 中の `{{diagram:N}}` マーカーを diagrams[N] に置換。
 * マーカーがない場合は従来通りテキスト → 末尾にダイアグラム一括表示。
 */
export function ExplanationWithDiagrams({
  explanation,
  diagrams,
  animated,
  animationDelay = 0,
}: ExplanationWithDiagramsProps) {
  const hasMarkers = DIAGRAM_MARKER.test(explanation)

  if (!hasMarkers) {
    return (
      <div>
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          <QuizText text={explanation} animated={animated} animationDelay={animationDelay} />
        </p>
        {diagrams.length > 0 && (
          <div className="mt-3 rounded-xl bg-stone-50/70 p-3 dark:bg-stone-900/40">
            <DiagramRenderer diagrams={diagrams} />
          </div>
        )}
      </div>
    )
  }

  // Split by markers, interleave text and diagrams
  const segments: Array<{ type: 'text'; value: string } | { type: 'diagram'; index: number }> = []
  let lastIndex = 0
  // Reset lastIndex since .test() advanced it
  DIAGRAM_MARKER.lastIndex = 0
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop pattern
  while ((match = DIAGRAM_MARKER.exec(explanation)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: explanation.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'diagram', index: Number(match[1]) })
    lastIndex = DIAGRAM_MARKER.lastIndex
  }
  if (lastIndex < explanation.length) {
    segments.push({ type: 'text', value: explanation.slice(lastIndex) })
  }

  // Collect diagram indices used by markers
  const usedIndices = new Set(segments.filter((s) => s.type === 'diagram').map((s) => s.index))

  // Remaining diagrams not referenced by markers
  const remainingDiagrams = diagrams.filter((_, i) => !usedIndices.has(i))

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          const trimmed = seg.value.trim()
          if (!trimmed) return null
          return (
            <p key={i} className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              <QuizText text={trimmed} animated={animated} animationDelay={animationDelay} />
            </p>
          )
        }
        const diagram = diagrams[seg.index]
        if (!diagram) return null
        return (
          <div key={i} className="rounded-xl bg-stone-50/70 p-3 dark:bg-stone-900/40">
            <DiagramRenderer diagrams={[diagram]} />
          </div>
        )
      })}
      {remainingDiagrams.length > 0 && (
        <div className="rounded-xl bg-stone-50/70 p-3 dark:bg-stone-900/40">
          <DiagramRenderer diagrams={remainingDiagrams} />
        </div>
      )}
    </div>
  )
}
