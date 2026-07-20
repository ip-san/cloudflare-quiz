import { useEffect, useMemo, useState } from 'react'

interface ScoreRingProps {
  percentage: number
  score: number
  total: number
  color: string
  noMotion?: boolean
}

/**
 * 円形スコア表示リング
 * SVGのstroke-dashoffsetアニメーションで充填
 */
export function ScoreRing({ percentage, score, total, color, noMotion }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(noMotion ? score : 0)
  const [animatedPercent, setAnimatedPercent] = useState(noMotion ? percentage : 0)

  const size = 140
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const colorMap: Record<string, string> = {
    'text-yellow-600': '#ca8a04',
    'text-green-600': '#16a34a',
    'text-blue-600': '#2563eb',
    'text-orange-600': '#ea580c',
    'text-red-600': '#dc2626',
  }
  const strokeColor = colorMap[color] ?? '#F6821F'

  // Animate on mount
  useEffect(() => {
    if (noMotion) return
    const duration = 800
    const steps = 30
    const interval = duration / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(score * eased))
      setAnimatedPercent(Math.round(percentage * eased))
      if (step >= steps) {
        clearInterval(timer)
        setDisplayScore(score)
        setAnimatedPercent(percentage)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [score, percentage, noMotion])

  const offset = useMemo(
    () => circumference - (Math.min(100, Math.max(0, animatedPercent)) / 100) * circumference,
    [circumference, animatedPercent]
  )

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: noMotion ? 'none' : 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-claude-dark">{displayScore}</span>
        <span className="text-sm text-stone-500">/ {total}</span>
      </div>
    </div>
  )
}
