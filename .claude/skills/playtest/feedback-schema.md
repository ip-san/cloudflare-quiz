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
  "sessionNotes": "セッション全体のフロー・UX 観察"
}
```

- `domain`: content=設問/選択肢/解説の文言・事実、learning=難易度/出題順/図/構成、ux=画面・操作フロー
- 詰まりがなかった問題は `items` に入れない

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
        "field": "question | options[N].text | options[N].wrongFeedback | hint | explanation | difficulty | diagrams",
        "from": "現行値（一致確認用）",
        "to": "提案値"
      },
      "uxReport": "ux ドメインのみ: 報告本文（change は null）"
    }
  ]
}
```

- **reject 基準:** 事実誤認の誘発・難易度の意図破壊・既存の正確な内容の劣化・過剰反応（1ペルソナの主観のみで一般性に欠ける）
- content の `accept/modify` は事実を変えないこと。変える場合は `docRef` 必須。最終的に `/quiz-refine` の検証観点で再確認する
- ux は **report-only**（quizzes.json を編集しない。`change` は null）

## 4. 適用（playtest-apply.mjs）

`verdicts-content.json` / `verdicts-learning.json` の `accept`/`modify` のみを quizzes.json へ適用。
`from` が現行値と不一致なら **その verdict をスキップしてログ**（安全側）。適用後 `bun run quiz:randomize && bun run quiz:check && bun run test`（偏り解消→整合性チェック→ユニットテスト）と `bun run quiz:lint:dry`/`bun run quiz:fact-check` の事実ゲートを実行。
