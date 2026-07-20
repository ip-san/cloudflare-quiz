import type { ReactNode } from 'react'

interface MenuItemProps {
  icon: ReactNode
  label: string
  sublabel?: string
  onClick: () => void
  disabled?: boolean
}

/**
 * ハンバーガーメニュー用の汎用メニューアイテム
 */
export function MenuItem({ icon, label, sublabel, onClick, disabled }: MenuItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`tap-highlight flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
        disabled ? 'cursor-not-allowed text-stone-300 dark:text-stone-600' : 'text-claude-dark dark:text-stone-200'
      }`}
    >
      <span className={disabled ? 'opacity-40' : 'text-stone-400'}>{icon}</span>
      <div className="flex-1">
        <span className="font-medium">{label}</span>
        {sublabel && <p className="text-xs text-stone-500">{sublabel}</p>}
      </div>
    </button>
  )
}
