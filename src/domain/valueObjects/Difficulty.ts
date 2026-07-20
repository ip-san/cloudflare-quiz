/**
 * Difficulty Value Object
 * Represents quiz difficulty levels
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface DifficultyProps {
  readonly id: DifficultyLevel
  readonly name: string
  readonly color: string
}

export class Difficulty {
  readonly id: DifficultyLevel
  readonly name: string
  readonly color: string

  private constructor(props: DifficultyProps) {
    this.id = props.id
    this.name = props.name
    this.color = props.color
  }

  static create(props: DifficultyProps): Difficulty {
    const validLevels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']
    if (!validLevels.includes(props.id)) {
      throw new Error(`Invalid difficulty level: ${props.id}`)
    }
    return new Difficulty(props)
  }

  static fromId(id: DifficultyLevel): Difficulty {
    const difficulty = PREDEFINED_DIFFICULTIES.find((d) => d.id === id)
    if (!difficulty) {
      throw new Error(`Unknown difficulty: ${id}`)
    }
    return difficulty
  }

  equals(other: Difficulty): boolean {
    return this.id === other.id
  }

  isHarderThan(other: Difficulty): boolean {
    const order: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced']
    return order.indexOf(this.id) > order.indexOf(other.id)
  }

  toJSON(): DifficultyProps {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
    }
  }
}

// Pre-defined difficulty levels
export const PREDEFINED_DIFFICULTIES: Difficulty[] = [
  Difficulty.create({
    id: 'beginner',
    name: '初級',
    color: '#22C55E',
  }),
  Difficulty.create({
    id: 'intermediate',
    name: '中級',
    color: '#F59E0B',
  }),
  Difficulty.create({
    id: 'advanced',
    name: '上級',
    color: '#EF4444',
  }),
]
