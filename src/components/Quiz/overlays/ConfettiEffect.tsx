import { useEffect, useMemo, useState } from 'react'

const PARTICLE_COUNT = 24

interface Particle {
  x: number
  y: number
  angle: number
  speed: number
  size: number
  color: string
  delay: number
  shape: 'circle' | 'square' | 'diamond'
}

const COLORS = [
  '#F6821F', // cf-orange
  '#22c55e', // green
  '#3b82f6', // blue
  '#eab308', // yellow
  '#a855f7', // purple
  '#ec4899', // pink
]

/**
 * Premium confetti burst effect
 * Geometric particles radiate outward from center with gravity
 */
export function ConfettiEffect() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        x: 45 + Math.random() * 10,
        y: 35 + Math.random() * 10,
        angle: Math.random() * 360,
        speed: 80 + Math.random() * 120,
        size: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: 800 + Math.random() * 200, // Stagger after ScoreRing animation (800ms)
        shape: (['circle', 'square', 'diamond'] as const)[Math.floor(Math.random() * 3)],
      })),
    []
  )

  if (!show) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180
        const tx = Math.cos(rad) * p.speed
        const ty = Math.sin(rad) * p.speed - 40 // slight upward bias

        return (
          <div
            key={i}
            style={
              {
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'diamond' ? '2px' : '1px',
                transform: p.shape === 'diamond' ? 'rotate(45deg)' : undefined,
                opacity: 1,
                animation: `confetti-burst 800ms ease-out ${p.delay}ms forwards`,
                // CSS custom properties for the animation endpoint
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                '--rot': `${Math.random() * 720 - 360}deg`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
