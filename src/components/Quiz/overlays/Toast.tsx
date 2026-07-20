import type { CSSProperties, ReactNode } from 'react'
import { toastContainerProps, useToastPhase } from './useToastPhase'

interface ToastProps {
  phase: ReturnType<typeof useToastPhase>['phase']
  style: ReturnType<typeof useToastPhase>['style']
  icon: ReactNode
  message: string
  gradient: string
  /** 垂直オフセット（複数トーストの位置分け用） */
  offsetY?: string
}

/**
 * 汎用トーストコンポーネント
 * アイコン・メッセージ��グラデーションを受け取り表示する。
 * フェーズ管理は呼び出し側が useToastPhase で行う��
 */
export function Toast({ phase, style, icon, message, gradient, offsetY }: ToastProps) {
  if (phase === 'hidden') return null

  const containerStyle: CSSProperties | undefined = offsetY
    ? { top: `calc(${offsetY} + env(safe-area-inset-top, 0px))` }
    : undefined

  return (
    <div {...toastContainerProps} style={containerStyle ?? toastContainerProps.style}>
      <div className={`rounded-full bg-linear-to-r ${gradient} px-5 py-2.5 shadow-lg`} style={style}>
        <div className="flex items-center gap-2 text-white">
          {icon}
          <span className="text-sm font-bold">{message}</span>
        </div>
      </div>
    </div>
  )
}
