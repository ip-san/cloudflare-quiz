import { describe, expect, it } from 'vitest'
import { theme } from '@/config/theme'
import { Category, getCategoryById, PREDEFINED_CATEGORIES } from './Category'

describe('Category Value Object', () => {
  describe('create()', () => {
    it('should create Category with valid data', () => {
      const category = Category.create({
        id: 'test',
        name: 'Test Category',
        description: 'A test category',
        icon: '🧪',
        color: 'purple',
        weight: 20,
      })

      expect(category.id).toBe('test')
      expect(category.name).toBe('Test Category')
      expect(category.description).toBe('A test category')
      expect(category.icon).toBe('🧪')
      expect(category.color).toBe('purple')
      expect(category.weight).toBe(20)
    })

    it('should use default values for optional fields', () => {
      const category = Category.create({
        id: 'test',
        name: 'Test',
        description: 'Description',
      })

      expect(category.icon).toBe('📁')
      expect(category.color).toBe('gray')
      expect(category.weight).toBe(10)
    })

    it('should throw error for empty id', () => {
      expect(() =>
        Category.create({
          id: '',
          name: 'Test',
          description: 'Description',
        })
      ).toThrow('Category ID is required')
    })

    it('should throw error for empty name', () => {
      expect(() =>
        Category.create({
          id: 'test',
          name: '',
          description: 'Description',
        })
      ).toThrow('Category name is required')
    })

    it('should throw error for whitespace-only id', () => {
      expect(() =>
        Category.create({
          id: '   ',
          name: 'Test',
          description: 'Description',
        })
      ).toThrow('Category ID is required')
    })
  })

  describe('equals()', () => {
    it('should return true for same id', () => {
      const cat1 = Category.create({ id: 'test', name: 'Test 1', description: '' })
      const cat2 = Category.create({ id: 'test', name: 'Test 2', description: '' })

      expect(cat1.equals(cat2)).toBe(true)
    })

    it('should return false for different id', () => {
      const cat1 = Category.create({ id: 'test1', name: 'Test', description: '' })
      const cat2 = Category.create({ id: 'test2', name: 'Test', description: '' })

      expect(cat1.equals(cat2)).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      const category = Category.create({
        id: 'test',
        name: 'Test',
        description: 'Description',
        icon: '🧪',
        color: 'blue',
        weight: 15,
      })

      const json = category.toJSON()

      expect(json.id).toBe('test')
      expect(json.name).toBe('Test')
      expect(json.description).toBe('Description')
      expect(json.icon).toBe('🧪')
      expect(json.color).toBe('blue')
      expect(json.weight).toBe(15)
    })
  })
})

describe('PREDEFINED_CATEGORIES', () => {
  it('should have predefined categories matching theme config', () => {
    expect(PREDEFINED_CATEGORIES.length).toBeGreaterThan(0)
    expect(PREDEFINED_CATEGORIES).toHaveLength(theme.categories.length)
  })

  it('should have all required categories', () => {
    const ids = PREDEFINED_CATEGORIES.map((c) => c.id)

    expect(ids).toContain('workers')
    expect(ids).toContain('wrangler')
    expect(ids).toContain('kv-cache')
    expect(ids).toContain('d1')
    expect(ids).toContain('r2')
    expect(ids).toContain('do-queues')
    expect(ids).toContain('pages-deploy')
    expect(ids).toContain('ai-vectorize')
    expect(ids).toContain('architecture')
  })

  it('should have unique ids', () => {
    const ids = PREDEFINED_CATEGORIES.map((c) => c.id)
    const uniqueIds = [...new Set(ids)]

    expect(ids.length).toBe(uniqueIds.length)
  })
})

describe('getCategoryById()', () => {
  it('should find existing category', () => {
    const category = getCategoryById('workers')

    expect(category).toBeDefined()
    expect(category?.id).toBe('workers')
    expect(category?.name).toBe('Workers 基礎')
  })

  it('should return undefined for non-existent category', () => {
    const category = getCategoryById('nonexistent')

    expect(category).toBeUndefined()
  })
})
