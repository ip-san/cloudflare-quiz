---
name: quiz-refine
description: クイズの検証・修正。公式ドキュメントと照合してcorrectIndex/選択肢/解説を検証する。--dry-run で報告のみ。quiz refine、クイズ検証、問題レビュー
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
argument-hint: "[categories...] [--dry-run] [--full] [--team]"
---

# Quiz Refine Skill

クイズデータ（`src/data/quizzes.json`）を公式ドキュメント（developers.cloudflare.com）と照合し、
機械チェックでは拾えない「事実の正確性」「正解妥当性」「教育的価値」を検証・修正するスキル。

**自律実行ルール:** AskUserQuestion を使わないこと。判断に迷う場合はスキップしてログに記録し、次に進む。

## 関連ドキュメント（必要時に Read）

- **検証チェックリスト A-J**: `.claude/skills/quiz-refine/checklist.md`
- **既知パターン**: `.claude/skills/quiz-refine/known-issues.md`（false-positive/true-positive の蓄積）

## 引数パース

`$ARGUMENTS` を空白で分割する。

- `--dry-run` があれば報告のみ（修正しない）。なければ修正モード
- `--full` があれば全問スキャン。なければ未コミット変更のあった問題のみ（incremental）
- `--team` があれば Agent ツールでカテゴリ別に並列検証
- カテゴリ名（`workers`/`wrangler`/`kv-cache`/`d1`/`r2`/`do-queues`/`pages-deploy`/`ai-vectorize`/`architecture`）が含まれればそのカテゴリのみに絞る。指定なければ全カテゴリ

パース結果を最初に出力する: `Parsed: scan=MODE, dry_run=BOOL, categories=[...], team=BOOL`

## Step 0: 前処理（1つの Bash 呼び出しにまとめる）

```bash
node scripts/quiz-lint.mjs all --dry-run --json > /tmp/quiz-lint.json
node scripts/quiz-cross-check.mjs --json > /tmp/quiz-cross.json
node scripts/quiz-utils.mjs check
```

`.claude/tmp/docs/` が存在すれば（`ls .claude/tmp/docs 2>/dev/null | wc -l` で確認）、追加でファクトチェックも実行:

```bash
node scripts/quiz-fact-check.mjs --json > /tmp/quiz-fact.json
```

存在しなければ（0件）、`node scripts/fetch-docs.mjs` の実行を提案してスキップする（ネットワークが使えない環境もあるため必須にはしない）。

**quiz-lint.mjs / quiz-cross-check.mjs は常に exit code 0** — 出力される JSON はアドバイザリなので、
`process.exitCode` ではなく中身（配列の長さ）を見て判断する。

## Step 1: 検証対象の決定

- `--full`: 全問が対象
- incremental（デフォルト）: `git diff -U20 -- src/data/quizzes.json` を実行し、変更ハンク周辺に含まれる `"id": "..."` を抽出して対象とする。差分がなければ Step 0 の JSON 出力で `status: "flagged"` になっている問題の ID を対象に加える
- カテゴリ指定があれば、対象 ID を該当カテゴリの問題に絞り込む（`src/data/quizzes.json` の `category` フィールドで判定）

**対象が0件の場合は「検証対象なし」と報告して即座に終了する。**

## Step 2: ドキュメント取得

対象問題の `referenceUrl` から一意なページ名を集め、`.claude/tmp/docs/` に未キャッシュのものがあれば取得する:

```bash
node scripts/fetch-docs.mjs <page1> <page2> ...
```

（`fetch-docs.mjs` は `topic-config.mjs` の `DOC_PAGES` の `name` で受け付ける。`referenceUrl` からページ名を得るには、
`https://developers.cloudflare.com/` を取り除き、末尾の `/` とアンカー `#...` を除去する）

## Step 3: 検証

### 逐次モード（デフォルト）

対象問題を1問ずつ、以下の手順で検証する:

1. `src/data/quizzes.json` から該当問題を Read（`grep -n "\"id\": \"{ID}\""` で行番号を特定してから周辺を読むと効率的）
2. `.claude/tmp/docs/<page>.md` を Read（Step 0/1 の quiz-lint/fact-check の指摘があれば合わせて確認）
3. `checklist.md` の A-J を適用
4. **修正モード**: critical/major は `node scripts/quiz-utils.mjs edit {ID} {field} "{new value}"` で修正。minor/info はログに記録するのみ（修正しない）
5. **dry-runモード**: 全 severity をレポートに蓄積（ファイル変更なし）

### チームモード（`--team`）

カテゴリ別に `general-purpose` エージェントを並列起動する（**同一メッセージ内で複数 Agent 呼び出し**）:

```
Agent(
  description: "Verify quiz category {category}",
  subagent_type: "general-purpose",
  prompt: "cloudflare-quiz リポジトリの src/data/quizzes.json のうち category=\"{category}\" かつ
    ID が次のリストに含まれる問題を検証してください: {id_list}。
    .claude/skills/quiz-refine/checklist.md のA-Jを適用し、.claude/tmp/docs/ 配下の
    該当ドキュメントと照合してください。.claude/skills/quiz-refine/known-issues.md も
    参照してください。修正は行わず、JSON配列で {id, severity, field, issue, suggested_fix} を
    報告してください。"
)
```

全エージェント完了後、報告を集約し、**メインの会話が** critical/major を `quiz-utils.mjs edit` で適用する
（エージェントに直接ファイルを編集させない — 並列書き込みの競合を防ぐため）。

## Step Final: 後処理

**修正モードのみ**、1つの Bash 呼び出しにまとめる:

```bash
node scripts/quiz-utils.mjs randomize && node scripts/quiz-utils.mjs check && bun run test
```

テストが失敗した場合は原因を調査して修正を試みる。

**known-issues.md への追記:** 検証中に発見した false-positive（機械チェックの誤検知）や
非自明な true-positive があれば、`known-issues.md` の指示に従って追記する
（日付とドキュメント確認箇所を明記すること）。

## 出力形式

**修正モード:** `## Quiz Refine Complete` サマリー（対象数, 修正数, テスト結果）+ 修正一覧（ID, フィールド, 旧→新, 理由）

**dry-runモード:** `## 検証結果サマリー` + Critical/Major/Minor/Info の4段階テーブル（Quiz ID, 問題内容, 現在→正しい内容, 参照元URL）
