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
  実際のアンカー（live HTML の `id="..."` 属性）を確認してから referenceUrl を書き換えること。
  live 検証済みのビルド時生成アンカーは `topic-config.mjs` の `VERIFIED_LIVE_ANCHORS` に登録すれば
  `quiz:lint:url` の誤検知から除外できる（d1/wrangler-commands の12アンカーを2026-07-22に登録済み。
  未検証のアンカーを登録するとリンク切れを覆い隠すため、必ず live HTML で確認してから追加すること）
- `<WranglerCommand command="X" />` コンポーネントはページ内に見出し（`id="X"`）を生成するが、Markdown ソースには `#` 見出しとして現れない。
  `quiz-lint.mjs` の `extractDocAnchors()` は component の `command=` 属性も見出し候補として拾うよう対応済み（2026-07-21）
- **fact-check の2つの偽陽性パターンを機構化済み（2026-07-22）**: ①クイズが例示引数付きでコマンドを引用する
  （`wrangler secret put API_KEY`）とドキュメント側の例示値（`FOO`）と一致せず未検出になる → 末尾の引数らしき
  トークン（ALL_CAPS・`<placeholder>`・数値・`my-xxx`）を1つずつ削って再検索する `searchWithArgStripping` で解消。
  ②「旧`wrangler publish`」のような歴史的言及は旧名称を引用せざるを得ない → `HISTORICAL_MARKERS`
  （topic-config.mjs、quiz-lint の skipIfHistorical と共通化）による抑制で解消。
  これ以降 fact-check の未検出用語が正解選択肢・explanation に登場する場合は真正の要調査項目
  （誤答選択肢のみに登場する未検出用語は「実在しないコマンドを誤答に使う」意図的パターンで正常）

## distractor-too-short lint の誤検知（H. 不正解選択肢の妥当性）

- 「選ぶべき値/名称そのものが短い」設問（製品名: `D1`/`R2`、件数: `100件`、演算子: `$eq`）では、正解も不正解も自然に短くなる。
  この形の設問で不正解だけが8文字未満だからといって「ヒントになる短さ」ではない — 実際に kv-001/kv-010/d1-002/pg-004/ar-001/ai-015
  の10件をレビューしたが、いずれも正解自体が短く、不正解が特別に短いわけではなかった（2026-07-22 確認）
- 対策として `quiz-lint.mjs` の `distractor-too-short` は「正解が15文字以上なのに不正解が8文字未満」の場合のみ検出するよう変更済み（2026-07-22）。
  正解と不正解の**長さの対比**が本質であり、絶対的な短さ自体は問題ではない

## correct-too-long lint の高い誤検知率（H. 不正解選択肢の妥当性）

- 「正解が不正解平均の2倍以上かつ30文字超」で検出していたルールは、2026-07-22時点で **41件**を検出していたが、
  全件を精読した結果ほぼ全てが「正解はCloudflareの実際の挙動を正確・詳細に説明する必要があり自然に長くなる一方、
  不正解は単純な誤った主張なので短くなる」という正当なパターンだった（例: wk-004, wk-007, dq-005, ai-003, ar-010等）。
  不正解はいずれも具体的で明確に間違った主張であり「手抜きの穴埋め」ではなかった — このギャップはコンテンツの欠陥ではなく、
  正確さを追求した結果の自然な非対称性であり、長さを揃えるために正解を削るか不正解を水増しするのは品質を下げる本末転倒な対応
- 対策として閾値を「正解が不正解平均の2.5倍以上かつ60文字超」に引き上げ、41件→12件のノイズを削減（2026-07-22）。
  残り12件も個別レビュー済みで、いずれも同じ正当なパターン（dq-005, ai-003 等）。将来このルールを更に調整する場合、
  「不正解の中に明らかに投げやりな穴埋め文言があるか」という質的判断が本質であり、文字数比だけでは代替できないことに留意

## difficulty mismatch: レビュー済みの妥当な再分類と、意図的に据え置いたケース

- ヒューリスティック（10件フラグ）を全件レビューし、6件は実際にラベルが不適切だったため再分類:
  `wk-012`/`d1-012`/`r2-012`/`pg-017`: advanced→intermediate（正確だが「詳細な数値・仕様を知っているか」の recall 問題であり、
  複数の設計判断を比較検討させる真の advanced 問題ではなかった）、`ar-001`/`ai-013`: beginner→intermediate（4製品のトレードオフ比較や
  SSEプロトコル詳細など、初心者向けとは言えない内容だった）（2026-07-22）
- 残り4件（`dq-011`, `dq-012`, `kv-017`, `kv-018`）は **advanced のまま据え置き**。ヒューリスティックは beginner を示唆するが、
  レビューの結果いずれも「複数のAPI/概念の使い分け」や「内部動作の因果関係」を問う設問で、advanced ラベルの方が適切と判断した。
  このヒューリスティックはこの4問のような「短い問い方だが実は深い理解を要求する」問題を過小評価する傾向があるとわかったが、
  4件だけを根拠に判定式全体を作り直すのは時期尚早のため、判定式は変更せず個別の既知の誤検知として記録するに留めた

## format-giveaway（正解だけバッククォート含有）は意図的に未修正

- d1-009 / r2-003 / dq-004 / r2-013 / pg-015 の5問は、正解が実在のCLIコマンド/設定キーを引用してバッククォート付きなのに対し、
  不正解は「存在しない仕組み」を説明する散文でバッククォートが付かない、という構造的パターン
- 5問すべてを検討したが、不正解に自然な形でバッククォート付き技術用語を足す余地がなかった（不正解は「R2は直接アクセスできず
  必ずプロキシを経由する」のような完全に架空の制約の説明であり、実在しないAPIをでっち上げてバッククォート付きで書くと、
  学習者が実在する構文だと誤解するリスクの方が「正解を当てやすくなる」リスクより大きいと判断した）。よって2026-07-22時点では
  意図的に手を加えていない。もし将来的に手直しするなら、不正解の技術的な具体性を（架空の構文を発明せずに）文章で補強する方向で
  検討すること

## 2026-07-22 全カテゴリ能動的検証（A-1）— 発見した doc drift / 内部矛盾

`/quiz-refine` の A-1（正解妥当性の能動的検証）に基づき、lint フラグに関わらず全162問をカテゴリ別に
`.claude/tmp/docs/` のキャッシュと突き合わせて検証した（9カテゴリ、並列エージェント）。以下7件を確認の上で修正した。
残り155問は現行ドキュメントと矛盾なし。

- **wr-001 / wr-005（major）**: `wrangler init` の説明が「ローカルにひな形を作るだけでデプロイしない」
  「フレームワーク統合を提供しない」という前提だったが、`workers__wrangler__commands__workers.md` の `## init`
  セクションで `wrangler init` は現在 create-cloudflare-cli（C3）を呼び出すラッパーになっており
  「A variety of web frameworks are available... with the option to deploy your project immediately」と明記されている
  ことを確認。explanation / wrongFeedback を「フレームワーク選択・即時デプロイのオプションもある」という現行仕様に修正
- **kv-007（minor）**: explanation内の `cacheEveriching` は `cacheEverything` のtypo（同じ問題の diagram では正しく
  綴られていた）。修正済み
- **r2-011（minor）**: 不正解の wrongFeedback が「R2は強整合性が求められる用途に向かない」としていたが、
  `r2__api__workers__workers-api-reference.md` は "R2 writes are strongly consistent" / "R2 deletes are strongly
  consistent" と明記しており矛盾。理由を「強整合性はあるが高頻度小サイズの読み書きにはKV/DOの方が適する」に修正
- **d1-012（major）**: Time Travel の保持期間「過去30日以内」が Workers Paid プラン限定の数値で、
  `d1__reference__time-travel.md` L136 に "up to 30 days in the past (Workers Paid plan) or 7 days (Workers Free
  plan)" と明記されている。正解選択肢と explanation にFree/Paidの違いを明記するよう修正
- **ar-013（minor）**: 「WorkerがリクエストをインターセプトするとBypassポリシーが機能しないことがある」という説明が、
  `cloudflare-one__access-controls__policies.md` の実際の条件（デバイスポスチャチェックを含むBypassポリシーに限定される
  制約）を一般化しすぎていた。条件を明記するよう修正
- **pg-017（major）**: ビルドキャッシュが「自動で有効・デプロイ再試行時にキャッシュなしを選べる」という説明だったが、
  `pages__configuration__build-caching.md` は Settings > Build > Build cache で明示的に Enable する必要があり、
  クリアも同じ設定画面の Clear Cache から行うと明記（デプロイ時の再試行オプションではない）。正解選択肢・wrongFeedback・
  explanation を実際のUI操作に合わせて修正

検証で cache が navigation stub / partial 未フェッチのため確証を得られなかった項目（pg-010/pg-011 の `_headers`/
`_redirects` partial、pg-016 の Node.js バージョン指定ページ）は、当初は矛盾は見つからなかったが完全な裏付けも
取れなかったため未検証として記録していた。**→ 2026-07-22に partial / データソースを直接フェッチして全て確証済み:**

- pg-010（`_headers`）: `partials/workers/custom_headers.mdx` で「カスタムHTTPレスポンスヘッダーの付与」を確認。正解・図とも正しい
- pg-011（`_redirects` の splat / デフォルト302）: `partials/workers/redirects.mdx` に `code <Type text="number" /> (default: 302)`、
  `*` → `:splat`、「You may only include a single splat」を確認。正解・explanation（省略時302）とも正しい
- pg-016（Node.js バージョン指定）: ビルド環境データ `src/content/pages-build-environment/v2.yaml` に
  `name: Node.js / environment_variable: "NODE_VERSION" / file: [".nvmrc", ".node-version"]` と明記。正解は完全に正確。
  ただし referenceUrl が実際の記述ページ（`pages/configuration/build-image/#override-default-versions`）ではなく
  `build-configuration` を指していたため、より直接的な参照先に修正した（VALID_DOC_PAGES / DOC_PAGES にも `build-image` を追加）

**教訓:** `<Render file="..." />` / `<Component />` でコンテンツを注入している doc ページは、`.claude/tmp/docs/` の
フラットキャッシュだけでは中身を検証できない。stub ページに当たったら `src/content/partials/` や
`src/content/<data-dir>/*.yaml` を直接フェッチして裏を取ること（fetch-docs.mjs の DOC_PAGE_OVERRIDES と同じ発想）。

## 2026-07-22 全カテゴリ G/I レビュー — 発見した diagram バグ・型不一致

チェックリスト G（解説の教育的価値）・I（ダイアグラム品質）で全162問を並列エージェントでレビューした。

**修正した major/実質的な不具合:**

- **wk-012（major、実バグ）**: `formula` ダイアグラムの `operator` が `"="` になっており、コンポーネントが2つの場合
  `FormulaDiagram.tsx` のレンダリングでは「リクエスト処理の総経過時間＝外部API/DBへのI/O待ち時間＝課金対象のCPU時間」
  という誤った等式として表示されてしまう（実際は「総経過時間 − I/O待ち時間 = 課金対象のCPU時間」）。`operator: "−"`
  に修正
- **wk-018（major）**: `hierarchy.items[1].text` が42文字でチェックリストの40字上限を超過（`node scripts/quiz-utils.mjs
  check-diagram-text` でも検出）。「KV / D1 / R2 / Durable Objectsのバインディング呼び出し」→
  「バインディング呼び出し(KV/D1/R2/DO)」に短縮
- **wr-001 / wr-005（major）**: 同日先に修正した「wrangler init が今はC3をラップする」テキスト修正が、対応する
  ダイアグラム（wr-001のterminal例、wr-005のcomparison表）に反映されておらず、図だけが古い挙動（フレームワーク選択なし・
  デプロイなし）を示したままになっていた。**テキストを直したら、対応する図も同じPRで直すこと**（今回のような修正漏れの
  再発防止のため明記）
- **pg-017（major）**: 同様に、ビルドキャッシュが「自動有効」から「要Enable」に本文を修正した際、`{{diagram:0}}` の
  flow図にEnable手順が反映されておらず、図だけが自動有効であるかのような手順を示していた。Enableステップを追加

**修正した info（ダイアグラムtype不一致）:**

- **dq-006**: `layer`型（上下の依存関係を示す）が使われていたが、実際は独立した4つの機能の並列列挙だったため `hierarchy`
  型に変更
- **r2-015**: `formula`型（加算的な内訳）が条件分岐（ETag一致→返す/不一致→null）に誤用されていたため `flow` 型に変更
- **kv-002**: `flow`型（順序性を暗示）が独立したCRUD4メソッドの列挙に使われていたため `hierarchy` 型に変更
- **kv-006**: `flow`型が「アンチパターン vs 対処法1 vs 対処法2」という並列の選択肢比較に使われていたため `comparison`
  型に変更

**修正した info（explanationの記述漏れ）:**

- **ar-010**: 比較図が「Workerを経由する分コストが増える」というトレードオフを示していたが、explanation本文がそれに
  一切触れていなかったため、該当する一文を追加

**教訓:** G の「不正解に触れているか」は、このアプリでは wrongFeedback フィールドが個別に担当する設計であり、
explanation 単体で見ると60問以上が`info`判定になった。これは欠陥ではなく意図した役割分担と判断し、checklist.md に
運用上の注記を追記した（explanation への内容重複は不要、wrongFeedbackとの矛盾がある場合のみ対応）。
