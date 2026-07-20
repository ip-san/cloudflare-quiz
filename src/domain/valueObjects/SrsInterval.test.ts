/**
 * SrsInterval unit tests — SRS interval calculation boundary cases
 */
import { describe, expect, it } from 'vitest'
import { calculateNextReview, SRS_INTERVALS_MS } from './SrsInterval'

describe('SrsInterval', () => {
  const NOW = 1700000000000

  it('streak 0 → 1 hour interval', () => {
    expect(calculateNextReview(0, NOW)).toBe(NOW + 3600000)
  })

  it('streak 1 → 4 hour interval', () => {
    expect(calculateNextReview(1, NOW)).toBe(NOW + 14400000)
  })

  it('streak 8 → 90 day interval (max)', () => {
    expect(calculateNextReview(8, NOW)).toBe(NOW + 7776000000)
  })

  it('streak beyond table length clamps to last interval', () => {
    const beyondMax = SRS_INTERVALS_MS.length + 5
    expect(calculateNextReview(beyondMax, NOW)).toBe(NOW + SRS_INTERVALS_MS[SRS_INTERVALS_MS.length - 1])
  })

  it('intervals are strictly increasing', () => {
    for (let i = 1; i < SRS_INTERVALS_MS.length; i++) {
      expect(SRS_INTERVALS_MS[i]).toBeGreaterThan(SRS_INTERVALS_MS[i - 1])
    }
  })

  it('table has expected number of entries', () => {
    expect(SRS_INTERVALS_MS.length).toBe(9)
  })
})
