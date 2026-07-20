---
name: quality-loop
description: コードレビュー + クイズ検証 + 最終ゲートを一括実行する品質ループ。品質ループ、定期チェック、quality loop
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, Skill
argument-hint: "[--skip-review] [--skip-refine] [--dry-run] [--team] [--full]"
---

# Quality Loop Skill

コード品質とクイズコンテンツ品質を一括でチェックし、最終ゲートで整合性を保証する統合スキル。
`bun run check`（typecheck + lint + test + `quiz:check` + `quiz:lint:dry`）を土台に、
LLMによるコードレビューとクイズ内容検証を組み合わせる。

**自律実行ルール:** AskUserQuestion を使わないこと。判断に迷う場合はスキップしてログに記録し、次に進む。

## 引数

`$ARGUMENTS` を空白で分割する。

- `--skip-review`: ステップ1（コードレビュー）をスキップ
- `--skip-refine`: ステップ2（クイズ検証）をスキップ
- `--dry-run`: ステップ2を検証のみモードで実行（修正しない）
- `--team`: 独立ステップをエージェントで並列実行
- `--full`: ステップ2を全問スキャンにする（デフォルトは未コミット変更のあった問題のみ）

フラグなしの場合は全ステップを逐次実行する。

## 実行モード

### 逐次モード（デフォルト）

```
Step 0（決定論的チェック）→ Step 1（コードレビュー）→ Step 2（クイズ検証）→ Step 3（最終ゲート）
```

### チームモード（`--team`）

```
Phase 1（並列）: [quiz-lint/cross-check/check] [code-review]
    ↓ 結果集約
Phase 2（逐次）: クイズ検証（/quiz-refine、内部で --team ならさらに並列化）
    ↓
Phase 3（逐次）: 最終ゲート
```

## Step 0: 決定論的チェック

**常に実行**（スキップフラグなし）。ネットワーク不要、モデル不要:

```bash
node scripts/quiz-utils.mjs check
node scripts/quiz-lint.mjs all --dry-run
node scripts/quiz-cross-check.mjs
```

いずれも exit code 0 で返る（アドバイザリ）。出力は Step 2 の検証対象の参考にする。
`.claude/tmp/docs/` が存在する場合（`ls .claude/tmp/docs 2>/dev/null | wc -l` で確認）は追加で:

```bash
node scripts/quiz-fact-check.mjs
```

存在しない場合は `bun run docs:fetch` の実行を提案するのみでスキップする（ネットワーク不要な運用を優先）。

## Step 1: コードレビュー

**スキップ条件:** `--skip-review` フラグ、または `git diff --name-only` および `git status --short` が両方とも空（変更なし）

`/code-review` スキルを実行し、未コミットの変更（クイズデータ以外のコード変更）をレビューする。

### チームモードでの並列化

`--team` 指定時、以下を同一メッセージ内で並列起動:

- **Agent A**: Step 0 の決定論的チェック一式を実行し、結果をテキストで報告
- **Agent B（またはSkillとして直接）**: `/code-review` を実行し、指摘事項を報告

両方完了後に結果を集約し、Step 2 に引き継ぐ。

## Step 2: クイズ検証

**スキップ条件:** `--skip-refine` フラグ、または `src/data/quizzes.json` に変更がなく Step 0 の出力にも flagged 項目がない場合

`/quiz-refine` スキルを実行する。引数は `$ARGUMENTS` から以下をそのまま引き継ぐ:

- `--dry-run` が指定されていれば `/quiz-refine --dry-run`
- `--full` が指定されていれば `/quiz-refine --full`
- `--team` が指定されていれば `/quiz-refine --team`

（引数の組み合わせはそのまま渡す。例: `/quality-loop --team --full` → `/quiz-refine --full --team`）

## Step 3: 最終ゲート

**常に実行**（Step 1・2 で変更が加わった場合のみ意味があるが、コストが低いため常に走らせる）:

```bash
bun run check
```

typecheck + lint + test + `quiz:check` + `quiz:lint:dry` を一括実行する統合スクリプト。
これが失敗する場合は push してはならない。

**時間・環境が許す場合の追加チェック（任意）:**

```bash
bun run test:e2e   # Playwright E2E（開発サーバーが必要）
```

E2Eは環境依存（ブラウザ・devサーバー）のため、失敗してもゲート自体はブロックせず「要確認」として報告する。

## 結果レポート

```
## Quality Loop 結果

| ステップ | 結果 | 詳細 |
|---------|------|------|
| 0. 決定論的チェック | 完了 | quiz:check OK, lint N件指摘, cross-check N件 |
| 1. code-review | 完了/スキップ | Critical N件, High N件 |
| 2. quiz-refine | 完了/スキップ | N問検証, N件修正/フラグ |
| 3. 最終ゲート | ✅ PASS / ❌ FAIL | bun run check の結果 |

### 実行モード
- 逐次 / チーム
```
