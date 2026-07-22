# Quiz Refine — 検証チェックリスト

検証エージェントは各問題に対して A-J を順に適用する。

## A. 事実の正確性

検証対象フィールドは **question・options[].text・explanation・options[].wrongFeedback の全て**。

- question に含まれる前提・数値・製品名がドキュメント（`.claude/tmp/docs/`）と一致しているか
- 正解選択肢がドキュメントの内容と一致しているか
- explanation が正しい情報を含んでいるか
- wrongFeedback がドキュメントと矛盾していないか

### A-1. 正解妥当性の能動的検証（最優先・doc ドリフト対策）

`quiz-lint`/`quiz-fact-check` のフラグ有無に関わらず、**correctIndex/correctIndices が指す正解そのものが現行ドキュメントで本当に正しいか**を毎回確認する。機械チェックは「ありえない token」を持つ distractor は拾えるが、**正解が静かに古くなった（Cloudflare側の仕様変更によるドリフト）問題は検出できない**。

- **真の正解が選択肢に存在しないケースを最重視**（ユーザーが正しい知識で選んでも不正解になる = 最悪の体験）
- 料金・無料枠・上限（platform/limits, pricing 系ページ）、デフォルト値、compatibility flag の挙動は変更頻度が高いため特に注意
- multi-select は **correctIndices に漏れがないか**（実在の有効手段を不正解扱いしていないか）も確認
- **severity:** 正解そのものが事実誤り/真の正解が選択肢にない = **critical**。正解は妥当だが古い挙動を含む = **major**

### A-2. 権威ソースは個別ページを優先

`.claude/tmp/docs/<page>.md`（`fetch-docs.mjs` が取得した生ファイル）を最終権威とする。同じトピックを扱う複数ページで記述が食い違う場合は、referenceUrl が指す個別ページを優先する。

### A-3. 修正適用前の二重確認（エージェント指摘の検証）

並列検証エージェントの指摘は**そのまま適用せず、必ず自分でドキュメントを再照合してから修正する**。「正解が誤り」という指摘ほど偽陽性のコストが高い。

## B. 用語・名称の正確性

- API・CLIコマンド・設定キーが正式名称か（例: `wrangler.jsonc` であり `wrangler.json.c` ではない）
- 設定ファイル名やパスが正しいか（`wrangler.toml` / `wrangler.jsonc` / `.dev.vars`）
- 大文字・小文字の一致: 技術用語はドキュメントの表記を正確に転記

## C. リファレンス URL の有効性

- referenceUrl が `https://developers.cloudflare.com/` 配下の実在ページか
- アンカー（`#...`）がページ見出しと一致するか（`bun run quiz:lint:url` で機械チェック可能。ただし commands 系リファレンスページなど custom コンポーネントで見出しを構成しているページは誤検知しうるので手動確認）
- referenceUrl の参照先が問題内容に最も直接的か

## D. 内部一貫性

- question ↔ explanation の整合性
- explanation ↔ wrongFeedback の整合性
- wrongFeedback 同士の整合性

## E. バッククォート書式

コード用語・ファイルパス・コマンド・環境変数・設定キーがバッククォートで囲まれているか。
対象: wrangler CLIコマンド、Workers ハンドラ名(`fetch`/`scheduled`/`queue`/`email`/`alarm`)、ファイルパス、wrangler.toml/jsonc の設定キー、`CLOUDFLARE_*`/`CF_*` 環境変数、CLIフラグ。

**よく見落とされるパターン:**

- コード断片（option テキストがそのままコード行）の内部は、部分的にバッククォートを足すと逆に読みにくくなる。断片全体をバッククォート化するか、変更しないかのどちらかにする
- 環境変数=値: `ACCOUNT_ID` だけでなく `ACCOUNT_ID=xxxx` のように値も含めてバッククォート内に収める

## F. wrongFeedback 品質

- 「`X`ではありません。」だけの一行は品質不足（severity: info で記録のみ）
- 正しい挙動・正しい値が何かを教える内容であるべき
- **文字数目安:** 20文字以下の wrongFeedback は info severity で記録（`quiz:lint quality` の `weak-wrongFeedback` と対応）

## G. 解説の教育的価値

- explanation が正解の言い換えだけでなく、**なぜそうなのか**（Cloudflareのアーキテクチャ・仕組み）を含んでいるか
- 不正解選択肢が間違いである理由に触れているか
- 学習者が「次回同様の問題を見たとき判断できる知識」を得られる内容か
- **severity:** critical=10文字以下, major=正解のリフレーズのみ（理由なし）, info=理由あるが他選択肢に触れず

**このプロジェクトでの運用上の注意（2026-07-22、全162問レビューで確認）:** 「不正解選択肢が間違いである理由に触れているか」は、
このアプリでは各 `options[].wrongFeedback` が個別に担当する設計になっている（`quizContentQuality.test.ts` が全不正解に
wrongFeedback必須を強制）。そのため大半の質問で explanation 自体は正解の仕組みだけを説明し、個々の不正解への反論は
wrongFeedback に委ねている——これは欠陥ではなく意図した役割分担であり、`info` フラグが立っても explanation に
wrongFeedback の内容を重複して書き足す必要はない。修正すべきなのは、wrongFeedback 側にも反論が存在しない場合、または
explanation と wrongFeedback が矛盾している場合のみ。

## H. 不正解選択肢の妥当性（Distractor Quality）

- 各不正解選択肢が「ありそうだが間違い」の水準を満たしているか
- 正解だけが著しく長い/具体的で、不正解が明らかに雑なフィラーになっていないか
- 技術的に全く関係のない選択肢がないか
- **severity: info**（機械チェック `bun run quiz:lint:distractor` と併用。既知の指摘は流用してよい）

## I. ダイアグラムの品質（diagrams フィールド）

- タイプが概念に合っているか（14タイプ: hierarchy/flow/cycle/comparison/terminal/config/network/sequence/layer/swimlane/venn/matrix/tree/formula/keyboard — 詳細は `src/infrastructure/validation/QuizValidator.ts` のスキーマ参照）
- データフィールド内容が explanation と一致しているか
- `label`/`sub` が正確か（sub は25文字以内推奨）
- **参照整合性**: network の edges→nodes id、sequence の messages→actors インデックス、venn の sets が2〜3個
- **マーカーチェック**: `{{diagram:N}}` が `diagrams[N]` に対応、範囲外参照なし
- **冗長性**: 解説80字未満で図が繰り返し → 削除提案。**過密**: comparison列5+、flow/hierarchy要素6+、network ノード8+、sequence メッセージ10+ → 簡略化提案
- **途中切れ禁止**: ダイアグラム本文に `…`（日本語三点リーダー）や文中の `...` を入れない。`bun run quiz:check-ellipsis`（`quiz:check` に統合済み）が検出する
- **comparison vs hierarchy**: `comparison.columns[].items[]` は完全文で 80 文字以内。長い説明を載せたい場合は `hierarchy`（`items: [{text, sub}]`）を使う
- **flow.text/sub の文分断禁止**: `flow.steps[].text` と `sub` を 1 つの文の前半／後半に割らない
- **hierarchy.text の長文禁止**: `hierarchy.items[].text` は **40 字以内**の短いラベル
- **severity:** major=ドキュメント不一致/マーカー範囲外/ID参照不一致/途中切れ/flow文分断/hierarchy長文, info=改善提案

## J. ダイアグラム追加の検討（diagrams なしの問題）

- explanation に手順/階層/比較/循環/接続/時系列/包含/並列/重なり/グリッド/ツリー/計算のパターンがあれば追加提案
- **優先ルール**: 包含→`layer`, 複数アクター→`sequence`, 双方向→`network`, 概念重なり→`venn`, 並列→`swimlane`, 2軸→`matrix`, ディレクトリ→`tree`, 計算式→`formula`
- 追加しない場合: 解説80字未満 / 抽象的で視覚化効果薄 / 単純な事実記述のみ
- **severity:** info（提案のみ）。フォーマット: `[diagram-proposal] {id}: {type} - {label} ({理由})`
