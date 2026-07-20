import { FileCode2 } from 'lucide-react'
import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface ConfigLine {
  text: string
  highlight?: boolean | undefined
}

interface ConfigDiagramProps {
  label?: string | undefined
  filepath: string
  lines: ConfigLine[]
}

/**
 * 設定ファイル図 — エディタ風にコードスニペットを表示
 * filepath でファイル名、lines で内容、highlight で注目行を強調。
 */
export function ConfigDiagram({ label, filepath, lines }: ConfigDiagramProps) {
  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.config} itemCount={lines.length} staggerMs={60}>
      {({ isVisible, getItemDelay }) => (
        /* Editor window */
        <div className="overflow-hidden rounded-lg border border-stone-300 bg-stone-50/80 shadow-xs dark:border-stone-600 dark:bg-stone-800">
          {/* Tab bar */}
          <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-100 px-3 py-1.5 dark:border-stone-600 dark:bg-stone-700">
            <FileCode2 className="h-3 w-3 text-stone-400" />
            <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300">{filepath}</span>
          </div>
          {/* Code body */}
          <div className="px-1 py-2 font-mono text-[13px] leading-relaxed">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`flex ${isVisible ? 'animate-diagram-slide-right' : 'opacity-0'} ${
                  line.highlight ? 'bg-amber-100/70 dark:bg-amber-700/20' : ''
                }`}
                style={{ animationDelay: getItemDelay(i) }}
              >
                {/* Line number */}
                <span className="inline-block w-7 shrink-0 select-none text-right text-stone-400 dark:text-stone-500">
                  {i + 1}
                </span>
                {/* Content */}
                <pre
                  className={`flex-1 whitespace-pre-wrap break-all pl-2 ${
                    line.highlight ? 'text-stone-800 dark:text-stone-100' : 'text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {line.text}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseDiagram>
  )
}
