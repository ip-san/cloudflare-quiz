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

## distractor-too-short lint の誤検知（H. 不正解選択肢の妥当性）

- 「選ぶべき値/名称そのものが短い」設問（製品名: `D1`/`R2`、件数: `100件`、演算子: `$eq`）では、正解も不正解も自然に短くなる。
  この形の設問で不正解だけが8文字未満だからといって「ヒントになる短さ」ではない — 実際に kv-001/kv-010/d1-002/pg-004/ar-001/ai-015
  の10件をレビューしたが、いずれも正解自体が短く、不正解が特別に短いわけではなかった（2026-07-22 確認）
- 対策として `quiz-lint.mjs` の `distractor-too-short` は「正解が15文字以上なのに不正解が8文字未満」の場合のみ検出するよう変更済み（2026-07-22）。
  正解と不正解の**長さの対比**が本質であり、絶対的な短さ自体は問題ではない

## format-giveaway（正解だけバッククォート含有）は未修正の既知課題

- d1-009 / r2-003 / dq-004 / r2-013 / pg-015 の5問は、正解が実在のCLIコマンド/設定キーを引用してバッククォート付きなのに対し、
  不正解は「存在しない仕組み」を説明する散文でバッククォートが付かない、という構造的パターン。機械的な文字列置換では直せない
  （不正解に自然な形で技術用語を足すには文面の書き換えが必要）。`/quiz-refine` の次回実行時、内容レビューとして人間の判断で
  手直しすること（2026-07-22 時点で未着手）
