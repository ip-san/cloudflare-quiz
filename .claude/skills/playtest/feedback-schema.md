# プレイテスト フィードバック JSON 契約

エージェント間の受け渡しは下記スキーマに従う。すべて `.claude/tmp/playtest/` 配下。

## 1. プレイスルー出力（user-simulator → `requests-<persona>.json`）

```json
{
  "persona": "beginner | busy-intermediate | reviewer",
  "sessionMode": "welcome-default | random | category:<id> | review",
  "playedCount": 9,
  "items": [
    {
      "order": 1,
      "questionSnippet": "設問文の冒頭〜40字（verbatim・名寄せ用キー）",
      "answeredCorrectly": true,
      "phase": "question | options | answering | explanation | ui | flow",
      "domain": "content | learning | ux",
      "severity": "blocker | confusing | minor",
      "friction": "何が分かりにくい / 学びにくいか（客観）",
      "personaVoice": "そのペルソナとしての一人称の感想",
      "suggestion": "どう直せば分かりやすく / 学びやすくなるか"
    }
  ],
  "played": [{ "id": "ac-008", "outcome": "clean | friction" }],
  "sessionNotes": "セッション全体のフロー・UX 観察"
}
```

- `domain`: content=設問/選択肢/解説の文言・事実、learning=難易度/出題順/図/構成、ux=画面・操作フロー
- 詰まりがなかった問題は `items` に入れない
- **`played` は必須**。`items` は詰まりが出た問題だけなので、`played` が無いと
  「詰まらなかった問題をプレイした」という事実が消える。`playtest-coverage.mjs mark-batch` が
  読むのはこちらで、`items` ではない。`playedCount` と件数を一致させること
  （2026-08-26 に busy-intermediate が `played` を落とし、5問分の記録が失われかけた。
  現在は mark-batch が `playedCount>0` かつ `played` 無しを検出して落とす）

## 2. 名寄せ・集約（playtest-resolve.mjs → `requests.json`）

各 item に `quizId`（解決結果、未解決は null）と `persona` を付与し、`domain` でグループ化:

```json
{
  "resolvedAt": "<stamp>",
  "byDomain": {
    "content":  [{ "quizId": "wk-012", "persona": "beginner", ... item ... }],
    "learning": [ ... ],
    "ux":       [ ... ]
  },
  "unresolved": [ { "questionSnippet": "...", ... } ],
  "stats": { "total": 0, "content": 0, "learning": 0, "ux": 0, "byPersona": {} }
}
```

## 3. 専門家レビュー判定（learning-experience-reviewer → `verdicts-<domain>.json`）

```json
{
  "domain": "content | learning | ux",
  "verdicts": [
    {
      "quizId": "wk-012",
      "requestSummary": "初学者が選択肢の差を判別できない、の要約",
      "verdict": "accept | modify | reject",
      "rationale": "妥当性の根拠。content/learning は必ず公式ドキュメント参照を添える",
      "docRef": "workers/configuration/compatibility-dates L55 等（content の場合必須）",
      "change": {
        "field": "question | options[N].text | options[N].wrongFeedback | hint | explanation | difficulty | diagrams | glossary",
        "from": "現行値（一致確認用）",
        "to": "提案値"
      },
      "uxReport": "ux ドメインのみ: 報告本文（change は null）"
    }
  ]
}
```

### `field: "glossary"` — 用語集への追加提案（2026-09-09 に対応）

`from`/`to` ではなく `additions: [{term, description}]` を持つ。`playtest-apply.mjs` が
`src/domain/valueObjects/Glossary.ts` へ追記する（既にある語は自動でスキップ）。
09-07 と 09-08 に**2 体のレビュアーが独立に「apply できない」と報告**した。毎回の手作業をやめる。

用語集は**該当する全問に出る**ので、影響範囲が 1 問より広い。提案する前に必ず:

- 定義を docs で裏取りし `docRef` に引用を書く（推測で書けば全問に事実を注入することになる）
- **その語を主題として問う設問が無いか** `quizzes.json` を grep する。あれば入れない（チップが答えを渡す。
  R2 / Common Name / SAN / Origin CA をこの規則で不採用にした）
- 文脈で意味が変わる語・製品名の一部になる語は入れない（`Allow` / `Gateway` の実例が Glossary.ts のヘッダーにある）
- コーパスの実表記と一致させる（`IP Access rules` と `IP Access Rules`、`Layer 4` と `L4` は別々に登録が要る）

チップが走査するのは **question / hint / options だけ**。解説と図の中の語には出ないので、
そちらは本文の括弧書きで解決する（`sc-016` では語を削って逆に説明を失った）。

- **reject 基準:** 事実誤認の誘発・難易度の意図破壊・既存の正確な内容の劣化・過剰反応（1ペルソナの主観のみで一般性に欠ける）
- content の `accept/modify` は事実を変えないこと。変える場合は `docRef` 必須。最終的に `/quiz-refine` の検証観点で再確認する
- ux は **report-only**（quizzes.json を編集しない。`change` は null）

## 4. 適用（playtest-apply.mjs）

`verdicts-content.json` / `verdicts-learning.json` の `accept`/`modify` のみを quizzes.json へ適用。
`from` が現行値と不一致なら **その verdict をスキップしてログ**（安全側）。適用後 `bun run quiz:randomize && bun run quiz:check && bun run test`（偏り解消→整合性チェック→ユニットテスト）と `bun run quiz:lint:dry`/`bun run quiz:fact-check` の事実ゲートを実行。
