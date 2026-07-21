# Known Issues — 過去の検証で発見された個別パターン

> このファイルは `checklist.md` の汎用原則を補足する **プロジェクト固有の具体例・教訓** です。
> 検証エージェントが「このパターンに該当しないか」を確認する用途で使います。
>
> 現時点では実績がないため空です。`/quiz-refine` や手動レビューで
> false-positive（機械チェックの誤検知）や true-positive（見つけにくかった実際の誤り）
> を発見したら、以下の形式でここに追記してください。日付と確認方法（どのドキュメントの
> どの記述で確認したか）を必ず添えること — 未検証の推測をここに書かない。

<!--
## セクション見出し（トピック名）

- 具体的な用語・値と、正しい内容。確認したドキュメントページと日付を明記
  （例: `r2/pricing/` で確認、2026-07-20）
-->

## wrangler コマンドリファレンスのページ構造（fact-check/url チェックの誤検知源）

- `workers/wrangler/commands/`（stub, `<DirectoryListing />`）、`r2/reference/wrangler-commands/`（`<Render file="wrangler-commands/r2">`）、
  `d1/wrangler-commands/`（`<WranglerNamespace namespace="d1">`）は**ナビゲーション/生成用ページ**で、実際のコマンド説明文は含まない。
  実体は `workers/wrangler/commands/workers/`（dev/deploy/init/tail/types等）、`workers/wrangler/commands/general/`（login/logout/auth等）、
  R2 は `src/content/partials/workers/wrangler-commands/r2.mdx`（`DOC_PAGE_OVERRIDES` で fetch-docs.mjs が直接取得）にある。
  D1 のサブコマンド一覧は静的ソースが存在せず（ビルド時に Wrangler の CLI スキーマから生成）、`known-issues` として記録する以外に検証手段がない
  → `wrangler d1 <subcommand>` 系の fact-check 未検出は個別に手動確認すること（2026-07-21、実際の developers.cloudflare.com HTML を fetch して確認）
- D1 のコマンドリファレンスの見出し `id` は **`d1-` プレフィックス付き**（例: `wrangler d1 export` の live アンカーは `#d1-export` であり `#export` ではない）。
  R2/Workers 系の他コマンドリファレンスにはこのプレフィックスがない（`#dev`, `#deploy` 等）— ページごとに規約が異なるので、修正時は必ず対象ページの
  実際のアンカー（live HTML の `id="..."` 属性）を確認してから referenceUrl を書き換えること
- `<WranglerCommand command="X" />` コンポーネントはページ内に見出し（`id="X"`）を生成するが、Markdown ソースには `#` 見出しとして現れない。
  `quiz-lint.mjs` の `extractDocAnchors()` は component の `command=` 属性も見出し候補として拾うよう対応済み（2026-07-21）
