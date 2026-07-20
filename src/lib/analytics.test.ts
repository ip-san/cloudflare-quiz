import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorRateLimiter, isNoisyError, reportError } from './analytics'

describe('ErrorRateLimiter', () => {
  it('allows up to maxCount calls for the same key within the window', () => {
    const limiter = new ErrorRateLimiter(3, 10_000)
    const now = 1000

    expect(limiter.allow('err-a', now)).toBe(true)
    expect(limiter.allow('err-a', now + 1)).toBe(true)
    expect(limiter.allow('err-a', now + 2)).toBe(true)
    expect(limiter.allow('err-a', now + 3)).toBe(false)
    expect(limiter.allow('err-a', now + 4)).toBe(false)
  })

  it('tracks different keys independently', () => {
    const limiter = new ErrorRateLimiter(2, 10_000)
    const now = 1000

    expect(limiter.allow('err-a', now)).toBe(true)
    expect(limiter.allow('err-a', now + 1)).toBe(true)
    expect(limiter.allow('err-a', now + 2)).toBe(false)

    // Different key still allowed
    expect(limiter.allow('err-b', now + 3)).toBe(true)
    expect(limiter.allow('err-b', now + 4)).toBe(true)
    expect(limiter.allow('err-b', now + 5)).toBe(false)
  })

  it('resets after the time window expires', () => {
    const limiter = new ErrorRateLimiter(2, 1000)
    const now = 1000

    expect(limiter.allow('err-a', now)).toBe(true)
    expect(limiter.allow('err-a', now + 1)).toBe(true)
    expect(limiter.allow('err-a', now + 2)).toBe(false)

    // After window expires, allowed again
    expect(limiter.allow('err-a', now + 1001)).toBe(true)
    expect(limiter.allow('err-a', now + 1002)).toBe(true)
    expect(limiter.allow('err-a', now + 1003)).toBe(false)
  })

  it('uses default maxCount=5 and windowMs=60000', () => {
    const limiter = new ErrorRateLimiter()
    const now = 0

    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('err', now + i)).toBe(true)
    }
    expect(limiter.allow('err', now + 5)).toBe(false)

    // Resets after 60s
    expect(limiter.allow('err', now + 60_001)).toBe(true)
  })

  it('fires onFirstDrop callback once per key per window', () => {
    const drops: string[] = []
    const limiter = new ErrorRateLimiter(2, 1000, 200, (key) => drops.push(key))
    const now = 1000

    limiter.allow('err-a', now)
    limiter.allow('err-a', now)
    expect(drops).toEqual([])

    // First drop fires callback
    limiter.allow('err-a', now)
    expect(drops).toEqual(['err-a'])

    // Subsequent drops in same window do NOT fire again
    limiter.allow('err-a', now)
    limiter.allow('err-a', now)
    expect(drops).toEqual(['err-a'])

    // After window expires and re-fills, can fire again
    limiter.allow('err-a', now + 1001) // refill
    limiter.allow('err-a', now + 1001) // 2nd
    limiter.allow('err-a', now + 1001) // drop → fires
    expect(drops).toEqual(['err-a', 'err-a'])
  })

  it('garbage-collects expired entries when maxKeys is reached', () => {
    const limiter = new ErrorRateLimiter(5, 1000, 3) // maxKeys=3
    const now = 1000

    limiter.allow('err-a', now)
    limiter.allow('err-b', now)
    limiter.allow('err-c', now)
    // Map is now at maxKeys=3

    // Fast-forward past window — entries are expired but still in Map
    const later = now + 1500

    // Adding a new key triggers GC of expired entries
    limiter.allow('err-d', later)

    // err-a/b/c were expired and GC'd; err-d remains
    // Verify: err-a should be treated as new (allowed), not blocked
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('err-a', later + i)).toBe(true)
    }
    expect(limiter.allow('err-a', later + 5)).toBe(false)
  })
})

describe('isNoisyError', () => {
  it('matches Vite HMR WebSocket disconnect noise', () => {
    expect(isNoisyError('Error: send was called before connect')).toBe(true)
    expect(isNoisyError('send was called before connect')).toBe(true)
  })

  it('matches SharedWorker construction failures', () => {
    expect(
      isNoisyError(
        "SecurityError: Failed to construct 'SharedWorker': Access to the script at 'blob:http://localhost:5173/...' is denied."
      )
    ).toBe(true)
  })

  it('does not match actionable app errors', () => {
    expect(isNoisyError('TypeError: Cannot read properties of undefined')).toBe(false)
    expect(isNoisyError('Failed to save progress: QuotaExceededError')).toBe(false)
    expect(isNoisyError('')).toBe(false)
  })
})

describe('reportError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
  })

  it('logs Error instance with context label and uses .message', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn())
    const err = new Error('disk full')
    reportError(err, 'test_source', 'Save failed')

    expect(consoleErrorSpy).toHaveBeenCalledWith('Save failed:', err)
  })

  it('logs without label when contextLabel is omitted', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn())
    const err = new Error('boom')
    reportError(err, 'test_source')

    expect(consoleErrorSpy).toHaveBeenCalledWith(err)
  })

  it('coerces non-Error values via String()', () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn())
    reportError('string error', 'test_source', 'Got string')
    reportError(42, 'test_source', 'Got number')
    reportError({ kind: 'oops' }, 'test_source', 'Got object')

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3)
    // No throw — coverage of the String(error) fallback path
  })
})

describe('setUserProperties', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    delete window.dataLayer
  })

  it('sends platform as a top-level event param in addition to user_properties (gtm/events.json spec)', async () => {
    vi.stubEnv('VITE_GTM_ID', 'GTM-TEST')
    vi.resetModules()
    const { setUserProperties } = await import('./analytics')

    window.dataLayer = []
    setUserProperties({ mastery_level: 'bronze' })

    const pushed = window.dataLayer.find((e) => e.event === 'set_user_properties')
    expect(pushed).toBeDefined()
    if (!pushed) throw new Error('set_user_properties event not found')
    // GTM タグはトップレベルの dataLayer 変数 platform を参照するため、
    // user_properties 内だけでは初回訪問時にイベントパラメータが空になる
    expect(pushed.platform).toBe('pwa')
    const userProperties = pushed.user_properties as Record<string, unknown>
    expect(userProperties.platform).toBe(pushed.platform)
    expect(userProperties.mastery_level).toBe('bronze')
  })
})
