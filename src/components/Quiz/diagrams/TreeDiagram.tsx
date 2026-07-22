import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface TreeNode {
  text: string
  sub?: string | undefined
  children?: TreeNode[] | undefined
}

interface TreeDiagramProps {
  label?: string | undefined
  root: TreeNode
}

/** Count total visible nodes for animation */
function countNodes(node: TreeNode): number {
  return 1 + (node.children?.reduce((sum, c) => sum + countNodes(c), 0) ?? 0)
}

/**
 * ツリー図 — ディレクトリ構造・ファイルツリーを視覚表現
 * .claude/ 構成、プロジェクト構造、判定ツリーに最適。
 * インデントと罫線でネスト関係を表示。
 */
export function TreeDiagram({ label, root }: TreeDiagramProps) {
  const total = countNodes(root)

  return (
    <BaseDiagram
      label={label}
      defaultLabel={locale.diagrams.tree}
      itemCount={total}
      staggerMs={80}
      initialDelayMs={150}
    >
      {({ isVisible, getItemDelay }) => {
        let nodeIndex = 0

        const renderNode = (node: TreeNode, depth: number, isLast: boolean, prefix: string): React.JSX.Element => {
          const currentIndex = nodeIndex++
          const connector = depth === 0 ? '' : isLast ? '└─ ' : '├─ '
          const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ')

          const isDir = (node.children?.length ?? 0) > 0
          // Colors by depth
          const textColor =
            depth === 0
              ? 'text-cf-accent'
              : isDir
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-stone-700 dark:text-stone-300'

          return (
            <div key={currentIndex}>
              <div
                className={`flex items-baseline gap-0 font-mono leading-relaxed ${isVisible ? 'animate-diagram-slide-right' : 'opacity-0'}`}
                style={{ animationDelay: getItemDelay(currentIndex) }}
              >
                {/* Prefix lines (│ characters) */}
                {depth > 0 && (
                  <span className="whitespace-pre text-[11px] text-stone-400 dark:text-stone-600">
                    {prefix}
                    {connector}
                  </span>
                )}
                {/* Icon */}
                <span className="mr-1 text-[11px]" aria-hidden="true">
                  {depth === 0 ? '📁' : isDir ? '📂' : '📄'}
                </span>
                {/* Node text */}
                <span className={`text-[11px] font-semibold ${textColor}`}>{node.text}</span>
                {node.sub && <span className="ml-1.5 text-[10px] text-stone-500 dark:text-stone-500">{node.sub}</span>}
              </div>
              {/* Children */}
              {node.children?.map((child, i) =>
                renderNode(child, depth + 1, i === (node.children?.length ?? 0) - 1, childPrefix)
              )}
            </div>
          )
        }

        return (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50">
            {renderNode(root, 0, true, '')}
          </div>
        )
      }}
    </BaseDiagram>
  )
}
