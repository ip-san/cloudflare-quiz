/**
 * 実践シナリオデータ
 *
 * 実務に即したストーリー形式で既存の問題を出題する。
 * questionId は quizzes.json の ID を参照する。
 *
 * 問題選定の方針は .claude/skills/generate-quiz-data/quality-rules.md の
 * 「実践シナリオの問題選定方針」を参照（ユーザーが実際に直面する判断か？が
 * 最初のフィルタ。全シナリオで問題の重複ゼロを維持する）。
 */

export interface ScenarioStep {
  readonly type: 'narrative' | 'question'
  readonly text?: string
  readonly questionId?: string
}

export interface ScenarioData {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced'
  readonly steps: readonly ScenarioStep[]
  readonly completionMessage: string
}

export const SCENARIOS: readonly ScenarioData[] = [
  {
    id: 'scenario-first-site',
    title: '会社サイトをCloudflareに載せる日',
    description: 'DNS・SSL・キャッシュ——導入初日に必ず通る3つの関門',
    icon: '🌐',
    difficulty: 'beginner',
    steps: [
      {
        type: 'narrative',
        text: '「サイトが重い、あとセキュリティも気になる」——上司の一言で、会社のWordPressサイトをCloudflareに載せることになった。ネームサーバーの切り替えは完了。ダッシュボードにはDNSレコードの一覧と、レコードごとにオレンジ色の雲のアイコンが並んでいる。\n\nこのオレンジクラウド、オンにするかどうかで挙動が全く変わるらしい。まずはここを理解しないと始まらない。',
      },
      { type: 'question', questionId: 'dn-003' },
      {
        type: 'narrative',
        text: 'プロキシの意味は分かった。ふと見ると、Webサーバーに向いているAレコードが1つだけグレークラウド(DNS-only)のまま残っている。「動いてるからいいか」と放置したくなるが——ここに落とし穴がある。',
      },
      { type: 'question', questionId: 'dn-007' },
      {
        type: 'narrative',
        text: 'レコードをプロキシ済みにした。次はHTTPS化だ。SSL/TLS設定を開くと暗号化モードの選択肢が並んでいる。「Flexibleなら証明書の用意が要らなくて簡単」という記事を見かけたが、先輩は「Flexibleは罠だから気をつけろ」と言っていた。どういうことだろう？',
      },
      { type: 'question', questionId: 'sl-002' },
      {
        type: 'narrative',
        text: 'なるほど、ブラウザに鍵マークが出ていても、エッジからオリジンまでが平文では意味が薄い。ちゃんとオリジン側にも証明書を置いて、検証まで行うFull (strict)を目指そう。ではオリジンに置く証明書には何が求められる？',
      },
      { type: 'question', questionId: 'sl-004' },
      {
        type: 'narrative',
        text: 'HTTPS化が完了した。最後に、そもそもの目的だった「サイトが重い」への対策——CDNキャッシュだ。Cloudflareを通しただけで何がキャッシュされるようになったのか、確認しておこう。',
      },
      { type: 'question', questionId: 'ch-001' },
      {
        type: 'narrative',
        text: '導入初日が終わった。DNSはプロキシ済み、通信は端から端まで暗号化、静的アセットはエッジから配信。翌朝、上司から「サイト速くなったね」とSlackが来た。オレンジクラウドの意味を知っているかどうか——それだけでこの結果の意味の理解度が全く違う。',
      },
    ],
    completionMessage:
      'Cloudflare導入初日を完走！プロキシ(オレンジクラウド)の意味、Flexibleの罠とFull (strict)への道、デフォルトキャッシュの範囲——導入時に必ず通る判断を一通り体験しました。',
  },
  {
    id: 'scenario-first-worker',
    title: '週末で作る、はじめてのWorkers API',
    description: 'wrangler login からデプロイまで、Workers開発の一連の流れ',
    icon: '⚡',
    difficulty: 'beginner',
    steps: [
      {
        type: 'narrative',
        text: '土曜の午後。趣味プロジェクトの静的サイトに「お問い合わせフォームのAPI」が欲しくなった。サーバーを借りるほどでもない。そこで、無料枠が大きいCloudflare Workersを試すことにした。\n\nWranglerはインストール済み。ただし、コードを書き始める前に最初にやることがある。',
      },
      { type: 'question', questionId: 'wr-013' },
      {
        type: 'narrative',
        text: '認証が済んだ。次はプロジェクトの雛形作りだ。空のフォルダで `wrangler init my-worker` を叩いてみる。',
      },
      { type: 'question', questionId: 'wr-001' },
      {
        type: 'narrative',
        text: '雛形ができた。いきなりデプロイする前に、手元で動かして試したい。開発中のコードをすばやく確認する方法は？',
      },
      { type: 'question', questionId: 'wr-002' },
      {
        type: 'narrative',
        text: 'ローカルで動いた。次はフォームの送信内容を保存したい。雛形の `fetch` ハンドラをよく見ると、第2引数に `env` というオブジェクトが渡されている。ドキュメントでも頻繁に登場するこの `env`——何者だろう？',
      },
      { type: 'question', questionId: 'wk-005' },
      {
        type: 'narrative',
        text: 'バインディングの考え方は分かった。実際にWorkers KVをこのWorkerから使えるようにするには、何をどこに設定すればいい？',
      },
      { type: 'question', questionId: 'kv-013' },
      {
        type: 'narrative',
        text: '保存もできるようになった。あとは世界に公開するだけ。デプロイコマンドを実行すると何が起こるのか、確認してから叩こう。',
      },
      { type: 'question', questionId: 'wr-003' },
      {
        type: 'narrative',
        text: '`https://my-worker.<サブドメイン>.workers.dev` にAPIが公開された。ここまで、サーバーの契約もOSのセットアップも一切なし。日曜日はフロントエンドからこのAPIを叩く実装に充てられそうだ。',
      },
    ],
    completionMessage:
      'はじめてのWorkers APIを公開しました！wrangler login → init → dev → バインディング設定 → deploy——この流れはWorkers開発の基本形として、どんなプロジェクトでも繰り返し使います。',
  },
  {
    id: 'scenario-cache-miss',
    title: '同じURLなのにキャッシュが効かない',
    description: 'キャッシュヒット率の急落をCache Keyの理解で解決する',
    icon: '📦',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '月曜の朝会で嫌な報告が上がった。「先週からオリジンサーバーの負荷が3倍になっています」。Cloudflareのアナリティクスを見ると、確かにキャッシュヒット率が80%台から30%台まで落ちている。\n\nまずは1リクエストを取り出して調べよう。レスポンスヘッダーの `cf-cache-status` に `BYPASS` という値が出ている。これは何を意味する？',
      },
      { type: 'question', questionId: 'ch-017' },
      {
        type: 'narrative',
        text: 'BYPASSの意味が分かったところで、そもそもCloudflareがレスポンスをキャッシュ「しない」と判断する条件を整理しておきたい。オリジン側の設定が原因のこともあるからだ。',
      },
      { type: 'question', questionId: 'ch-002' },
      {
        type: 'narrative',
        text: '調べを進めると、原因の一端が見えてきた。先週マーケティングチームがメール施策を打ち、すべてのリンクに `?utm_campaign=...&utm_source=...` が付いていたのだ。URLのパスは同じでも、クエリ文字列が1文字でも違えば別のキャッシュエントリになる——デフォルトのキャッシュキーがどう構成されているか、正確に理解しよう。',
      },
      { type: 'question', questionId: 'ch-010' },
      {
        type: 'narrative',
        text: '犯人はデフォルトキャッシュキーに含まれるクエリ文字列だった。utmパラメータはコンテンツに影響しないのだから、キャッシュキーから無視させればいい。カスタムキャッシュキーのクエリ文字列設定には、どんな選択肢がある？',
      },
      { type: 'question', questionId: 'ch-011' },
      {
        type: 'narrative',
        text: 'Cache Ruleでカスタムキャッシュキーを設定する方針が決まった。ついでに、キャッシュ対象の制御(Cache Eligibility)の仕組みも押さえておこう。',
      },
      { type: 'question', questionId: 'ch-004' },
      {
        type: 'narrative',
        text: 'ルールを書き始めると、既に別のCache Ruleが存在することに気づいた。同じリクエストに複数のルールがマッチしたら、どちらが勝つ？これを知らないと、せっかくのルールが「効いているつもり」になる。',
      },
      { type: 'question', questionId: 'ch-007' },
      {
        type: 'narrative',
        text: 'デプロイから1時間。キャッシュヒット率のグラフが80%台に戻っていくのをチームで眺めた。「同じURLなのにキャッシュが効かない」の裏には、ほぼ必ずキャッシュキーの理解不足がある。次に同じグラフを見たら、まず `cf-cache-status` とクエリ文字列を疑おう。',
      },
    ],
    completionMessage:
      'キャッシュヒット率の急落を解決！cf-cache-statusでの診断、デフォルトキャッシュキーの構成、クエリ文字列の制御、複数ルールの優先順位——キャッシュトラブルの定石を一通り体験しました。',
  },
  {
    id: 'scenario-under-attack',
    title: '攻撃が来た。5分で防波堤を築く',
    description: 'WAF・レート制限・Under Attackモードの実戦投入',
    icon: '🛡️',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '水曜の15時、監視アラートが鳴った。ログインエンドポイントへのリクエストが平常時の100倍。パスワードリスト攻撃のようだ。幸い、サイトはCloudflareを通している。\n\n落ち着いて対処するために、まずCloudflare WAFが持っている道具を整理しよう。',
      },
      { type: 'question', questionId: 'wf-001' },
      {
        type: 'narrative',
        text: '道具は3つ。まずはカスタムルールで攻撃元を止めたい。ルールにはBlockやChallengeなどのアクションがあるが、「終端アクション(terminating action)」という概念を理解していないと、ルールの並び順で事故る。',
      },
      { type: 'question', questionId: 'wf-003' },
      {
        type: 'narrative',
        text: 'ブロックルールを書いた。ところでBlockアクションが返すHTTPステータスコードは何番だろう？監視ダッシュボードでブロックの効果を確認するのに必要だ。',
      },
      { type: 'question', questionId: 'wf-007' },
      {
        type: 'narrative',
        text: '単発のブロックだけでは、攻撃元がIPを変えてくるいたちごっこになる。「一定時間内のリクエスト数」で自動的に制限するレート制限ルールを組もう。カウントの単位に `IP` と `IP with NAT support` があるが、この違いを知らないと正規ユーザーを巻き込む。',
      },
      { type: 'question', questionId: 'wf-014' },
      {
        type: 'narrative',
        text: "攻撃はまだ続いている。最後の切り札として、ログイン画面を含む管理系のパスだけ「I'm Under Attack」モードにしたい。サイト全体ではなく特定の条件でだけ設定を変えるには、どうすればいい？",
      },
      { type: 'question', questionId: 'ru-016' },
      {
        type: 'narrative',
        text: '16時前、攻撃のグラフは沈静化した。ブロックルール、レート制限、部分的なUnder Attackモード——3層の防波堤を15分で築けたのは、平時に道具の場所を知っていたからだ。インシデント対応の速さは、事前の理解の深さで決まる。',
      },
    ],
    completionMessage:
      '攻撃を撃退しました！終端アクションの概念、Blockのステータスコード、レート制限のカウント単位、Configuration Rulesでの部分的なUnder Attackモード——実戦で効く防御の組み立てを体験しました。',
  },
  {
    id: 'scenario-prod-incident',
    title: '本番のWorkerが壊れた夜',
    description: 'ログ調査 → 切り分け → ロールバック → 再発防止',
    icon: '🚨',
    difficulty: 'advanced',
    steps: [
      {
        type: 'narrative',
        text: '金曜21時。夕方にデプロイしたWorkerの新バージョンで、エラー率が急上昇しているとアラートが来た。デプロイしたのは自分だ。\n\nまずは状況を見たい。本番のWorkerで今まさに起きているエラーを、リアルタイムで見るには？',
      },
      { type: 'question', questionId: 'wr-010' },
      {
        type: 'narrative',
        text: 'ログは流れ始めた。特定のパスで例外が出ている。ただ、慌てて「コードのバグだ」と決めつけるのは危険だ。エラー率急上昇の原因を切り分けるとき、どういう順序で考えるべきか。',
      },
      { type: 'question', questionId: 'ar-017' },
      {
        type: 'narrative',
        text: '切り分けの結果、夕方のデプロイが原因である可能性が濃厚になった。深夜にバグを直してテストするより、まず正常だった直前のデプロイに戻すのが定石だ。最速の手段は？',
      },
      { type: 'question', questionId: 'wr-012' },
      {
        type: 'narrative',
        text: 'ロールバック完了、エラー率は平常に戻った。週明け、ポストモーテムで「ログを見始めるまでに時間がかかった」ことが課題に挙がった。次のインシデントに備えて、Workersの観測性(observability)の仕組みを整えておこう。',
      },
      { type: 'question', questionId: 'ar-007' },
      {
        type: 'narrative',
        text: '振り返れば、対応の流れは4手だった——tail でログを見る、思い込みを排して切り分ける、直前バージョンへ戻す、観測性を平時に整える。障害対応の実力は、ツールの知識と手順の身体化で決まる。金曜の夜にそれを実感した。',
      },
    ],
    completionMessage:
      '本番インシデントを収束させました！wrangler tailでのリアルタイムログ、エラーの切り分けの考え方、即時ロールバック、観測性の整備——障害対応の一連の流れを体験しました。',
  },
  {
    id: 'scenario-raspi-tunnel',
    title: '自宅のラズパイを世界に公開する',
    description: '固定IPなし・ポート開放なしで自宅アプリを公開し、家族だけに見せる',
    icon: '🏠',
    difficulty: 'beginner',
    steps: [
      {
        type: 'narrative',
        text: '自宅のRaspberry Piで家族写真の共有アプリを動かしている。実家の親にも見せたいが、ここで壁にぶつかった。自宅回線に固定IPはなく、ルーターのポート開放はセキュリティが怖くてやりたくない。\n\n調べると、Cloudflare Tunnelなら両方の問題を回避できるらしい。どういう仕組みでそれが可能になっているのか、まず接続の方向を理解しよう。',
      },
      { type: 'question', questionId: 'tn-001' },
      {
        type: 'narrative',
        text: '仕組みは分かった。これなら自宅ネットワークに穴を開けずに済む。早速ラズパイに `cloudflared` をインストールした。CLIでトンネルを作る手順は？',
      },
      { type: 'question', questionId: 'tn-004' },
      {
        type: 'narrative',
        text: 'トンネルができた。次は `photos.example.com` のような覚えやすいアドレスでアクセスできるようにしたい。トンネルとDNSをどう紐付ける？',
      },
      { type: 'question', questionId: 'tn-006' },
      {
        type: 'narrative',
        text: 'URLでアクセスできるようになった——が、このままでは世界中の誰でも家族写真を見られてしまう。インターネットに公開しつつ、アクセスできる人を制限したい。VPNを自前で立てるのは大げさだ。Cloudflareにはそのための仕組みがある。',
      },
      { type: 'question', questionId: 'ac-001' },
      {
        type: 'narrative',
        text: 'Cloudflare Accessで守れそうだ。では実際に、このトンネル経由のアプリをAccessの背後に置くには、何をどの順で設定すればいい？',
      },
      { type: 'question', questionId: 'ac-009' },
      {
        type: 'narrative',
        text: '設定完了。実家の親には「このURLを開いてメールアドレスを入れるだけ」と伝えた。固定IPなし、ポート開放なし、VPNなし——自宅のラズパイが、家族だけの写真館になった。サーバー代は電気代だけだ。',
      },
    ],
    completionMessage:
      '自宅サーバーの安全な公開を達成！Tunnelの接続の仕組み、トンネル作成、DNSルーティング、Accessによる保護——個人開発の定番構成「Tunnel + Access」を一通り体験しました。',
  },
  {
    id: 'scenario-r2-egress',
    title: '画像が増えてサーバー代が怖い',
    description: 'ポートフォリオの画像をR2へ移し、転送量の不安から解放される',
    icon: '💸',
    difficulty: 'beginner',
    steps: [
      {
        type: 'narrative',
        text: '写真ポートフォリオサイトが少しバズった。嬉しい悲鳴——のはずが、頭をよぎるのは「このままアクセスが増えたら転送量の請求はいくらになる？」という不安。高解像度の写真は1枚数MBある。\n\nクラウドのオブジェクトストレージを比較していると、個人開発者の間でCloudflare R2の名前をよく見かける。料金面での最大の特徴は何だったか。',
      },
      { type: 'question', questionId: 'r2-002' },
      {
        type: 'narrative',
        text: 'これなら「バズるほど請求が怖い」構造から抜け出せそうだ。早速試したい。Workersのコードを書く前に、まずコマンドラインでバケットを作って手元の写真を数枚アップロードしてみたい。',
      },
      { type: 'question', questionId: 'r2-013' },
      {
        type: 'narrative',
        text: 'アップロードできた。次は、この写真たちをサイトから参照できるように、インターネットに公開したい。R2のオブジェクトを誰でもアクセスできるようにする一般的な方法は？',
      },
      { type: 'question', questionId: 'r2-004' },
      {
        type: 'narrative',
        text: '新しい写真はR2に置くとして、問題は今のストレージに溜まった数千枚の既存写真だ。1枚ずつ手でアップロードし直すのは現実的ではない。Cloudflareは他社ストレージからの移行を支援する仕組みを用意している。',
      },
      { type: 'question', questionId: 'r2-016' },
      {
        type: 'narrative',
        text: '移行の目処が立った。最後に、そもそも今の規模なら無料でどこまで行けるのかを確認しておこう。R2の無料利用枠はどうなっている？',
      },
      { type: 'question', questionId: 'r2-012' },
      {
        type: 'narrative',
        text: '計算してみると、今のアクセス規模なら保存も配信もほぼ無料枠に収まりそうだ。「バズったらどうしよう」が「バズっても大丈夫」に変わった。安心して次の作品をアップロードできる。',
      },
    ],
    completionMessage:
      '転送量の不安から解放されました！R2の料金上の特徴、Wranglerでのバケット操作、公開設定、既存データの移行、無料枠——個人開発の財布を守るストレージ選びを体験しました。',
  },
  {
    id: 'scenario-storage-choice',
    title: '個人開発、DBどれにする問題',
    description: 'KV・D1・Durable Objects・R2——習慣トラッカーを題材に使い分けを整理',
    icon: '🗃️',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '習慣トラッカーアプリを個人開発することにした。Cloudflareのストレージ製品を調べると、KV・D1・Durable Objects・R2と選択肢が多く、どれに何を置くべきか分からなくなってきた。\n\nデータの種類ごとに整理しよう。まずはアプリの設定値——機能フラグやテーマ設定のような、頻繁には変わらないが世界中から読まれるデータだ。',
      },
      { type: 'question', questionId: 'kv-001' },
      {
        type: 'narrative',
        text: '次は本丸の習慣記録データ。「ユーザーごとの達成履歴を週別・月別に集計」「習慣と記録をテーブルで結合」——リレーショナルな集計クエリが必要になりそうだ。',
      },
      { type: 'question', questionId: 'd1-002' },
      {
        type: 'narrative',
        text: '将来的には「友達と同じ習慣に一緒に取り組む」機能も夢見ている。複数ユーザーの操作をリアルタイムに同期する必要が出てきたとき、KVでは足りない場面とは？',
      },
      { type: 'question', questionId: 'dq-002' },
      {
        type: 'narrative',
        text: 'ここまでの整理を、一度全体像として固めておきたい。設定・履歴・リアルタイム状態・画像(プロフィールアイコンなど)——データの種類ごとに最適なストレージを選ぶ判断基準は？',
      },
      { type: 'question', questionId: 'r2-011' },
      {
        type: 'narrative',
        text: '設計が決まった。設定はKV、記録はD1、リアルタイム同期は将来Durable Objects、画像はR2。まずはD1から手を動かそう。データベースを作ってWorkerから使えるようにする手順は？',
      },
      { type: 'question', questionId: 'd1-003' },
      {
        type: 'narrative',
        text: '`wrangler d1 create habit-tracker` ——最初のテーブルを作った瞬間、漠然としていたアプリが急に現実味を帯びた。ストレージ選びに正解を出せるようになれば、個人開発の設計で迷う時間は大きく減る。あとは作るだけだ。',
      },
    ],
    completionMessage:
      'ストレージ設計が完成！設定はKV・集計はD1・リアルタイムはDurable Objects・ファイルはR2——「どれに何を置くか」の判断軸は、どんなアプリを作るときにも使い回せます。',
  },
  {
    id: 'scenario-pages-blog',
    title: 'ブログに動的機能を足したくなった',
    description: 'Pagesの自動デプロイからFunctions・独自ドメインまで',
    icon: '📝',
    difficulty: 'beginner',
    steps: [
      {
        type: 'narrative',
        text: '静的サイトジェネレーターで作った技術ブログを、Cloudflare Pagesで公開している。GitHubにpushするだけで公開される手軽さが気に入っているが、その裏で何が起きているのかは実はよく分かっていない。まず仕組みを押さえよう。',
      },
      { type: 'question', questionId: 'pg-002' },
      {
        type: 'narrative',
        text: 'デザインを大きく変えたブランチを作った。本番に出す前に、実際のURLで表示を確認して友人に感想をもらいたい。Pagesにはそのための仕組みが最初から備わっている。',
      },
      { type: 'question', questionId: 'pg-003' },
      {
        type: 'narrative',
        text: 'デザイン刷新も無事マージ。次は読者からの感想を受け取る「お問い合わせフォーム」が欲しくなった。静的サイトだが、Pagesにはサーバー側のコードを追加する仕組みがある。`functions/` ディレクトリにファイルを置くと、どのURLで動くのか？',
      },
      { type: 'question', questionId: 'pg-004' },
      {
        type: 'narrative',
        text: 'フォームの送信内容はKVに保存することにした。Pages FunctionsからKVを使うには、バインディングや環境変数をどこでどう設定する？',
      },
      { type: 'question', questionId: 'pg-009' },
      {
        type: 'narrative',
        text: 'フォームが動いた。最後の仕上げに、`*.pages.dev` のままだったURLを、取得済みの独自ドメインに変えたい。カスタムドメインの設定はどう行う？',
      },
      { type: 'question', questionId: 'pg-008' },
      {
        type: 'narrative',
        text: '独自ドメインのブログに、プレビューで確認済みの新デザインと、お問い合わせフォーム。「静的サイトだから」と諦めていた機能が、リポジトリにファイルを足すだけで動いた。次は何を作ろうか。',
      },
    ],
    completionMessage:
      'ブログが一段階進化しました！Git連携の自動デプロイ、プレビューデプロイ、Pages Functions、バインディング設定、カスタムドメイン——静的サイトを育てる定番の道筋を体験しました。',
  },
  {
    id: 'scenario-ai-budget',
    title: '無料枠でAIアプリを出したい',
    description: 'Workers AIで作り、AI Gatewayで課金の暴発を防ぐ',
    icon: '🤖',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '「冷蔵庫の余り物からレシピを提案するAI」という個人開発ネタを思いついた。ただしAI APIの従量課金は、個人の財布には正直怖い。\n\nCloudflareにはエッジで推論を実行できるWorkers AIがある。まずその特徴から確認しよう。',
      },
      { type: 'question', questionId: 'ai-001' },
      {
        type: 'narrative',
        text: '良さそうだ。早速Workerから使えるようにセットアップする。設定ファイルにはどう書く？',
      },
      { type: 'question', questionId: 'ai-002' },
      {
        type: 'narrative',
        text: 'レシピ生成が動いた。ただ、長いレシピの生成完了まで画面が無反応なのは体験が悪い。ChatGPTのように、生成されたそばから文字を表示したい。',
      },
      { type: 'question', questionId: 'ai-013' },
      {
        type: 'narrative',
        text: '体験は良くなった。次は公開前の最大の不安——「バズって使われすぎたら請求はどうなる？」に手を打つ。AIリクエストの通り道に置いて、キャッシュや制限をかけられるレイヤーがあると聞いた。',
      },
      { type: 'question', questionId: 'ai-004' },
      {
        type: 'narrative',
        text: 'AI Gatewayを通す構成にした。特に欲しいのは「月の支出がこの額を超えたら止める」という保険だ。その役割を担う機能は？',
      },
      { type: 'question', questionId: 'ag-003' },
      {
        type: 'narrative',
        text: '上限額を設定した。では実際にその予算に達したとき、アプリへのリクエストはどうなるのか——ユーザーへの見え方に関わるので、挙動を正確に知っておきたい。',
      },
      { type: 'question', questionId: 'ag-009' },
      {
        type: 'narrative',
        text: 'これで「最悪でも月◯円まで」という安心を手に入れた。個人開発のAIアプリは、作る技術と同じくらい「暴発させない仕組み」が大事だ。安心してSNSで公開告知を打てる。',
      },
    ],
    completionMessage:
      'AIアプリを安全に公開できる構成が完成！Workers AIのセットアップ、ストリーミング応答、AI Gatewayによるコスト管理——「バズっても財布が壊れない」個人開発AIの定石を体験しました。',
  },
]
