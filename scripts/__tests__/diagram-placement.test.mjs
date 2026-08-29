import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 図のマーカー `{{diagram:N}}` は**解説の中にしか置かない**。
 *
 * 解説は答え合わせの後に出るので、図が正解を示していても問題ない。
 * だが設問文やヒントに図を置くと、**答えを選ぶ前に図が見えてしまう。**
 * 実際コーパスの図には「公開URLを経由しない直接呼び出し(正解)」のように
 * 正解を明示しているものがあり、これは解説内だから成立している。
 *
 * 2026-08-29 の図の全数監査で 876枚すべてが解説内にあることを確認した。
 * 構造的に成り立っている不変条件なので、崩れたら落ちるようにしておく。
 *
 * あわせて「解説から参照されていない図」も見る。参照が無い図は画面に出ないので、
 * 監査しても学習者には届かない死んだデータになる。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const MARKER = /\{\{diagram:(\d+)\}\}/g

function markersIn(text) {
  return [...(text ?? '').matchAll(MARKER)].map((m) => m[1])
}

describe('図の配置', () => {
  const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes

  it('図のマーカーは解説の中にしか無い（設問・ヒント・選択肢に置くと答えが先に見える）', () => {
    const misplaced = []
    for (const quiz of quizzes) {
      const layers = { question: quiz.question, hint: quiz.hint }
      quiz.options.forEach((o, i) => {
        layers[`options[${i}].text`] = o.text
        if (o.wrongFeedback) layers[`options[${i}].wrongFeedback`] = o.wrongFeedback
      })
      for (const [field, text] of Object.entries(layers)) {
        if (markersIn(text).length) misplaced.push(`${quiz.id} [${field}]`)
      }
    }

    expect(
      misplaced,
      [
        '解説以外の層に図のマーカーがあります:',
        ...misplaced.map((m) => `  - ${m}`),
        '',
        '設問やヒントに図を置くと、答えを選ぶ前に図が見えます。',
        'コーパスの図には正解を明示しているものがあり、解説内だから成立しています。',
      ].join('\n')
    ).toEqual([])
  })

  it('すべての図が解説から参照されている（参照の無い図は画面に出ない）', () => {
    const orphaned = []
    for (const quiz of quizzes) {
      const count = (quiz.diagrams ?? []).length
      if (!count) continue
      const referenced = new Set(markersIn(quiz.explanation))
      for (let i = 0; i < count; i++) {
        if (!referenced.has(String(i))) orphaned.push(`${quiz.id} diagram[${i}]`)
      }
    }

    expect(orphaned, ['解説から参照されていない図があります:', ...orphaned.map((o) => `  - ${o}`)].join('\n')).toEqual(
      []
    )
  })
})
