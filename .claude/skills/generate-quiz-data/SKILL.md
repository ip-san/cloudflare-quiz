---
name: generate-quiz-data
description: developers.cloudflare.com の公式ドキュメントからクイズ問題を自動生成する。クイズ生成、問題作成、新カテゴリ追加、quiz generate
context: fork
disable-model-invocation: true
allowed-tools: WebFetch, Read, Write, Glob, Grep, Bash
argument-hint: "[category] [count]"
---

# Quiz Generator Skill

あなたは「Cloudflare 認定試験」の問題作成責任者です。

## Role

公式ドキュメントに基づいた、実践的で高品質なクイズ問題を生成します。既存カテゴリへの追加と、
新カテゴリの新規作成の両方に対応します。

## Current State

まず現在のクイズデータの状態を確認してください：

```bash
bun run quiz:stats
```

**既存カテゴリ一覧・description は `src/config/theme.ts` の `categories` 配列を Read して確認する。**
新カテゴリを追加する場合は、まず [products index](https://developers.cloudflare.com/products/) や
`scripts/topic-config.mjs` の `DOC_PAGES` を確認し、既存41〜カテゴリと重複しない・かつ
公式ドキュメントページ数が十分にある（目安10ページ以上）製品を選ぶ。

### ID 重複防止（必須）

対象カテゴリのプレフィックスを確認し、次の空き番号を求める：

```bash
node -e "
const q = require('./src/data/quizzes.json').quizzes;
const prefix = '<PREFIX>'; // 例: 'wk'。新カテゴリなら下記手順で未使用の2文字を選ぶ
const ids = q.filter(x=>x.id.startsWith(prefix+'-')).map(x=>parseInt(x.id.split('-')[1],10)).sort((a,b)=>b-a);
console.log(prefix + '-' + String((ids[0]||0)+1).padStart(3,'0') + ' (next available)');
"
```

**新カテゴリの2文字プレフィックスを選ぶ場合**、`src/infrastructure/validation/quizContentQuality.test.ts` の
`ID_PREFIX_TO_CATEGORY` に列挙された既存プレフィックスと重複しない2文字を選ぶこと。
既存 ID と重複すると `bun run quiz:check` / `bun run test` が FAIL する。

## Input Source

### ドキュメント取得

CF の `fetch-docs.mjs` はページ名を直接指定して部分取得できる（Claude Code側の `--assemble --pages` は
このプロジェクトには存在しない）：

```bash
bun run docs:fetch:status              # キャッシュ状態を確認（14日 TTL）
node scripts/fetch-docs.mjs <page1> <page2> ...   # 指定ページのみ取得
bun run docs:fetch                     # 全ページ再取得（既存カテゴリに追加する場合は通常不要）
```

**新カテゴリを追加する場合、ページ名は `scripts/topic-config.mjs` の `DOC_PAGES` にまだ存在しない。**
以下の手順を踏む：

1. `https://developers.cloudflare.com/<product>/` のサイドバー構成を WebFetch で確認し、実際に参照する
   ページ（10〜15ページ程度が目安）を洗い出す
2. `scripts/topic-config.mjs` の `DOC_PAGES` 配列の末尾に `{ name: '<product>' }`, `{ name: '<product>/foo/bar' }`
   の形式で追記する（`name` は `https://developers.cloudflare.com/` を除いたパス、末尾スラッシュなし）
3. `node scripts/fetch-docs.mjs <product> <product>/foo/bar ...` で取得し、`.claude/tmp/docs/<name をアンダースコア2つに置換>.md`
   に生成されることを確認する
4. `src/infrastructure/validation/quizContentQuality.test.ts` の `VALID_DOC_PAGES` 配列にも同じページを
   `'<product>/'` の形式（末尾スラッシュ付き）で追記する（この配列に無い referenceUrl は `bun run test` が FAIL する）

取得したページは `.claude/tmp/docs/<page>.md`（`/` は `__` に置換）を直接 Read して内容を参照する。

### カテゴリのドキュメント取得例

```bash
node scripts/fetch-docs.mjs agents agents/runtime/agents-api agents/runtime/lifecycle/state
```

このコマンドは `.claude/tmp/docs/agents.md`、`.claude/tmp/docs/agents__runtime__agents-api.md` 等を生成する。
出力されたファイルをそのまま Read してドキュメント参照として使用する。

## Output Format

`src/data/quizzes.json` の `quizzes` 配列に追記する形式で出力してください：

```json
{
  "id": "[prefix]-[number]",
  "category": "[category_id]",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "question": "問題文（日本語）",
  "options": [
    { "text": "選択肢1", "wrongFeedback": "この選択肢が誤りである理由" },
    { "text": "選択肢2（正解）" },
    { "text": "選択肢3", "wrongFeedback": "この選択肢が誤りである理由" },
    { "text": "選択肢4", "wrongFeedback": "この選択肢が誤りである理由" }
  ],
  "correctIndex": 1,
  "explanation": "概念の説明。\n{{diagram:0}}\n詳細や補足。",
  "referenceUrl": "https://developers.cloudflare.com/...",
  "hint": "考える軸を示す言い換え（正解語をそのまま引用しない）",
  "tags": ["<category_id>", "topic-xxx"],
  "diagrams": [{ "...": "..." }]
}
```

### `diagrams` フィールド（オプション）

構造的な概念を解説する問題には、`diagrams` 配列にダイアグラムを追加する。
解説テキスト中の `{{diagram:N}}` マーカー位置に挿入表示される（N は diagrams 配列のインデックス）。

**マーカールール:**
- `{{diagram:0}}` は `diagrams[0]` を挿入
- マーカーは独立した行に配置（前後に改行 `\n`）
- 解説を「導入/概念説明」と「詳細/補足」の間に配置
- マーカーなしの場合は解説末尾にまとめて表示
- 1問に最大3つまで

**14のタイプ:**

| タイプ | 用途 | フィールド |
|--------|------|----------|
| `hierarchy` | 重要度・優先順位（ピラミッド型） | `items: [{text, sub}]` |
| `flow` | 時系列・手順・パイプライン | `steps: [{text, sub}]` |
| `cycle` | 循環状態遷移 | `trigger`, `states: [{text, sub}]` |
| `comparison` | 比較・対照（2〜4カラム） | `columns: [{heading, items}]` |
| `terminal` | コマンド実行例 | `lines: [{type, text}]` |
| `config` | 設定ファイル例 | `filepath`, `lines: [{text, highlight?}]` |
| `network` | 接続関係・アーキテクチャ（ボックス＆アロー） | `nodes: [{id, text, sub}]`, `edges: [{from, to, label, dashed?}]` |
| `sequence` | アクター間メッセージの時系列 | `actors: [string]`, `messages: [{from, to, text, dashed?}]` |
| `layer` | 入れ子の包含関係（外側が上書き） | `layers: [{text, sub}]` |
| `swimlane` | 並列処理のタイムライン | `lanes: [{name, segments: [{start, end, text}]}]`, `totalSteps?` |
| `venn` | 集合の重なり・概念の共通点（2〜3集合） | `sets: [{text, items?}]`, `intersectionLabel?` |
| `matrix` | 2D Feature×条件グリッド（✓/✗/テキスト） | `rows: [string]`, `cols: [string]`, `cells: [[string]]`, `rowHeader?`, `colHeader?` |
| `tree` | ディレクトリ構造・ファイルツリー | `root: {text, sub?, children?: [{text, sub?, children?}]}` |
| `formula` | 計算・構成の内訳 | `result`, `components: [{text, sub?, highlight?}]`, `operator?` |

**タイプの使い分けガイド（迷った場合の優先）:**

- 接続関係 → `network` / 時系列メッセージ → `sequence`（複数アクター間） / 手順 → `flow`（単一プロセス）
- 包含・上書き関係 → `layer` / 重要度順 → `hierarchy` / 概念の重なり → `venn`
- 並列処理 → `swimlane` / 2軸グリッド → `matrix` / カラム比較 → `comparison`
- ディレクトリ構造 → `tree` / 計算式・内訳 → `formula`

構造的概念を含む問題にのみ追加。単純な事実確認には不要。
図+ターミナルなど、複数ダイアグラムの組み合わせも有効。

**JSON 例は `diagram-examples.md` を Read して参照。** network, sequence, layer, swimlane, venn, matrix, tree, formula の8タイプ分。

**ダイアグラム作成ルール（途中切れ禁止）:**

- **YOU MUST** ダイアグラム本文に `…`（日本語三点リーダー）や文中の `...` を**入れない**。`bun run quiz:check-ellipsis`（`quiz:check` に統合済み）が検出する
- terminal/config の末尾 `Loading...` `処理中…` のような進捗表示の `...`/`…` のみ許容
- placeholder は具体値で書く: `{ ... }` `sk-...` `https://example.com/...` などは NG。実際のサンプル値を入れる
- `comparison.columns[].items[]` は **完全文**で 80 文字以内に収める。長くなる説明文を載せたい場合は `comparison` ではなく `hierarchy`（`items: [{text, sub}]`）を使う。`sub` は長さ無制限

**ダイアグラム作成ルール（text/sub の意味論・機械チェックなし）:**

CFにはこのルールを自動検出するスクリプトが無いため、生成時に自分で確認する:

- `flow.steps[].text` と `sub` を**1つの文を2分割するために使わない**（`text`=完全な文、`sub`=技術名の列挙や短い補足）
- `hierarchy.items[].text` は**40字以内の短いラベル**に留める。option 全文や wrongFeedback 全文を詰めない。長い説明は `sub`（長さ無制限）に置く

## ID Conventions

- 2文字の英数字プレフィックス + `-` + 3桁連番（例: `wk-001`, `at-018`）
- 既存の最大番号の続きから採番（重複禁止）
- 全プレフィックス一覧は `src/infrastructure/validation/quizContentQuality.test.ts` の `ID_PREFIX_TO_CATEGORY` を参照

## Quality Requirements

### 基本ルール

1. **正確性:** 公式ドキュメントの内容に基づく正確な情報のみ
2. **実践性:** 実際のプロダクト開発で役立つ実践的な問題
3. **wrongFeedback:** 正解選択肢にはwrongFeedbackを付けない。不正解選択肢には必ず「なぜ誤りなのか」の説明を含める
4. **referenceUrl:** 各問題に `https://developers.cloudflare.com/` で始まる正しいURLを必ず含める
   - **referenceUrl は問題内容に最も直接的なページを選ぶ:** 製品トップページの概要文（`<product>/`）ではなく、
     機能の詳細を問う問題には機能専用ページ（サブパス）を参照すること
   - **候補ページの一覧は `scripts/topic-config.mjs` の `DOC_PAGES` を参照。** 新規ページを使う場合は
     「Input Source」節の手順で `DOC_PAGES` と `VALID_DOC_PAGES`（`quizContentQuality.test.ts`）の両方に追記すること
   - アンカー（`#fragment`）を付ける場合は、`.claude/tmp/docs/<page>.md` の見出しと一致させる（`bun run quiz:lint:url` で機械チェック可能。誤検知時は `topic-config.mjs` の `VERIFIED_LIVE_ANCHORS` を参照）
5. **日本語:** 問題文・選択肢・解説・wrongFeedback・hintはすべて日本語
6. **選択肢4つ:** 各問題に正確に4つの選択肢を含める
7. **バッククォート書式:** コード用語・パス・コマンド・環境変数・設定キーは全フィールドでバッククォート。URL途中への挿入禁止。同一問題内で不整合禁止（`bun run quiz:lint:backtick` が自動修正）
8. **tags:** `[<category_id>, "topic-xxx"]`（+ 実務直結なら `"practical"`、上級トリビアなら `"trivia"`）の形式。`topic-xxx` は `^[a-z]+(-[a-z]+)*$` にマッチする英小文字ハイフン区切り

> **詳細ルール（暗記禁止・問題指針・シナリオ選定・wrongFeedback 品質・重複防止・事実正確性チェック・内部一貫性）は `quality-rules.md` を Read して参照。**

## Post-Generation Steps（重要）

問題追加後、以下を必ず実行してください：

1. **correctIndex をランダム化:**
   ```bash
   bun run quiz:randomize
   ```

2. **品質チェック:**
   ```bash
   bun run quiz:check
   bun run quiz:lint:dry
   ```

3. **テスト実行:**
   ```bash
   bun run test
   ```

4. **統計確認:**
   ```bash
   bun run quiz:stats
   ```

5. **新カテゴリ追加時の追加同期箇所（`grep -rln "<既存カテゴリ名>" src/ scripts/` で洗い出す）:**
   - `src/config/theme.ts` の `categories` 配列（id/name/icon/color/weight/description/skillDescription。color は `src/lib/colors.ts` の `COLOR_MAP` に未使用の色を追加）
   - `src/domain/valueObjects/Category.test.ts`（`expect(ids).toContain('<category_id>')`）
   - `src/infrastructure/validation/quizContentQuality.test.ts`（`ID_PREFIX_TO_CATEGORY`、`VALID_DOC_PAGES`、`OVERVIEW_EXCLUDED`。全体像モードの6チャプター対象外にする場合）
   - `scripts/topic-config.mjs` の `DOC_PAGES`
   - `README.md` のカテゴリ数・問題数・カテゴリ一覧（3箇所）

## Arguments

- `$ARGUMENTS` の1つ目にカテゴリID（既存 or 新規）、2つ目に問題数を指定（例: `/generate-quiz-data agents 18`）
- カテゴリ省略時は既存カテゴリから正答率データ等を参照できないため、優先度の高い新カテゴリ候補を
  「Current State」の手順で自分で選定してから生成する
- 数値省略時は18問（既存カテゴリの標準問題数）を目安にする
- 新カテゴリは1バッチ18問・beginner 6/intermediate 8/advanced 4 の配分を目安にする（既存コーパスの標準比率）
