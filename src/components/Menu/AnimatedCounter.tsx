import { useEffect, useState } from 'react'

interface AnimatedCounterProps {
  target: number
  duration?: number
  className?: string
  suffix?: string
}

/**
 * 数値のカウントアップアニメーション
 * メニュー画面の問題数表示などで使用
 */
export function AnimatedCounter({ target, duration = 600, className, suffix = '' }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return

    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (noMotion) {
      setCount(target)
      return
    }

    const steps = 20
    const interval = duration / steps
    let step = 0

    const timer = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCount(Math.round(target * eased))

      if (step >= steps) {
        clearInterval(timer)
        setCount(target)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [target, duration])

  return (
    <span className={className}>
      {count}
      {suffix}
    </span>
  )
}
