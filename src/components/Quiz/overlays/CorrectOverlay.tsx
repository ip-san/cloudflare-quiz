import { useEffect, useState } from 'react'

/**
 * 正解時に画面中央に筆跡風のチェックマークを描画するオーバーレイ
 * 緑の太い筆ストロークが描かれるように現れ、フェードアウトする
 */
export function CorrectOverlay() {
  const [phase, setPhase] = useState<'draw' | 'hold' | 'exit' | 'done'>('draw')

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 400)
    const exitTimer = setTimeout(() => setPhase('exit'), 700)
    const doneTimer = setTimeout(() => setPhase('done'), 1000)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        phase === 'exit' ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Subtle backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${phase === 'exit' ? 'opacity-0' : 'opacity-100'}`}
        style={{ backgroundColor: 'rgba(34, 197, 94, 0.06)' }}
      />

      {/* Brush stroke check mark */}
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        fill="none"
        className={`relative ${phase === 'exit' ? 'scale-125' : 'scale-100'} transition-transform duration-500`}
      >
        {/* Outer glow */}
        <path
          d="M30 82 L62 114 L130 42"
          stroke="rgba(34, 197, 94, 0.15)"
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="brush-check-glow"
        />
        {/* Main brush stroke — thick green */}
        <path
          d="M30 82 L62 114 L130 42"
          stroke="#22c55e"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="brush-check-stroke"
        />
        {/* Highlight — white shine for brush texture */}
        <path
          d="M33 80 L62 110 L127 45"
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="brush-check-highlight"
        />
      </svg>
    </div>
  )
}
