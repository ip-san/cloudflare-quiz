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

/**
 * シナリオ完走後の「次の一歩」
 *
 * 知識で終わらせず、実際に手を動かすところまで繋ぐための導線。
 * `command` に書くコマンドは**実在するものだけ**（公式ドキュメントで裏取り済み）。
 * 存在しないコマンドを書くと、学習者が詰まって信頼を失う。
 */
export interface ScenarioNextStep {
  /** 何をするか（動詞で終える） */
  readonly label: string
  /** 実行するコマンド（任意） */
  readonly command?: string
  /** 公式ドキュメントへのリンク（任意） */
  readonly docUrl?: string
}

export interface ScenarioData {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced'
  readonly steps: readonly ScenarioStep[]
  readonly completionMessage: string
  /**
   * 完走後に提示する実践アクション（1〜3個）。
   *
   * optional にしない。「次の一歩が無いシナリオ」は読み物で終わってしまい、
   * このアプリの目的（手を動かすところまで繋ぐ）を満たさないため、
   * 型の時点で必須にして消費側から `?? []` 系の防御コードを消す。
   */
  readonly nextSteps: readonly ScenarioNextStep[]
}

export const SCENARIOS: readonly ScenarioData[] = [
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
    nextSteps: [
      {
        label: '実際にWorkerプロジェクトを作る',
        command: 'npm create cloudflare@latest',
        docUrl: 'https://developers.cloudflare.com/workers/get-started/guide/',
      },
      { label: 'ローカルで動かす', command: 'npx wrangler dev' },
      { label: '世界に公開する', command: 'npx wrangler deploy' },
    ],
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
    nextSteps: [
      {
        label: 'GitHubリポジトリをPagesに接続する',
        docUrl: 'https://developers.cloudflare.com/pages/get-started/git-integration/',
      },
      {
        label: 'functions/ にAPIを1つ置いてみる',
        docUrl: 'https://developers.cloudflare.com/pages/functions/get-started/',
      },
    ],
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
    nextSteps: [
      { label: 'D1データベースを作る', command: 'npx wrangler d1 create my-database' },
      { label: 'KV namespaceを作る', command: 'npx wrangler kv namespace create MY_KV' },
      { label: 'R2バケットを作る', command: 'npx wrangler r2 bucket create my-bucket' },
    ],
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
    nextSteps: [
      { label: 'cloudflaredを認証する', command: 'cloudflared tunnel login' },
      { label: 'トンネルを作る', command: 'cloudflared tunnel create my-tunnel' },
      {
        label: 'Accessでアクセスできる人を絞る',
        docUrl: 'https://developers.cloudflare.com/cloudflare-one/access-controls/policies/',
      },
    ],
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
    nextSteps: [
      { label: 'R2バケットを作る', command: 'npx wrangler r2 bucket create my-bucket' },
      {
        label: 'ファイルを1つ置いてみる',
        command: 'npx wrangler r2 object put my-bucket/hello.txt --file=./hello.txt',
      },
      { label: '無料枠早見表でコスト感を確認する', docUrl: 'https://developers.cloudflare.com/r2/pricing/#free-tier' },
    ],
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
    nextSteps: [
      {
        label: 'Workers AIをプロジェクトにバインドする',
        docUrl: 'https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/',
      },
      {
        label: 'AI GatewayでSpend limitを設定する',
        docUrl: 'https://developers.cloudflare.com/ai-gateway/features/spend-limits/',
      },
    ],
  },
  {
    id: 'scenario-slow-site',
    title: '「サイトが遅い」の犯人を探せ',
    description: '思い込みではなく計測から始める、表示速度改善の定石',
    icon: '🐢',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '運営しているレシピサイトに「スマホだと表示が遅い」という感想が届いた。自分のPCでは一瞬で開くのに——。\n\n体感談だけで画像圧縮だのコード分割だのに手を出す前に、まず計測だ。CloudflareダッシュボードにはObservatoryという速度計測ツールがある。どんなデータソースで測ってくれるのか？',
      },
      { type: 'question', questionId: 'sp-001' },
      {
        type: 'narrative',
        text: '計測には2つの方式があると分かった。「自分のPCでは速い」のに「ユーザーは遅い」と感じる——このギャップを見つけるには、どちらの方式でしか取れない指標が鍵になる。',
      },
      { type: 'question', questionId: 'sp-002' },
      {
        type: 'narrative',
        text: '計測の結果、最初のレスポンスを待つ時間と、CSS・フォントの読み込みがボトルネックだと判明した。オリジンがHTMLを生成している間、ブラウザをただ待たせておくのはもったいない。Cloudflareにはこの待ち時間を活用する機能がある。',
      },
      { type: 'question', questionId: 'sp-009' },
      {
        type: 'narrative',
        text: 'もう一段の改善として、通信プロトコル自体も見直したい。モバイル回線のようにパケットロスが起きやすい環境で効果を発揮する、最新のHTTPプロトコルは何が違う？',
      },
      { type: 'question', questionId: 'sp-015' },
      {
        type: 'narrative',
        text: '仕上げに転送サイズだ。テキスト系のアセットはCloudflareが自動で圧縮して配信してくれるが、その圧縮方式はプランによって異なる。自分のプランでは何が使われている？',
      },
      { type: 'question', questionId: 'sp-017' },
      {
        type: 'narrative',
        text: '数日後、再計測すると、スマホでの表示開始が目に見えて速くなっていた。感想をくれたユーザーに「直したよ」と返信できた。「遅い」と言われたらまず計測、そして待ち時間・プロトコル・転送量の順に削る——この手順はどのサイトでも同じだ。',
      },
    ],
    completionMessage:
      '速度改善を完走！Observatoryでの計測、RUMと合成テストの使い分け、Early Hints、HTTP/3、圧縮——「体感の不満を計測で特定して順に削る」定石を体験しました。',
    nextSteps: [
      {
        label: '自分のサイトの速度を実際に計測する',
        docUrl: 'https://developers.cloudflare.com/speed/observatory/run-speed-test/',
      },
      {
        label: 'Early Hints を有効にして体感を縮める',
        docUrl: 'https://developers.cloudflare.com/cache/advanced-configuration/early-hints/',
      },
    ],
  },
  {
    id: 'scenario-scraper',
    title: 'スクレイパーと戦う夜',
    description: 'ボットスコアを理解し、守るべきボットと止めるべきボットを見分ける',
    icon: '🕷️',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '丹精込めて書いたレビュー記事が、他のサイトに丸ごと転載されているのを見つけた。アクセスログを見ると、深夜に機械的な間隔で全ページを巡回するアクセスがある。スクレイパーだ。\n\nCloudflareのBot対策は1つではない。まず、どんな製品ラインナップがあるのか整理しよう。',
      },
      { type: 'question', questionId: 'bt-001' },
      {
        type: 'narrative',
        text: '製品の全体像は掴めた。これらの土台になっているのが「ボットスコア」——リクエストごとに付く、人間らしさの点数だ。値の範囲と意味を正確に知らないと、ルールの向きを逆に書く事故が起きる。',
      },
      { type: 'question', questionId: 'bt-007' },
      {
        type: 'narrative',
        text: '無料のBot Fight Modeは既に有効にしてある。一段上のSuper Bot Fight Modeにすると、何が増えるのか？',
      },
      { type: 'question', questionId: 'bt-003' },
      {
        type: 'narrative',
        text: 'ここで手が止まった。ボットを片っ端からブロックすると、検索エンジンのクローラーまで巻き込んでしまわないか？検索流入はこのサイトの生命線だ。Cloudflareが「良いボット」をどう見分けているのか知っておきたい。',
      },
      { type: 'question', questionId: 'bt-016' },
      {
        type: 'narrative',
        text: '検索エンジンは守られると分かって一安心。最後に、もっと細かい制御がしたくなったときのために——Workerのコードの中からボットスコアを読んで、独自のロジックを書く方法も確認しておこう。',
      },
      { type: 'question', questionId: 'bt-011' },
      {
        type: 'narrative',
        text: '対策を入れて一週間。深夜の機械的な巡回はチャレンジに阻まれ、検索エンジンのクロールは今まで通り、検索順位も無事だ。「全部ブロック」ではなく「見分けて通す」——ボット対策の本質はここにある。',
      },
    ],
    completionMessage:
      'スクレイパー対策を完了！Bot対策製品の全体像、ボットスコアの読み方、SBFMの追加機能、Verified botの仕組み、Workersでの独自制御——「見分けて通す」ボット対策を体験しました。',
    nextSteps: [
      {
        label: 'まず無料のBot Fight Modeを入れてみる',
        docUrl: 'https://developers.cloudflare.com/bots/get-started/bot-fight-mode/',
      },
      {
        label: 'Bot Analyticsでどんなボットが来ているか見る',
        docUrl: 'https://developers.cloudflare.com/bots/bot-analytics/',
      },
    ],
  },
  {
    id: 'scenario-indie-saas',
    title: '個人開発がSaaSになった日',
    description: '「独自ドメインで使いたい」の声に、Cloudflare for SaaSで応える',
    icon: '🚀',
    difficulty: 'advanced',
    steps: [
      {
        type: 'narrative',
        text: '個人開発で作ったブログ作成サービスに、じわじわとユーザーが付いてきた。そしてついに、有料化を後押しする要望が届いた——「自分のドメイン(blog.customer.com)で使いたい」。\n\n顧客のドメインを自分のインフラで安全に受けるのは、実は大仕事だ。Cloudflareにはまさにこのための製品がある。',
      },
      { type: 'question', questionId: 'cs-001' },
      {
        type: 'narrative',
        text: 'Cloudflare for SaaSを使うことにした。構成を調べると「fallback origin」という要素が中心にある。これは何の役割を果たす？',
      },
      { type: 'question', questionId: 'cs-002' },
      {
        type: 'narrative',
        text: '顧客のカスタムホスト名を追加すると、2種類の「検証」が走るという。何と何を検証しているのか——ここを理解していないと、顧客への案内メールが書けない。',
      },
      { type: 'question', questionId: 'cs-004' },
      {
        type: 'narrative',
        text: '最初の顧客がDNS設定を済ませたと連絡をくれた。「もう切り替えて大丈夫？」と聞かれたが、こちら側では何を確認してからGOを出すべきか。',
      },
      { type: 'question', questionId: 'cs-003' },
      {
        type: 'narrative',
        text: '独自ドメイン対応は軌道に乗った。次の要望はさらに大胆だ——「テーマを自分のコードでカスタマイズしたい」。他人のコードを自分のインフラで安全に実行する仕組みとして、CloudflareにはWorkers for Platformsがある。まず目的から。',
      },
      { type: 'question', questionId: 'wp-001' },
      {
        type: 'narrative',
        text: '顧客ごとのコードはdispatch namespaceに入れるとして、リクエストが来たとき「どの顧客のコードを実行するか」を捌く層が必要になる。その役割を担うのは？',
      },
      { type: 'question', questionId: 'wp-003' },
      {
        type: 'narrative',
        text: '「顧客のドメインで、顧客のコードが、自分のプラットフォーム上で動く」——個人開発だったものが、アーキテクチャだけ見れば立派なSaaSになった。次の課題は料金プランの設計だが、それはまた別の物語。',
      },
    ],
    completionMessage:
      'SaaS化の第一歩を完了！Cloudflare for SaaSの目的、fallback origin、2つの検証、切り替え判断、そしてWorkers for Platformsによるマルチテナントコード実行——プラットフォーム事業者の技術基盤を体験しました。',
    nextSteps: [
      {
        label: 'カスタムホスト名を1つ作って動きを確かめる',
        docUrl: 'https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/',
      },
      {
        label: 'Workers for Platforms のテンプレートから始める',
        docUrl:
          'https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/',
      },
    ],
  },
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
    nextSteps: [
      {
        label: 'DNSレコードをプロキシ済み(オレンジクラウド)にする',
        docUrl: 'https://developers.cloudflare.com/dns/proxy-status/',
      },
      {
        label: '暗号化モードを Full (strict) にする',
        docUrl: 'https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/',
      },
    ],
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
    nextSteps: [
      {
        label: 'cf-cache-status を実際に見てみる',
        command: 'curl -sI https://example.com/ | grep -i cf-cache-status',
      },
      {
        label: 'Cache Rules でキャッシュキーを調整する',
        docUrl: 'https://developers.cloudflare.com/cache/how-to/cache-rules/settings/',
      },
    ],
  },
  {
    id: 'scenario-launch-day',
    title: 'グッズ販売開始まで、あと10分',
    description: 'Waiting Roomでアクセス殺到を捌き、Load Balancingで冗長化する',
    icon: '🎫',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '推しのコラボグッズの限定販売を、自分たちのECサイトで行うことになった。SNSでの告知は既に拡散中。前回の販売では開始直後にサーバーが落ち、「買えなかった」の声で溢れた苦い記憶がある。\n\n今回はCloudflareのWaiting Roomを使う。そもそもこの製品は何を解決してくれるのか。',
      },
      { type: 'question', questionId: 'wa-001' },
      {
        type: 'narrative',
        text: '「サイトを落とさず、あふれた人には順番を待ってもらう」——これだ。設定画面を開くと `total active users` と `new users per minute` という2つの数値を求められた。この2つの関係を理解していないと、絞りすぎ・緩すぎの事故になる。',
      },
      { type: 'question', questionId: 'wa-002' },
      {
        type: 'narrative',
        text: '数値は決めた。次は「待たせ方」だ。先着順にするか、ランダムにするか——キューイングメソッドは4種類あり、それぞれ性格が違う。',
      },
      { type: 'question', questionId: 'wa-004' },
      {
        type: 'narrative',
        text: '販売は明日の20時ちょうどに開始する。それまでは通常運用で、開始時刻きっかりに待機室を有効にしたい。手動でスイッチを切り替えるのは怖い。スケジュール実行の仕組みはある？',
      },
      { type: 'question', questionId: 'wa-007' },
      {
        type: 'narrative',
        text: '入口の対策は整った。次はオリジン側だ。今回はサーバーを2台用意した。Cloudflareで負荷分散を組むにあたり、Load Balancingの構成要素とその階層関係をまず整理しよう。',
      },
      { type: 'question', questionId: 'lb-001' },
      {
        type: 'narrative',
        text: '構成を組んだ。最後の確認——もし販売中に1台目が落ちたら2台目に流れてほしい。そして1台目が復旧したとき、トラフィックはどう戻るのか？',
      },
      { type: 'question', questionId: 'lb-004' },
      {
        type: 'narrative',
        text: '当日20時。アクセスは想定の3倍来たが、サイトは落ちず、待機室の推定待ち時間が表示され、SNSには「ちゃんと並べる」という好意的な声が流れた。完売まで90分、サーバーのグラフは終始安定していた。備えは裏切らない。',
      },
    ],
    completionMessage:
      '販売イベントを乗り切りました！Waiting Roomの役割と流量設計、キューイングメソッド、スケジュールイベント、Load Balancingの構成とフェイルオーバー——アクセス殺到への備えを一通り体験しました。',
    nextSteps: [
      {
        label: '販売前に待機室を作っておく',
        docUrl: 'https://developers.cloudflare.com/waiting-room/get-started/',
      },
      {
        label: '開始時刻に合わせてイベントをスケジュールする',
        docUrl: 'https://developers.cloudflare.com/waiting-room/additional-options/create-events/',
      },
    ],
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
    nextSteps: [
      {
        label: 'WAFカスタムルールを1本書いてみる',
        docUrl: 'https://developers.cloudflare.com/waf/custom-rules/',
      },
      {
        label: 'ログインURLにレート制限をかける',
        docUrl: 'https://developers.cloudflare.com/waf/rate-limiting-rules/',
      },
    ],
  },
  {
    id: 'scenario-one-person-it',
    title: 'ひとり情シス、Webフィルタリングを任される',
    description: 'Cloudflare Gatewayで会社のネットワークを守る最初の一歩',
    icon: '🧑‍💻',
    difficulty: 'intermediate',
    steps: [
      {
        type: 'narrative',
        text: '社員20人の会社で「PCに詳しいから」という理由で情シス係を兼務することになった。最初のミッションは、フィッシング被害が出かけたのを受けての「怪しいサイトへのアクセスを会社として防ぐ仕組み」だ。\n\n調べた結果、Cloudflare Gatewayを使うことにした。まず、Gatewayが提供するポリシーの種類と、従来のファイアウォールとの関係を整理する。',
      },
      { type: 'question', questionId: 'gw-001' },
      {
        type: 'narrative',
        text: 'ポリシーは3階層あると分かった。次に大事なのは「社員のトラフィックをどうやってGatewayに通すか」だ。接続方式によって、適用できるポリシーの種類が変わるという。',
      },
      { type: 'question', questionId: 'gw-002' },
      {
        type: 'narrative',
        text: '全社のPCにWARPクライアントを配ることにした。ブロック対象は「ギャンブル」「マルウェア配布」のようなカテゴリ単位で指定できるらしい。このドメイン分類はどういう仕組みで付いている？',
      },
      { type: 'question', questionId: 'gw-017' },
      {
        type: 'narrative',
        text: 'まず手軽なDNSポリシーでカテゴリブロックを設定した。ただ、ドキュメントを読むと「DNSブロックだけ」には限界があるらしい。何ができて、何がすり抜けるのか。',
      },
      { type: 'question', questionId: 'gw-003' },
      {
        type: 'narrative',
        text: 'HTTPポリシーも併用する方針にした。最後に確認しておきたいのが「どのポリシーにも引っかからなかった通信」の扱いだ。デフォルトで通るのか、止まるのか——これを知らずに運用を始めるのは怖い。',
      },
      { type: 'question', questionId: 'gw-014' },
      {
        type: 'narrative',
        text: '導入から1ヶ月。フィッシングメールのリンクを踏んでしまった社員がいたが、Gatewayのブロックページが表示されて事なきを得た。「PCに詳しい人」から「会社を守った人」へ。ひとり情シスの評価が、少し上がった。',
      },
    ],
    completionMessage:
      'Webフィルタリング導入を完了！Gatewayの3つのポリシー階層、接続方式と適用範囲、ドメインカテゴリ、DNSブロックの限界、デフォルト挙動——Zero Trustの入り口となるSWG導入を体験しました。',
    nextSteps: [
      {
        label: 'まずDNSポリシーでカテゴリブロックを試す',
        docUrl: 'https://developers.cloudflare.com/cloudflare-one/traffic-policies/dns-policies/common-policies/',
      },
      {
        label: '端末をWARPで接続してHTTPポリシーも効かせる',
        docUrl: 'https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/warp/deployment/',
      },
    ],
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
    nextSteps: [
      { label: '本番のログをリアルタイムで見る', command: 'npx wrangler tail' },
      { label: '直前のバージョンへ即座に戻す', command: 'npx wrangler rollback' },
      {
        label: '平時にWorkers Logsを有効にしておく',
        docUrl: 'https://developers.cloudflare.com/workers/observability/logs/workers-logs/',
      },
    ],
  },
]
