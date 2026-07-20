import { describe, expect, it } from 'vitest'

import { isNewerVersion } from './isNewerVersion'

describe('isNewerVersion', () => {
  describe('major version bumps', () => {
    it('returns true when latest major is greater', () => {
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true)
    })

    it('returns false when latest major is less', () => {
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false)
    })
  })

  describe('minor version bumps', () => {
    it('returns true when latest minor is greater', () => {
      expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true)
    })

    it('returns false when latest minor is less', () => {
      expect(isNewerVersion('1.0.0', '1.1.0')).toBe(false)
    })
  })

  describe('patch version bumps', () => {
    it('returns true when latest patch is greater', () => {
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true)
    })

    it('returns false when latest patch is less', () => {
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false)
    })
  })

  describe('equal versions', () => {
    it('returns false when versions are identical', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    })

    it('returns false when minor and patch are both equal', () => {
      expect(isNewerVersion('2.3.4', '2.3.4')).toBe(false)
    })
  })

  describe('v prefix handling', () => {
    it('returns true when both have v prefix and latest is newer', () => {
      expect(isNewerVersion('v2.0.0', 'v1.0.0')).toBe(true)
    })

    it('returns false when v-prefixed versions are equal', () => {
      expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false)
    })

    it('handles mixed prefix (v on latest only)', () => {
      expect(isNewerVersion('v2.0.0', '1.0.0')).toBe(true)
    })

    it('handles mixed prefix (v on current only)', () => {
      expect(isNewerVersion('2.0.0', 'v1.0.0')).toBe(true)
    })
  })

  describe('missing segments', () => {
    it('returns false when single-segment versions are equal', () => {
      expect(isNewerVersion('1', '1.0.0')).toBe(false)
    })

    it('returns true when single-segment latest is greater', () => {
      expect(isNewerVersion('2', '1.0.0')).toBe(true)
    })

    it('returns false when two-segment versions are equal', () => {
      expect(isNewerVersion('1.0', '1.0.0')).toBe(false)
    })

    it('returns true when two-segment latest has greater minor', () => {
      expect(isNewerVersion('1.1', '1.0.0')).toBe(true)
    })
  })

  describe('large version numbers', () => {
    it('returns true when major crosses double digits', () => {
      expect(isNewerVersion('10.0.0', '9.0.0')).toBe(true)
    })

    it('returns false when current major crosses double digits', () => {
      expect(isNewerVersion('9.0.0', '10.0.0')).toBe(false)
    })
  })

  describe('multiple digit segments', () => {
    it('uses numeric comparison for minor (10 > 9)', () => {
      expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true)
    })

    it('uses numeric comparison for patch (10 > 9)', () => {
      expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true)
    })
  })

  describe('realistic versions', () => {
    it('returns true for v4.52.0 vs v4.51.3 (minor bump)', () => {
      expect(isNewerVersion('v4.52.0', 'v4.51.3')).toBe(true)
    })

    it('returns true for v4.51.4 vs v4.51.3 (patch bump)', () => {
      expect(isNewerVersion('v4.51.4', 'v4.51.3')).toBe(true)
    })

    it('returns false when current is already up to date', () => {
      expect(isNewerVersion('v4.51.3', 'v4.51.3')).toBe(false)
    })

    it('returns false when current is ahead of latest', () => {
      expect(isNewerVersion('v4.51.3', 'v4.52.0')).toBe(false)
    })
  })
})
