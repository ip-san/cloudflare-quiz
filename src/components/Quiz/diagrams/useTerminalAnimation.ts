import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

interface TerminalLine {
  type: 'command' | 'prompt' | 'response' | 'info'
  text: string
}

interface LineState {
  /** Whether this line is visible at all */
  visible: boolean
  /** For typing lines: number of characters revealed (null = show all) */
  typingChars: number | null
  /** Whether this line just finished revealing (for fade-in CSS) */
  justRevealed: boolean
}

const TIMING = {
  CHAR_INTERVAL_MS: 40,
  PAUSE_AFTER_TYPING_MS: 300,
  PAUSE_AFTER_OUTPUT_MS: 80,
  INITIAL_DELAY_MS: 200,
} as const

function isTypingLine(type: TerminalLine['type']): boolean {
  return type === 'command' || type === 'prompt'
}

type Phase = 'idle' | 'initial-delay' | 'typing' | 'pause' | 'revealing' | 'done'

interface AnimState {
  phase: Phase
  lineIndex: number
  charIndex: number
}

export function useTerminalAnimation(lines: TerminalLine[], isVisible: boolean) {
  const prefersReducedMotion = usePrefersReducedMotion()

  const [animState, setAnimState] = useState<AnimState>({ phase: 'idle', lineIndex: 0, charIndex: 0 })
  const [isComplete, setIsComplete] = useState(prefersReducedMotion)
  const [isPlaying, setIsPlaying] = useState(false)

  const rafRef = useRef<number>(0)
  const lastTickRef = useRef(0)
  const accumulatorRef = useRef(0)
  const stateRef = useRef<AnimState>({ phase: 'idle', lineIndex: 0, charIndex: 0 })

  // Tracks a user-initiated replay so the animation runs even when the OS
  // has `prefers-reduced-motion: reduce` enabled. Auto-play still honours
  // the system preference; only an explicit button click overrides it.
  const forceReplayRef = useRef(false)

  const startAnimation = useCallback(
    (options: { force?: boolean } = {}) => {
      if (lines.length === 0) {
        setIsComplete(true)
        setIsPlaying(false)
        return
      }
      if (prefersReducedMotion && !options.force) {
        setIsComplete(true)
        setIsPlaying(false)
        return
      }
      forceReplayRef.current = options.force === true
      const initial: AnimState = { phase: 'initial-delay', lineIndex: 0, charIndex: 0 }
      stateRef.current = initial
      setAnimState(initial)
      setIsComplete(false)
      setIsPlaying(true)
      lastTickRef.current = 0
      accumulatorRef.current = 0
    },
    [lines.length, prefersReducedMotion]
  )

  // Auto-play on first visibility
  const hasAutoPlayed = useRef(false)
  useEffect(() => {
    if (isVisible && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true
      startAnimation()
    }
  }, [isVisible, startAnimation])

  // rAF loop
  useEffect(() => {
    if (!isPlaying) return

    const tick = (timestamp: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = timestamp
      const delta = timestamp - lastTickRef.current
      lastTickRef.current = timestamp
      accumulatorRef.current += delta

      const s = stateRef.current
      let updated = false

      // Process accumulated time
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (s.phase === 'initial-delay') {
          if (accumulatorRef.current >= TIMING.INITIAL_DELAY_MS) {
            accumulatorRef.current -= TIMING.INITIAL_DELAY_MS
            const line = lines[s.lineIndex]
            if (line && isTypingLine(line.type)) {
              s.phase = 'typing'
              s.charIndex = 0
            } else {
              s.phase = 'revealing'
            }
            updated = true
            continue
          }
          break
        }

        if (s.phase === 'typing') {
          const line = lines[s.lineIndex]
          if (!line) {
            s.phase = 'done'
            updated = true
            break
          }
          if (accumulatorRef.current >= TIMING.CHAR_INTERVAL_MS) {
            accumulatorRef.current -= TIMING.CHAR_INTERVAL_MS
            s.charIndex++
            updated = true
            if (s.charIndex >= line.text.length) {
              s.phase = 'pause'
              continue
            }
          }
          break
        }

        if (s.phase === 'revealing') {
          // Response/info lines appear instantly, just pause briefly
          s.phase = 'pause'
          updated = true
          continue
        }

        if (s.phase === 'pause') {
          const currentLine = lines[s.lineIndex]
          const pauseMs =
            currentLine && isTypingLine(currentLine.type) ? TIMING.PAUSE_AFTER_TYPING_MS : TIMING.PAUSE_AFTER_OUTPUT_MS
          if (accumulatorRef.current >= pauseMs) {
            accumulatorRef.current -= pauseMs
            s.lineIndex++
            if (s.lineIndex >= lines.length) {
              s.phase = 'done'
              updated = true
              break
            }
            const nextLine = lines[s.lineIndex]
            if (nextLine && isTypingLine(nextLine.type)) {
              s.phase = 'typing'
              s.charIndex = 0
            } else {
              s.phase = 'revealing'
            }
            updated = true
            continue
          }
          break
        }

        if (s.phase === 'done') {
          break
        }

        // idle or unknown
        break
      }

      if (s.phase === 'done') {
        setAnimState({ ...s })
        setIsComplete(true)
        setIsPlaying(false)
        return
      }

      if (updated) {
        setAnimState({ ...s })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, lines])

  const skipAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const done: AnimState = { phase: 'done', lineIndex: lines.length, charIndex: 0 }
    stateRef.current = done
    setAnimState(done)
    setIsComplete(true)
    setIsPlaying(false)
  }, [lines.length])

  const replayAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    // Explicit user intent — override `prefers-reduced-motion` so the replay button
    // actually does something on devices (e.g. iOS with "Reduce Motion" turned on).
    startAnimation({ force: true })
  }, [startAnimation])

  const getLineState = useCallback(
    (index: number): LineState => {
      // `prefersReducedMotion` short-circuits display to static — but not during a
      // user-initiated replay (forceReplayRef), otherwise the replay button would
      // be visually inert on reduced-motion devices.
      const reducedAndIdle = prefersReducedMotion && !forceReplayRef.current
      if (reducedAndIdle || isComplete) {
        return { visible: true, typingChars: null, justRevealed: false }
      }

      if (index > animState.lineIndex) {
        return { visible: false, typingChars: null, justRevealed: false }
      }

      if (index < animState.lineIndex) {
        return { visible: true, typingChars: null, justRevealed: false }
      }

      // Current line
      const line = lines[index]
      if (!line) return { visible: false, typingChars: null, justRevealed: false }

      if (animState.phase === 'typing' && isTypingLine(line.type)) {
        return { visible: true, typingChars: animState.charIndex, justRevealed: false }
      }

      if (animState.phase === 'revealing' || animState.phase === 'pause') {
        if (isTypingLine(line.type)) {
          return { visible: true, typingChars: null, justRevealed: false }
        }
        return { visible: true, typingChars: null, justRevealed: true }
      }

      return { visible: true, typingChars: null, justRevealed: false }
    },
    [animState, isComplete, lines, prefersReducedMotion]
  )

  return { getLineState, isComplete, isPlaying, skipAnimation, replayAnimation }
}
