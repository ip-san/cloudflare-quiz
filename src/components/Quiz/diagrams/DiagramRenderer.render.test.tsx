/**
 * Render smoke-test for ALL quiz diagrams.
 *
 * Zod validation (QuizValidator) proves each diagram is structurally valid,
 * but not that it actually mounts and renders — e.g. a `network` edge that
 * references a missing node id, or any component-level runtime error, passes
 * the schema yet would crash in the real app. This test renders every
 * diagram in quizzes.json through the real DiagramRenderer and asserts it
 * mounts without throwing and produces visible text.
 *
 * Originated from the 2026-07-22 G/I review (which changed several diagram
 * types and needed render verification) and kept as a permanent gate.
 */
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { DiagramData } from '@/domain/valueObjects/Diagram'
import quizData from '../../../data/quizzes.json'
import { DiagramRenderer } from './DiagramRenderer'

// The diagram animation hook reads matchMedia + IntersectionObserver, which
// jsdom doesn't provide. Stub them so the full DiagramRenderer path renders.
beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
})

interface QuizLike {
  id: string
  diagrams?: DiagramData[]
}

const quizzes = quizData.quizzes as unknown as QuizLike[]

describe('every quiz diagram mounts through DiagramRenderer', () => {
  for (const quiz of quizzes) {
    const diagrams = quiz.diagrams ?? []
    diagrams.forEach((diagram, i) => {
      it(`${quiz.id}[${i}] (${diagram.type}) renders without error`, () => {
        const { container } = render(<DiagramRenderer diagrams={[diagram]} />)
        expect(container.textContent?.length ?? 0, `${quiz.id}[${i}] rendered empty`).toBeGreaterThan(0)
      })
    })
  }
})

describe('2026-07-22 G/I review — specific corrected diagrams', () => {
  const byId = new Map(quizzes.map((q) => [q.id, q]))
  const diagramOf = (id: string, index: number): DiagramData => {
    const q = byId.get(id)
    if (!q?.diagrams) throw new Error(`quiz ${id} has no diagrams`)
    return q.diagrams[index]
  }

  it('wk-012 formula uses subtraction, not an equals sign', () => {
    const d = diagramOf('wk-012', 0)
    expect(d.type).toBe('formula')
    if (d.type === 'formula') expect(d.operator).toBe('−')
  })

  it('wk-018 hierarchy label stays within the 40-char limit', () => {
    const d = diagramOf('wk-018', 0)
    expect(d.type).toBe('hierarchy')
    if (d.type === 'hierarchy') {
      for (const item of d.items) expect(item.text.length).toBeLessThanOrEqual(40)
    }
  })

  it('pg-017 flow leads with the explicit Enable step', () => {
    const d = diagramOf('pg-017', 0)
    expect(d.type).toBe('flow')
    if (d.type === 'flow') expect(d.steps[0].text).toContain('Enable')
  })
})
