/**
 * Category Value Object
 * Represents a quiz category with its configuration
 */
export interface CategoryProps {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon?: string
  readonly color?: string
  readonly weight?: number
}

export class Category {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly color: string
  readonly weight: number

  private constructor(props: CategoryProps) {
    this.id = props.id
    this.name = props.name
    this.description = props.description
    this.icon = props.icon ?? '📁'
    this.color = props.color ?? 'gray'
    this.weight = props.weight ?? 10
  }

  static create(props: CategoryProps): Category {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Category ID is required')
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Category name is required')
    }
    return new Category(props)
  }

  equals(other: Category): boolean {
    return this.id === other.id
  }

  toJSON(): CategoryProps {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      color: this.color,
      weight: this.weight,
    }
  }
}

// テーマ設定からカテゴリを動的に生成（Category.create で ID/名前のバリデーションを通す）
import { theme } from '@/config/theme'

export const PREDEFINED_CATEGORIES: Category[] = theme.categories.map((c) => Category.create(c))

export function getCategoryById(id: string): Category | undefined {
  return PREDEFINED_CATEGORIES.find((c) => c.id === id)
}
