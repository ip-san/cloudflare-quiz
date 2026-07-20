import { describe, expect, it } from 'vitest'
import { Difficulty, PREDEFINED_DIFFICULTIES } from './Difficulty'

describe('Difficulty Value Object', () => {
  describe('create()', () => {
    it('should create Difficulty with valid data', () => {
      const difficulty = Difficulty.create({
        id: 'beginner',
        name: '初級',
        color: '#22C55E',
      })

      expect(difficulty.id).toBe('beginner')
      expect(difficulty.name).toBe('初級')
      expect(difficulty.color).toBe('#22C55E')
    })

    it('should throw error for invalid difficulty level', () => {
      expect(() =>
        Difficulty.create({
          id: 'invalid' as any,
          name: 'Invalid',
          color: '#000',
        })
      ).toThrow('Invalid difficulty level: invalid')
    })

    it('should accept all valid difficulty levels', () => {
      const levels = ['beginner', 'intermediate', 'advanced'] as const

      levels.forEach((level) => {
        const difficulty = Difficulty.create({
          id: level,
          name: 'Test',
          color: '#000',
        })
        expect(difficulty.id).toBe(level)
      })
    })
  })

  describe('fromId()', () => {
    it('should return predefined difficulty by id', () => {
      const difficulty = Difficulty.fromId('beginner')

      expect(difficulty.id).toBe('beginner')
      expect(difficulty.name).toBe('初級')
    })

    it('should throw error for unknown id', () => {
      expect(() => Difficulty.fromId('nonexistent' as any)).toThrow('Unknown difficulty: nonexistent')
    })
  })

  describe('equals()', () => {
    it('should return true for same id', () => {
      const d1 = Difficulty.create({ id: 'beginner', name: 'A', color: '#000' })
      const d2 = Difficulty.create({ id: 'beginner', name: 'B', color: '#FFF' })

      expect(d1.equals(d2)).toBe(true)
    })

    it('should return false for different id', () => {
      const d1 = Difficulty.create({ id: 'beginner', name: 'A', color: '#000' })
      const d2 = Difficulty.create({ id: 'advanced', name: 'A', color: '#000' })

      expect(d1.equals(d2)).toBe(false)
    })
  })

  describe('isHarderThan()', () => {
    it('should return true when this difficulty is harder', () => {
      const advanced = Difficulty.fromId('advanced')
      const beginner = Difficulty.fromId('beginner')

      expect(advanced.isHarderThan(beginner)).toBe(true)
    })

    it('should return false when this difficulty is easier', () => {
      const beginner = Difficulty.fromId('beginner')
      const advanced = Difficulty.fromId('advanced')

      expect(beginner.isHarderThan(advanced)).toBe(false)
    })

    it('should return false for same difficulty', () => {
      const d1 = Difficulty.fromId('intermediate')
      const d2 = Difficulty.fromId('intermediate')

      expect(d1.isHarderThan(d2)).toBe(false)
    })

    it('should compare intermediate correctly', () => {
      const intermediate = Difficulty.fromId('intermediate')
      const beginner = Difficulty.fromId('beginner')
      const advanced = Difficulty.fromId('advanced')

      expect(intermediate.isHarderThan(beginner)).toBe(true)
      expect(intermediate.isHarderThan(advanced)).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      const difficulty = Difficulty.fromId('beginner')
      const json = difficulty.toJSON()

      expect(json.id).toBe('beginner')
      expect(json.name).toBe('初級')
      expect(json.color).toBeDefined()
    })
  })
})

describe('PREDEFINED_DIFFICULTIES', () => {
  it('should have 3 predefined difficulties', () => {
    expect(PREDEFINED_DIFFICULTIES).toHaveLength(3)
  })

  it('should have correct order', () => {
    expect(PREDEFINED_DIFFICULTIES[0].id).toBe('beginner')
    expect(PREDEFINED_DIFFICULTIES[1].id).toBe('intermediate')
    expect(PREDEFINED_DIFFICULTIES[2].id).toBe('advanced')
  })
})
