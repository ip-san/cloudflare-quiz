# 誤答層の事実掃引 — バッチ用プロンプト（対象・出力先を差し替えて使う）

作業ディレクトリ: /Users/sesoko/Desktop/workspace/cloudflare-quiz
対象（18問）: wk-001 wk-002 wk-003 wk-004 wk-005 wk-006 wk-008 wk-009 wk-010 wk-011 wk-012 wr-001 wr-002 wr-003 wr-004 wr-005 wr-006 wr-007

## 背景

ヒント層は全756問を今日の基準で当て直しましたが、**誤答層は580問が9月上旬の一括検証のまま**です。
そして今日、その「検証済み」の中から**利用者に見える事実誤りが8件**見つかりました。
この掃引は、今日の基準で誤答層と解説を見直すものです。

## 今日見つかった誤りの型（同じものを探してください）

### 型1: 「そんな機能は存在しない」が事実に反する（54件中4件が該当した）

  `ac-014`  「Client Secret だけを変更する機能はありません」
            → **Rotate service token secrets が実在**した
  `d1-013`  「R2への自動レプリケーション機能はありません」
            → **Export D1 into R2 using Workflows が実在**した
  `lb-016`  「フェイルオーバー時の自動メール通知はありません」
            → **Load Balancing Health Alert は実在**（発火条件が違うだけ）＝**言い過ぎ**

**不在の証明は2つの形でしか成立しません。**
  (a) **機能の一覧がドキュメントにあり、そこに無い**（メソッド一覧・オプション表・コマンド一覧）
  (b) **ドキュメントが肯定文で不在を明言している**
**「手元の docs に書いていない」は根拠になりません。**

### 型2: 主語が広すぎる（今日見つかった誤りの大半がこれ）

**製品群・プラン・世代の3つが主語の範囲を狂わせます。**

  `rt-002`  「**Realtime** は Session と Track のみを扱う」
            → 正しいのは Realtime **SFU** だけ。RealtimeKit は participants を提供する
  `cx-005`  「3つの仕組みを組み合わせて判定している」
            → **3つ揃うのは Client-Side Security Advanced のときだけ**
  `cb-015`  「Test delivery はプランを問わず利用できます」
            → ライブ finding の送信には詳細の閲覧が要り、それは Enterprise 限定
  `em-001`  「Microsoft 365 は Microsoft Graph API」
            → docs は **Graph API または journaling** と述べている

**正解肢・誤答の本文・wrongFeedback・解説のどこに出てもこの型は起きます。**

### 型3: 古くなっている

  `bt-010`  正解肢と解説が異常検知エンジンを**現行として**並べていたが、
            docs は非推奨・新規オンボーディング停止と述べていた（誤りではないが古い）
  `ai-009`  解説が「`--preset` はドキュメントに記載がない」と書いていたが、**記載がある**


### 型4: docs のドリフトが設問を壊している（取り直しで実際に2件見つかった）

  `wk-009`  解説のパスが docs の改訂で変わっていた
  `dl-002`  新機能 Passive Detection の登場で「スキャン開始には DLP ポリシーが必要」が偽になった
  `lb-008`  「Custom rules は Geo steering と非互換」の一文がページから消え、
            **別ページが肯定文で逆を書くようになっていた**（反転）

**根拠にしていた文が cache に見当たらないときは、(1) キャッシュ全体を横断 grep、
(2) それでも無ければ公開ページ（raw.githubusercontent の production ブランチ）を
取得して確認。「消えた＝移動」とは限らず、反転していることがあります。**

### 型5: 根拠の移動（事実は不変、載っている場所が変わった）

  `wp-007`  引用元の節が custom-limits.md へ移動していた。**内容が docs のどこかで
            生きているなら設問は ok。docRefs を新しい場所で書き直すだけでよい。**

## 見る対象

各設問について、**正解肢の本文・誤答3つの本文・4つの wrongFeedback・解説・図(diagrams)の中の数値と製品名**を
docs と突き合わせてください。図の修正は `proposedDiagrams`（`{"index":N,"path":"columns[1].items[0]","from":"現行値","to":"新しい値"}`、`from` は現行値と完全一致が必要）で出せます（ag-013 で前例あり）。**ヒントは対象外**（今日全数を当て直し済み）。

## 判定

- `"ok"` … 誤りなし
- `"wrong"` … 事実に反する。`evidence`（「ファイル名 L行番号」＋肯定文）、
  `realReason`、書き直し案を出す
- `"overbroad"` … 誤りではないが主語が広い／古い。同様に書き直し案を出す

書き直し案は次のフィールドで出してください（**直す場所に応じて使い分ける**）:
  `proposedOptions`（4つ）＋ `proposedWrongFeedback`（4要素・正解位置は null）… 本文を直す場合
  `proposedWrongFeedback` のみ … 解説だけ直す場合（**単独で適用できます**）
  `proposedExplanation` … 解説文を直す場合
  `proposedQuestion` … 設問文を直す場合

## 直すときの必須手順: 同じ主張を設問の全フィールドで grep する

**今日3回起きた見落とし**(ai-009/cx-005/em-001): 誤った主張を1フィールドで直したのに、
同じ主張が同じ設問の別フィールド(解説・wrongFeedback・図・設問文)に残り、
**修正後の設問が自分自身と食い違う**状態になった。
wrong / overbroad と判定した主張は、その設問の question / options 4つ /
wrongFeedback 4つ / explanation / diagrams を必ず同じキーワードで grep し、
残る場所をすべて proposedXXX に含めること。1フィールドだけの修正案は不完全とみなす。

## 守る条件

- **`docRef` は「ファイル名 L行番号」をセットで書き、必ず該当ファイルを実際に開くこと。**
  **パスを推測しないこと**（`grep -rn` で本文を探すのが確実）。
  **手元の `.claude/tmp/docs/` に無いページが要るなら `node scripts/fetch-docs.mjs <path>` で取得。**
  登録外のページは公開ページの本文を保存して使ってよい（前例あり）。
- **正解肢を最長にしない。`correctIndex` は変えないこと。**
- **`check-polarity-skew.mjs` と `check-absolute-skew.mjs` は0件。増やさないこと。**
- 本文を変えたら **`wrongFeedback` も合わせて直すこと**（据え置くと利用者に
  「選んでいない話への反論」が出る。実際に起きた）。
- **`src/data/quizzes.json` を一時的にでも差し替えないこと。**
  検査は scratchpad か `git worktree` の使い捨てコピーで行うこと。

## 申し送り（手は入れず factCheckNote で報告）

- 担当外の設問の誤りに気づいたら、直さずに finding の `factCheckNote` に書く。
- 設問の根拠が **referenceUrl 外・DOC_PAGES 未登録のページにしか無い**場合も申し送り
  （dl-002 の教訓: 根拠ページがキャッシュ外だとドリフトを検出できない）。
- referenceUrl が正解肢の根拠と別のページを指している場合も申し送り（tn-003 の前例）。
- 「ヒントが誤答1つを名指しで否定」は**欠陥ではない**（基準で裁定済み・precision 0/5）。
  報告不要です。

## 出力

`/Users/sesoko/Desktop/workspace/cloudflare-quiz/.claude/tmp/playtest/verdicts-fact-1.json` に
`{"counts":{"total":18,"ok":N,"wrong":N,"overbroad":N},"findings":[...]}` として18件すべて書く。

各 finding: `quizId, verdict, whatWasChecked(見た場所), evidence, realReason,
proposedOptions / proposedWrongFeedback / proposedExplanation / proposedQuestion（要る場合）,
lengthCheck（本文を変えた場合）, docRefs`

**`ok` の場合も `whatWasChecked` に「正解肢・誤答3つ・wrongFeedback 4つ・解説を確認した」と
書き、根拠にしたページを `docRefs` に挙げてください。** 何を見て ok としたかが残らないと、
次の掃引が同じ場所をもう一度見ることになります。

**提出前に `node scripts/apply-sweep-verdicts.mjs <file> --dry-run` を通すこと。**
JSON の構文も検証すること。