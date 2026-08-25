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

## バッチ執筆時の「正解が常に最長」パターン（H. 機械チェックが拾えない観点）

- 新カテゴリ hyperdrive-workflows の18問を追加した直後に4観点の独立検証エージェントを回したところ、
  **18問すべてで正解が最長選択肢**になっていた（自作コンテンツにありがちな偏り）。`quiz:lint:distractor` の
  `correct-too-long`（正解が不正解平均の2.5倍かつ60字超）は1問も発火しなかった — 各問の比率は2.2〜2.5倍で
  閾値以下だが、**バッチ全体で100%一致していること自体**が「最長を選ぶ」だけで全問正解できる攻略可能なシグナル。
  機械チェックは1問ごとの大きさしか見ないため、この横断的な偏りは原理的に検出できない
- 既存162問のベースラインを測定すると「正解が最長」は78%（カテゴリ別に50〜94%のばらつき）。100%は明確な外れ値だった。
  対策として、冗長な正解をexplanationに詳細を移して刈り込む＋一部の誤答にもっともらしい具体性を足して延長し、
  バッチを78%（14/18）まで戻した（2026-07-22）。**新バッチ追加時は `strict_longest` 比率をコーパス(~78%)と
  照合すること** — 個々の distractor lint 通過だけでは不十分
- 誤答を延長する際は、各 wrongFeedback と照合して「延長後も明確に偽のまま」であることを必ず確認する
  （偽の具体性を足すのが目的で、正解になりうる記述を足してはいけない）

## 自作コンテンツの独立検証で見つかった doc drift（hw-018、2026-07-22）

- 自分で執筆した hw-018 の explanation と図に「Cloudflare Queues のリトライの単位はメッセージ」と書いていたが、
  `queues/reference/how-queues-works` は「デフォルトはバッチ単位の all-or-nothing リトライ、明示的 ack で初めて
  個別メッセージ単位」と明記。しかも既存の dq-012（明示ackの目的を問う問題）とも矛盾していた。
  **自作コンテンツこそ独立した敵対的検証が要る**という好例（機械チェック・自己レビューは全て通過していた）

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

## format-giveaway（正解だけバッククォート含有）は意図的に未修正 → 2026-08-13に5問とも修正

- d1-009 / r2-003 / dq-004 / r2-013 / pg-015 の5問は、正解が実在のCLIコマンド/設定キーを引用してバッククォート付きなのに対し、
  不正解は「存在しない仕組み」を説明する散文でバッククォートが付かない、という構造的パターン
- 5問すべてを検討したが、不正解に自然な形でバッククォート付き技術用語を足す余地がなかった（不正解は「R2は直接アクセスできず
  必ずプロキシを経由する」のような完全に架空の制約の説明であり、実在しないAPIをでっち上げてバッククォート付きで書くと、
  学習者が実在する構文だと誤解するリスクの方が「正解を当てやすくなる」リスクより大きいと判断した）。よって2026-07-22時点では
  意図的に手を加えていない。もし将来的に手直しするなら、不正解の技術的な具体性を（架空の構文を発明せずに）文章で補強する方向で
  検討すること
- **2026-08-13追記**: 上記の条件（架空の構文を発明しない）を満たす形で5問とも修正した。各問ですでに同じ問題内の別選択肢や
  wrongFeedbackに登場している実在の語彙を、不正解の文中に自然な形で追加しただけで、新規のAPI/コマンドは一切発明していない
  — d1-009「`.wrangler/state`は使われず」（正解・feedback双方に既出のパス）、r2-003「`Authorization`ヘッダーに含めた」
  （S3互換API署名の実在ヘッダー名）、dq-004「Consumer Workerが`send()`で」（実際はProducerのメソッドだが、役割を取り違えている
  という誤りの説明自体は変えていない）、r2-013「`curl`コマンドで」（選択肢内で元々言及されていた語）、pg-015「`wrangler pages
  deploy`のようなCLIコマンドは存在せず」（実在コマンドを『存在しない』と誤答させる定番のトラップパターン）。
  `quiz:lint:distractor`のformat-giveawayは0件になったことを確認済み

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

## 2026-07-22 新カテゴリ platform-services（px-001〜018）追加時の独立検証

hyperdrive-workflows に続く2件目の新カテゴリ追加。同じ4観点の独立検証エージェント（ファクトチェック×2グループ、
図+distractorレビュー）を並列起動した。

- **ファクトチェック（px-001〜018、全18問）**: 指摘なし。全問が `.claude/tmp/docs/` のキャッシュ（turnstile/images/
  stream/email-service/browser-run）と一致。スコープ抽出の過程で px-008 が誤って "stream" 関連として拾われたが、
  実際は Images バインディングのコード内変数名（`env.IMAGES.input(stream)`）に "stream" という語が含まれていただけの
  false positive だった（教訓: キーワード一致だけでスコープを決めるとこの種の誤検知が起きる）
- **strict_longest 比率の検証**: hw-* バッチで発覚した「正解が常に最長」問題の再発がないか、マージ前に確認済みだったため
  今回は 14/18 = 77.8%（コーパス全体 78.3% とほぼ一致）で外れ値なし。**新バッチのマージ前に必ずこの比率を測定する運用が
  定着し、実際に外れ値の再発を防げた**（対策が機能した最初の実例）
- **correct-too-long lint（px-007/012/013/016 の4件）**: 個別に精読した結果、既存13件と同じ「正解は複数の技術的事実を
  正確に記述するため自然に長く、不正解は明確に異なる誤った主張」という正当なパターンと確認。修正不要（既存の
  known-issues 「correct-too-long lint の高い誤検知率」セクションと同型の結論）
- **ヒントの giveaway（新規発見、checklist.md に K 項目を追加）**: px-008「input → transform → output の流れです」
  （正解のメソッドチェーン `input().transform().output()` をそのまま列挙）、px-010「『アダプティブ』がヒントです」
  （正解選択肢の「アダプティブビットレート」という語をそのまま抜き出し）の2件が、他の問題（px-004「使い捨て/時間制限」の
  ようなパラフレーズ）と比べて明らかに直接的だった。両方とも正解固有の語句を出さない言い換えに修正。
  **この観点は checklist.md の A〜J に存在しなかった** — 独立検証エージェントが自主的に見つけたもので、
  今後のために K. ヒントの品質として明文化した
- **図の軽微な省略（px-007の`blur`、px-011の初期リクエストステップ、px-016の「コンテンツ生成」用途）**: explanation の
  記述を図が完全に網羅していないが、矛盾ではなく単純化。severity info、修正不要と判断
- **correctIndex 分布**: 0が38.9%（7/18）、0+3で72%。40%閾値は超えないが偏り気味。今後さらにこのカテゴリを拡張する
  場合は再分散を検討すること

## 2026-07-22 K項目（ヒントのgiveaway）を既存176問に遡及適用 — 45%という高い検出率と対応

px-*で発見した K 項目を、以下2グループで遡及チェックした。

- **hw-*（18問）**: G（教育的価値）・I（ダイアグラム品質）とあわせてレビュー。指摘0件。機械チェック
  （`check-diagram-text`、marker範囲・参照整合性・文字数上限）も全問通過。既知のバグパターン（wk-012の
  formula演算子、type不一致、図と本文の同期漏れ）もhw-*には該当なしと確認
- **残り162問（hw-*/px-*を除く9カテゴリ）**: K項目のみ専用レビュー。**162問中73件（45%）**がgiveawayに該当と
  報告された。内訳: workers 8/18, wrangler 4/18, kv-cache 6/18, d1 6/18, r2 12/18, do-queues 13/18,
  pages-deploy 8/18, ai-vectorize 8/18, architecture 8/18

**45%という高い検出率を鵜呑みにする前に、まず設計意図を裏取りした**（A-3の精神をK項目にも適用）。
`QuizCard.tsx`でhintはデフォルト非表示・ユーザーの明示クリックが必要だが、`QuizSessionService.useHint`は
`hintUsed`を記録するのみで、スコア・XP・SRS・マスタリーレベルのいずれにも影響しない（唯一の表示は結果画面の
バッジ）。**ヒント閲覧に一切のペナルティがない**ため、直接的すぎるヒントは「ワンクリックで正解に到達できる」
実質的な抜け道になる。また既存コーパスを見ると言い換え型と直接開示型が混在しており、「アプリ全体で意図的に
直接開示スタイルを統一している」という仮説も成立しない（統一されたスタイルなら73件は仕様、混在なら
バッチごとの一貫性のばらつき＝真の指摘）。サンプル5件（ar-011, ar-012, r2-001, wk-002, dq-014）を自分で
選択肢と突き合わせて確認したところ、特に ar-011「Freeプランは2桁、Paidプランは5桁の数値です」はCloudflareの
知識が一切不要な桁数当てクイズになっており、r2-001「『S3』という単語がヒントです」は正解語をそのまま開示
——いずれも真の指摘と判断し、全73件を対象に採用。

**修正方針**: 正解選択肢に一意に出現する固有名詞・API名・メソッド名・数値パターンを直接引用せず、対象読者が
持つ一般常識の比喩（建物/倉庫/図書館などの喩え）か、対立軸を問いかけの形で示す言い換えに統一。「〜という
キーワードです」「〜が示す通り」のような正解語を名指しするラベル付けは全廃した。修正は73件分すべて
`options[].text`と`correctIndex`を突き合わせながら1件ずつ判断し、機械的な一括変換はしていない。

**教訓**: 新しいchecklist項目を追加したら、それを満たすのは新規追加分だけでなく既存コーパス全体である
必要がある。今回はpx-*(18問)で発見した観点が、既存176問に遡及すると45%という無視できない規模で該当した
——「新規追加分は毎回チェックしているから大丈夫」という思い込みは、チェック項目自体が後から増える限り
安全ではない。checklist.mdの項目を増やした際は、その場で全コーパスへの遡及適用を検討すること

## 2026-08-25 playtest — reviewerペルソナ初投入で「出典のない断定」を検出、layer図の誤ラベルも修正

**reviewer(上級)は0/223で一度も検証されていなかった。** 初回5問で1件、他ペルソナでは出なかった
種類の指摘が出た。実務者の目でしか見つからない欠陥があることの実証:

- **ac-012**: 解説が「Allowポリシーが1つでもあれば`CF_Authorization`クッキーを再利用でき、
  Service Authのみだと再利用できない」と条件分岐を断定していたが、**referenceUrl先にも、
  authorization-cookie のページにも、この記述が存在しない**（両方をライブfetchして確認）。
  正解自体は妥当だが根拠が無い断定だったため、ドキュメントに実在する記述
  （service-tokens L37「add the following to the headers of any HTTP request」）だけで
  成立する形へ、正解選択肢と解説の両方を書き換えた。
  → **教訓**: 「もっともらしいが出典が無い」記述は、正解が合っていると見逃されやすい。
    A項目の検証は正解の可否だけでなく、explanationの各文がreferenceUrl先で裏取りできるかまで見る

- **ar-007（layer図の誤ラベル）**: `LayerDiagram` は「◀ 外側が上書き / ベース ▶」を**常に**
  表示する実装だった。layer型14件を全数確認したところ、**本当に上書き関係なのは tn-011 の1件だけ**で、
  残り13件は包含・スタック・データフロー（app→Workers Logs→Tail Workers 等）であり、
  上書きの含意は事実に反していた。
  → HierarchyDiagram の `ranked` と同じ方式で `overrides?: boolean`（既定false）を追加し、
    tn-011 のみ true に。**これで hierarchy / layer の両方が「型に埋め込まれた意味を
    オプトインで表明する」形に揃った**

**この2件は同じ根**: 図の型が「順序・階層に意味がある」と決め打ちしていて、
データ側がそれを表明する手段を持っていなかった。今後 diagram 型を足すときは、
型が暗黙に主張する意味（優先度・上書き・時系列など）があるなら、それをデータ側で
オプトインさせる設計にすること。

## 2026-08-24 docsキャッシュ16日ぶり更新でドキュメントドリフトを検出 — critical 2件を修正

**発端**: `/quality-loop` の Step 0 で `fetch-docs.mjs --status` を確認したところ **537/539ページが
期限切れ(16.4日経過)**。それまでの検証は全て古いキャッシュに対して行われており、A-1が最重要とする
「doc ドリフト(Cloudflare側の仕様変更で正解が静かに古くなる)」が原理的に見えない状態だった。
539ページを再取得したところ、更新前は0件だったURLアンカー検証が**6件のリンク切れ**を検出し、
うち2件は**正解そのものが事実誤りになっている critical** だった

**教訓(運用ルール)**: `quiz:lint:url` / `quiz:fact-check` が「0件」でも、それは
**キャッシュが新しいことを前提にした0件**でしかない。`/quality-loop` や `/quiz-refine` の Step 0 では
必ず `node scripts/fetch-docs.mjs --status` でキャッシュ鮮度を確認し、期限切れが多数なら
先に `docs:fetch` を回すこと。キャッシュが古いまま「指摘0件」を根拠に「差分なし」と結論づけてはならない

**critical 1: rt-011(Realtime SFU DataChannels)— 正解が事実誤りに**
- 旧正解「SFU経由のDataChannelは一方向のみで、サブスクライバーからパブリッシャーへ送り返すことはできない」
- 現行docs `realtime/sfu/datachannels` に `## Return to publisher (canReply)` が新設され、
  L164「Set `canReply: true` when one subscriber needs to respond on the same channel」、
  L177「`canReply` applies only to `location: "remote"` DataChannels and defaults to `false`」、
  L178「At most one subscriber can have reply access for each publisher DataChannel」、
  L180「The publisher receives the replies. Other subscribers do not」
- → **真の正解が選択肢に存在しない状態**(A-1の最重要ケース)。正解・全wrongFeedback・explanation・hint・
  図(network に返信経路を追加)を現行仕様に書き換え、referenceUrl も `#return-to-publisher-canreply` へ

**critical 2: as-004(API Shield Schema Validation)— 問題の前提ごと廃止**
- 旧問題は「アクション(`Log`/`Block`/`None`)」を問うていたが、現行docsにこの3アクションの記述が**皆無**。
  ライブページでも確認 → **Schema Validation 2.0** へ移行し、旧モデルは
  `/api-shield/reference/classic-schema-validation/` に「Classic」として分離されていた
- 現行モデル(L24-30): アップロードで**常時オン(always-on)の検出**が生成され、
  「The detection does not mitigate traffic by itself」。`cf.schema_validation.uploaded.violated` を
  条件にした**WAFカスタムルールで強制**して初めて緩和される(検出と緩和の分離)
- → 設問文ごと現行モデルの理解を問う内容へ全面書き換え。**as-006 も正解文に「設定された`Log`や`Block`
  アクションも適用されない」という旧モデル依存の記述**があり、同時に修正(ボディサイズ上限の数値
  1KB/8KB/8KB/128KB 自体は L128-136 と一致しており変更不要)

**アンカーのみのドリフト2件(内容は現行docsと一致、URL修正のみ)**
- rt-012: `#subscriber-acknowledgment-gate-waitforack` → `#wait-for-subscriber-readiness-waitforack`
  (waitForAckの挙動自体は L98-104 と完全一致)
- as-003: `#process` → `#configure-an-uploaded-schema`(「APIやTerraform経由では操作を別途追加」は
  L36 と一致)

**lint の偽陽性を根治(ct-018 / as-008)**
- Cloudflareは見出しをリネームしても旧アンカーを `<span id="immediate-rollouts"></span>` や
  `<a id="add-validation-by-uploading-a-schema" />` として**互換用に残す**ことがある。
  `extractDocAnchors()` は `#` 見出ししか見ていなかったため、これらが全てリンク切れに見えていた
- → `<span|a|div ... id="...">` を拾う正規表現を追加。6件→4件に減り、ct-018・as-008 は誤検知と確定
  (as-008 は結果的に有効だったが、内容の裏取りは実施済み: L99「For custom logic, use
  `cf.api_gateway.fallthrough_detected`」)

## 2026-08-21 /quiz-refine — playtest変更問題4件+図監査concern2件を検証、ag-018の図追従漏れを修正

**検証対象の選び方**: `git diff`が空だったが、flagged 32件は2日前(08-19)に検証済みで docs キャッシュも
quizzes.json も無変更のため再検証をスキップ。代わりに「**前回のquiz-refine以降に内容が変わったが
A-J検証を受けていない問題**」を対象にした(playtest経由の ag-010/014/015/018)。差分ベースの incremental は
`git diff`(未コミット)だけでなく「前回検証以降のコミット」も見るべき — 同じ状況では `git log <last-refine>..HEAD`
で対象を拾うこと

**A(事実正確性): 6問すべて docs と完全一致、修正不要**
- ag-010: `ai-gateway/features/dynamic-routing` L36「Rate Limit: number of requests quotas (per your key,
  per period), switches to fallback」/ L37「Budget Limit: cost quotas」/ L34「Percentage: probabilistic,
  A/B testing and gradual rollouts」— 08-15にplaytest経由で追記した「確率的振り分けはPercentageの役割」の
  注記も L34 と完全一致
- ag-014: `worker-binding-methods` L103-108 の6パラメータ表と全一致(`id`は`_required_`、`skipCache`は
  `boolean`、`cacheTtl`は秒数)。08-16に hierarchy→comparison へ変えた図のグループ分け(キャッシュ制御/
  ログ制御)も、docs のリンク先(caching vs logging/custom-metadata)と一致
- ag-015: L130「All properties in the second argument are optional」/ L146「Retrieves details」/
  L156-158「Pass an optional provider name」と全一致
- ag-018: L19-29 + footnote2「On the free plan, the log storage limit applies to total logs across all
  gateways in your account」で正解の核心を裏取り
- **bi-009 は図監査(08-19)の C:concern が false positive**: 図の4項目は
  `remote-browser-isolation/known-limitations` L24-27 の「Website compatibility」節の**完全なリスト**
  (Webcam/mic・WebGL・Netflix&Spotify・H.265)。正解選択肢がそのうち3つを問い、図が4つ目(WebGL)も示すのは
  ミスマッチではなく「図が解説を補完して完全な知識を与える」意図した設計
- **ct-009 も false positive**: 「課金額=稼働時間×リソース使用量」の単純化式は、`containers/pricing` L16
  の課金単位が GiB-second / vCPU-second / GB-second である以上「時間×リソース」そのもの。かつ図の`sub`が
  「メモリ/ディスクは容量ベース、CPUはアクティブ使用ベース」と L25 の区別を明示しており厳密性も確保済み

**修正1件(ag-018, diagrams)**: 08-16に正解軸を「25MB/1か月/5件の丸暗記」から「ログ保存件数のプラン別
スコープ差」へ組み替えた際、**図が旧正解の数値3点セットのまま残っていた**(explanation の主題と図の主題が
ズレる = 直前に問われた論点が図にない)。既存図を消さずに、正解の論点を可視化する comparison を
`diagrams[0]` として追加し、マーカーを2箇所に配置(`{{diagram:0}}`=ログ保存のプラン別スコープ、
`{{diagram:1}}`=その他の主な制限値)。事実の追加・変更なし

**教訓**: 正解の軸を組み替える修正をしたら、**diagrams が旧軸のまま取り残されていないか必ず確認する**。
playtest-apply.mjs は単一フィールド単位で適用するため、explanation を変えても図は自動追従しない

## 2026-08-19 解説図の教育的品質サンプリング監査(15問・タイプ層化) — weak 0件

- 「回答後の解説図として機能しているか」を4基準(A正解支援/B付加価値/C整合性/D粒度)で
  learning-experience-reviewerが監査: **good 11 / acceptable 4 / weak 0**
- 機械面も確認済み: `{{diagram:N}}`マーカー不整合0件。マーカーなし69問(sc/wa/zr/atの直近4カテゴリ)は
  ExplanationWithDiagramsのフォールバックで解説末尾に表示されるため**表示漏れではない**(マーカーは
  インライン配置用のオプトイン。実運用は615/687問が末尾配置なので実質同じ挙動)
- acceptableの軽微懸念(非アクション、将来手直しの候補): wf-004(comparison各列1項目で薄い)、
  bi-009(図に正解選択肢に登場しないWebGLを含む — 事実としては正しい)、ct-009(課金式の単純化 —
  実際はメモリ/ディスクとCPUで課金ロジックが異なる。比喩としては許容)
- 図は回答前には一切表示されない(Feedback/ReaderCardのみで使用)ことも確認 — giveawayリスクなし

## 2026-08-19 hierarchy図の全数監査 — 優先度表示の系統的誤用を`ranked`フラグで解消

- playtest(ag-014/015)で発見した「HierarchyDiagramが常に『▲高優先/低優先▼』ラベル+ピラミッド描画を行う」
  問題について、hierarchy型全95件のラベル・itemsを全数確認した。**本当に優先順位を表すのは4件のみ**
  (ch-008 キャッシュ設定の優先順位 / cs-010 証明書タイプの優先順位 / gw-006 HTTPポリシー評価優先順位 /
  wf-012 パラノイアレベルの積み上げ)。残り91件は順序に意味のない列挙(「主なメソッド」「構成要素」等)や
  包含構造(lb-001, wp-002, ct-003等)で、優先度ラベルは事実に反していた
- データを91件書き換えるのではなく、スキーマ・描画側に `ranked?: boolean`(既定false)を追加して解決:
  ranked=true のときだけピラミッド+優先度ラベル+重要度グラデーション、それ以外は均一な縦リスト描画。
  上記4件のみ quizzes.json に `"ranked": true` を付与
- **今後 hierarchy を使う場合**: 優先順位・強弱が本当にある場合のみ `ranked: true` を付ける
  (generate-quiz-data/SKILL.md のタイプ表にも反映済み)。包含・階層構造なら ranked なしの hierarchy か
  layer / tree を検討

## 2026-08-19 /quality-loop 定期実行 — Step 0 flagged 21件+fact-check未検出19件の再検証（差分なし）

- `src/data/quizzes.json` に未コミット変更がなかったため、incremental モードは Step 0（quiz-lint/cross-check/fact-check）
  で `status: "flagged"` の21問（correct-too-long 17件、difficulty mismatch 4件）と、fact-check未検出語19件
  （9問: wr-005/008/010/011/013/016/017, ct-017, d1-013）を対象とした
- correct-too-long/difficulty mismatchは前回(2026-08-13)から1件も増減なく、既存の精読済み結論と一致
- fact-check未検出19件は全件、該当する不正解選択肢(`options[]`のうち`correctIndex`と異なるインデックス)にのみ
  出現することをスクリプトで確認（正解選択肢・explanationには一切登場しない）→「実在しないコマンドを誤答に
  使う意図的パターン」に該当し非アクション
- **d1-013のみ、正解選択肢(`wrangler d1 export --output=...` / `wrangler d1 execute`)自体がfact-check未検出**
  だったため、本ファイル冒頭の「D1のサブコマンド一覧は静的ソースが存在せず個別に手動確認すること」に従い
  `https://developers.cloudflare.com/d1/wrangler-commands/` をlive fetchして確認。`d1 export`(`--output`必須、
  `--local`/`--remote`/`--table`/`--no-schema`/`--no-data`)と`d1 execute`(`--command`/`--file`/`--local`/`--remote`)
  は共に実在するコマンドで正解記述と一致。一方、不正解選択肢が使う`wrangler d1 backup restore`は非実在
  （実際にはpoint-in-time復元は`d1 time-travel restore`という別名で提供されており、正解を「実在しないコマンド名の
  誤答」から正しく区別できる良い distractor であることも確認できた）。d1-013は事実正確性の観点で問題なし

## 2026-08-13 /quality-loop 定期実行 — Step 0 flagged 31件の再検証（差分なし）

- `src/data/quizzes.json` に未コミット変更がなかったため、incremental モードは Step 0（quiz-lint/cross-check/fact-check）
  で `status: "flagged"` の31問（correct-too-long 17件、difficulty mismatch 4件、fact-check未検出語 11問）を対象とした
- 全件、既存の本ファイルの記載（correct-too-long/difficulty mismatchの精読済み結論、fact-checkの
  「誤答選択肢のみに登場する未検出用語は正常」というルール）と一致することを確認。ドキュメントキャッシュ
  （`.claude/tmp/docs/`）は前回検証時から更新していないため新たなdocドリフトは原理的に発生し得ないが、
  A-1（正解妥当性）のスポットチェックとして kv-012（`workers__runtime-apis__cache.md` の413エラー/Set-Cookie除外の記述）、
  dq-011（`durable-objects__api__namespace.md` の idFromName/newUniqueId のレイテンシ差の記述）、
  kv-018（`cache__advanced-configuration__cache-reserve.md` の「30日、アクセスでリセット」の記述）の3件を
  実際にgrepで再照合し、いずれも完全一致を確認した
- 修正なし。既知の非アクション項目であることを再確認しただけの回。次回以降、この31件が再度flagされても
  同じ結論になる可能性が高いため、`/quiz-refine --full` のような能動的な全問スキャン（このファイルで未言及の
  問題を含む）を別途検討する価値がある
