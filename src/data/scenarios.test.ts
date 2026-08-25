import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import quizzesData from './quizzes.json'
import { SCENARIOS } from './scenarios'

const quizIds = new Set(quizzesData.quizzes.map((q: { id: string }) => q.id))

describe('Scenarios', () => {
  it('all scenarios have at least one question', () => {
    for (const scenario of SCENARIOS) {
      const questions = scenario.steps.filter((s) => s.type === 'question')
      expect(questions.length, `${scenario.id} has no questions`).toBeGreaterThan(0)
    }
  })

  it('all question steps have valid questionId', () => {
    for (const scenario of SCENARIOS) {
      const questionSteps = scenario.steps.filter((s) => s.type === 'question')
      for (const step of questionSteps) {
        expect(step.questionId, `${scenario.id} has question step without questionId`).toBeTruthy()
      }
    }
  })

  it('all scenarios have an epilogue (narrative after last question)', () => {
    for (const scenario of SCENARIOS) {
      const lastStep = scenario.steps[scenario.steps.length - 1]
      expect(
        lastStep.type,
        `${scenario.id} missing epilogue: last step is '${lastStep.type}', expected 'narrative'`
      ).toBe('narrative')
      expect(lastStep.text, `${scenario.id} epilogue has no text`).toBeTruthy()
    }
  })

  describe('nextSteps（完走後の次の一歩）', () => {
    // nextSteps を持つものだけに絞り込んではいけない。絞ると「nextSteps を消したシナリオ」が
    // 以降の検査対象から黙って外れる。全シナリオを平坦化して、どの検査も取りこぼさない形にする。
    const allSteps = SCENARIOS.flatMap((s) => (s.nextSteps ?? []).map((step) => ({ scenarioId: s.id, step })))

    // シナリオの価値は「知識で終わらせず手を動かすところまで繋ぐ」ことにある。
    // 1本でも次の一歩が無いと、そのシナリオだけ読み物で終わってしまう。
    it('すべてのシナリオに nextSteps があること', () => {
      const missing = SCENARIOS.filter((s) => !s.nextSteps || s.nextSteps.length === 0).map((s) => s.id)
      expect(missing, `次の一歩が無いシナリオ: ${missing.join(', ')}`).toEqual([])
    })

    // ScenarioCompletion は label を React の key とコピー済み表示の識別子の両方に使う。
    // 同一シナリオ内で重複すると key が衝突し、片方をコピーしただけで両方に ✓ が出る。
    it('同一シナリオ内で nextStep の label が重複しないこと', () => {
      const dup: string[] = []
      for (const s of SCENARIOS) {
        const labels = (s.nextSteps ?? []).map((step) => step.label)
        for (const label of labels.filter((l, i) => labels.indexOf(l) !== i)) {
          dup.push(`${s.id}: "${label}"`)
        }
      }
      expect(dup, `label が重複している nextStep: ${dup.join(', ')}`).toEqual([])
    })

    it('各 nextStep に label があり、command か docUrl の少なくとも一方を持つこと', () => {
      for (const { scenarioId, step } of allSteps) {
        expect(step.label, `${scenarioId}: label がない`).toBeTruthy()
        expect(
          Boolean(step.command) || Boolean(step.docUrl),
          `${scenarioId} / "${step.label}": command と docUrl の両方がない（何をすればいいか辿れない）`
        ).toBe(true)
      }
    })

    it('docUrl はすべて developers.cloudflare.com を指すこと', () => {
      const bad = allSteps
        .filter(({ step }) => step.docUrl && !step.docUrl.startsWith('https://developers.cloudflare.com/'))
        .map(({ scenarioId, step }) => `${scenarioId}: ${step.docUrl}`)
      expect(bad, `公式ドキュメント以外へのリンク: ${bad.join(', ')}`).toEqual([])
    })

    // 存在しないコマンドを載せると、学習者が実際に叩いて詰まる。
    // 実在を保証できる形（wrangler / cloudflared / npm create cloudflare）に限定する。
    it('command は実在が確認できるCLIのものだけであること', () => {
      // `curl` は POSIX 環境に標準で入っている前提で許可する。
      // Cloudflare 固有のコマンドは公式ドキュメントで実在を確認したものだけ。
      const ALLOWED_PREFIXES = ['npx wrangler ', 'npm create cloudflare', 'cloudflared ', 'curl ']
      const bad = allSteps
        .filter(({ step }) => step.command && !ALLOWED_PREFIXES.some((p) => step.command?.startsWith(p)))
        .map(({ scenarioId, step }) => `${scenarioId}: ${step.command}`)
      expect(bad, `想定外のコマンド: ${bad.join(', ')}`).toEqual([])
    })
  })

  it('all scenarios have a completionMessage', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.completionMessage, `${scenario.id} missing completionMessage`).toBeTruthy()
    }
  })

  it('all scenarios start with a narrative', () => {
    for (const scenario of SCENARIOS) {
      const firstStep = scenario.steps[0]
      expect(firstStep.type, `${scenario.id}: first step should be narrative, got '${firstStep.type}'`).toBe(
        'narrative'
      )
    }
  })

  it('narrative steps always have text', () => {
    for (const scenario of SCENARIOS) {
      const narrativeSteps = scenario.steps.filter((s) => s.type === 'narrative')
      for (const step of narrativeSteps) {
        expect(step.text, `${scenario.id} has narrative step without text`).toBeTruthy()
      }
    }
  })

  it('all questionIds reference existing questions in quizzes.json', () => {
    for (const scenario of SCENARIOS) {
      const questionSteps = scenario.steps.filter((s) => s.type === 'question')
      for (const step of questionSteps) {
        expect(
          quizIds.has(step.questionId!),
          `${scenario.id}: questionId "${step.questionId}" not found in quizzes.json`
        ).toBe(true)
      }
    }
  })

  it('no question appears twice in the same scenario', () => {
    for (const scenario of SCENARIOS) {
      const ids = scenario.steps.filter((s) => s.type === 'question').map((s) => s.questionId!)
      const unique = new Set(ids)
      expect(
        unique.size,
        `${scenario.id} has duplicate questions: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`
      ).toBe(ids.length)
    }
  })

  it('cross-scenario question reuse is limited (max 15 shared questions)', () => {
    const seen = new Map<string, string[]>()
    for (const scenario of SCENARIOS) {
      for (const step of scenario.steps.filter((s) => s.type === 'question')) {
        const list = seen.get(step.questionId!) ?? []
        list.push(scenario.id)
        seen.set(step.questionId!, list)
      }
    }
    const shared = [...seen.entries()].filter(([, scenarios]) => scenarios.length > 1)
    expect(
      shared.length,
      `${shared.length} questions shared across scenarios: ${shared.map(([id, s]) => `${id}(${s.join(',')})`).join(', ')}`
    ).toBeLessThanOrEqual(15)
  })

  it('each scenario has 3-10 questions', () => {
    for (const scenario of SCENARIOS) {
      const count = scenario.steps.filter((s) => s.type === 'question').length
      expect(count, `${scenario.id} has ${count} questions (expected 3-10)`).toBeGreaterThanOrEqual(3)
      expect(count, `${scenario.id} has ${count} questions (expected 3-10)`).toBeLessThanOrEqual(10)
    }
  })
})

describe('narrativeMap building logic', () => {
  /**
   * Replicates the narrativeMap logic from ScenarioView to test it in isolation.
   * If ScenarioView's logic changes, this test should be updated to match.
   */
  function buildNarrativeMap(steps: readonly { type: string; text?: string }[]) {
    const map: Record<number, string[]> = {}
    let qIdx = 0
    let pending: string[] = []

    for (const step of steps) {
      if (step.type === 'narrative' && step.text) {
        pending.push(step.text)
      } else if (step.type === 'question') {
        if (pending.length > 0) {
          map[qIdx] = [...pending]
          pending = []
        }
        qIdx++
      }
    }
    if (pending.length > 0) {
      map[qIdx] = [...pending]
    }
    return { map, questionCount: qIdx }
  }

  it('captures epilogue at questionCount index', () => {
    const steps = [{ type: 'narrative', text: 'intro' }, { type: 'question' }, { type: 'narrative', text: 'epilogue' }]
    const { map, questionCount } = buildNarrativeMap(steps)
    expect(questionCount).toBe(1)
    expect(map[0]).toEqual(['intro'])
    expect(map[questionCount]).toEqual(['epilogue'])
  })

  it('handles multiple narratives before a question', () => {
    const steps = [{ type: 'narrative', text: 'page1' }, { type: 'narrative', text: 'page2' }, { type: 'question' }]
    const { map } = buildNarrativeMap(steps)
    expect(map[0]).toEqual(['page1', 'page2'])
  })

  it('handles no epilogue', () => {
    const steps = [{ type: 'narrative', text: 'intro' }, { type: 'question' }]
    const { map, questionCount } = buildNarrativeMap(steps)
    expect(map[questionCount]).toBeUndefined()
  })

  it('epilogue index equals questionCount for all real scenarios', () => {
    for (const scenario of SCENARIOS) {
      const { map, questionCount } = buildNarrativeMap(scenario.steps)
      expect(map[questionCount], `${scenario.id}: epilogue should be at index ${questionCount}`).toBeTruthy()
      expect(map[questionCount].length, `${scenario.id}: epilogue should have at least 1 text`).toBeGreaterThan(0)
    }
  })
})

describe('banned patterns guard', () => {
  it('no min-h-screen in tsx files (use min-h-dvh for iOS PWA)', () => {
    const result = execSync('grep -rn "min-h-screen" src/components/ src/App.tsx 2>/dev/null || true', {
      encoding: 'utf8',
    })
    expect(result.trim(), `min-h-screen found:\n${result}`).toBe('')
  })
})

describe('ScenarioView epilogue integration guard', () => {
  it('ScenarioView passes onLastQuestionNext to QuizCard', () => {
    // This is a structural guard: if someone refactors ScenarioView and
    // removes the onLastQuestionNext callback, this test will fail.
    const scenarioViewCode = readFileSync('src/components/Quiz/ScenarioView.tsx', 'utf8')
    expect(scenarioViewCode).toContain('onLastQuestionNext')
    expect(scenarioViewCode).toContain('setShowEpilogue(true)')
    expect(scenarioViewCode).toContain('nextQuestion()')
  })

  it('QuizCard accepts onLastQuestionNext prop', () => {
    const quizCardCode = readFileSync('src/components/Quiz/QuizCard.tsx', 'utf8')
    expect(quizCardCode).toContain('onLastQuestionNext')
    // onLastQuestionNext takes priority over chapter boundary and default nextQuestion
    expect(quizCardCode).toMatch(/onLastQuestionNext\b/)
  })

  it('QuizCard swipe handler respects onLastQuestionNext', () => {
    // Logic extracted to useQuizCard hook — check both files
    const quizCardCode = readFileSync('src/components/Quiz/QuizCard.tsx', 'utf8')
    const useQuizCardCode = readFileSync('src/components/Quiz/useQuizCard.ts', 'utf8')
    // Swipe-left must check onLastQuestionNext before calling nextQuestion
    // May live in the component or its custom hook
    const combined = quizCardCode + useQuizCardCode
    expect(combined).toMatch(/onSwipeLeft.*onLastQuestionNext/s)
  })

  it('saveSessionSnapshot receives sessionLabel from store', () => {
    const lifecycleCode = readFileSync('src/stores/slices/sessionLifecycleSlice.ts', 'utf8')
    const answerCode = readFileSync('src/stores/slices/sessionAnswerSlice.ts', 'utf8')
    const sessionCode = lifecycleCode + answerCode
    const resumeCode = readFileSync('src/stores/slices/resumeSlice.ts', 'utf8')
    // Every saveSessionSnapshot call (excluding import) must include sessionLabel
    const sessionCalls = (sessionCode.match(/saveSessionSnapshot\(/g) || []).length
    const sessionWithLabel = (sessionCode.match(/sessionLabel: get\(\)\.sessionLabel/g) || []).length
    expect(sessionWithLabel, 'session slices: all calls must include sessionLabel').toBe(sessionCalls)

    const resumeCalls = (resumeCode.match(/saveSessionSnapshot\(/g) || []).length
    const resumeWithLabel = (resumeCode.match(/sessionLabel: get\(\)\.sessionLabel/g) || []).length
    expect(resumeWithLabel, 'resumeSlice: all calls must include sessionLabel').toBe(resumeCalls)
  })
})
