import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface MatrixDiagramProps {
  label?: string | undefined
  rowHeader?: string | undefined
  colHeader?: string | undefined
  rows: string[]
  cols: string[]
  cells: string[][]
}

/**
 * マトリクス図 — 2次元グリッドで Feature×条件 の関係を視覚表現
 * スコープ別の可用性、モード×機能の対応表、プラットフォーム互換性に最適。
 * cells[row][col] に "✓", "✗", テキストを配置。
 */
export function MatrixDiagram({ label, rowHeader, colHeader, rows, cols, cells }: MatrixDiagramProps) {
  if (rows.length === 0 || cols.length === 0) return null

  // Color cell based on content
  const getCellStyle = (value: string) => {
    const v = value.trim()
    if (v === '✓' || v === '○') return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
    if (v === '✗' || v === '×' || v === '−') return 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
    if (v === '△' || v === '?') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    return 'bg-stone-50/80 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
  }

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.matrix} itemCount={rows.length + 1} staggerMs={100}>
      {({ isVisible, getItemDelay }) => (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr
                className={isVisible ? 'animate-diagram-fade-up' : 'opacity-0'}
                style={{ animationDelay: getItemDelay(0) }}
              >
                {/* Top-left corner */}
                <th className="rounded-tl-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-left font-medium text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                  {rowHeader && colHeader ? `${rowHeader} ＼ ${colHeader}` : (rowHeader ?? colHeader ?? '')}
                </th>
                {cols.map((col, j) => (
                  <th
                    key={j}
                    className={`border border-stone-200 px-2 py-1.5 text-center font-semibold dark:border-stone-700 ${
                      j === 0
                        ? 'bg-claude-orange/10 text-claude-dark'
                        : 'bg-stone-50 text-claude-dark dark:bg-stone-800'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={isVisible ? 'animate-diagram-fade-up' : 'opacity-0'}
                  style={{ animationDelay: getItemDelay(i + 1) }}
                >
                  <th className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-left font-semibold text-claude-dark dark:border-stone-700 dark:bg-stone-800">
                    {row}
                  </th>
                  {cols.map((_, j) => {
                    const value = cells[i]?.[j] ?? ''
                    return (
                      <td
                        key={j}
                        className={`border border-stone-200 px-2 py-1.5 text-center font-medium dark:border-stone-700 ${getCellStyle(value)}`}
                      >
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BaseDiagram>
  )
}
