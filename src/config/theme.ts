/**
 * テーマ設定 — アプリのブランド・カテゴリ・テキストを一元管理
 *
 * このファイルを差し替えるだけで、別の技術テーマのクイズアプリとして動作する。
 * quizzes.json のカテゴリIDと categories のキーが一致していれば OK。
 */

export interface ThemeCategory {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly color: string
  readonly weight: number
  /** カテゴリ正解時に表示する「身につけたスキル」の説明 */
  readonly skillDescription: string
}

export interface ThemeMasteryLevel {
  readonly name: string
  readonly icon: string
  readonly color: string
  readonly bg: string
  readonly req: string | null
}

export interface ThemeScoreMessage {
  readonly title: string
  readonly message: string
  readonly color: string
  readonly bgColor: string
  readonly borderColor: string
}

export interface ThemeScoreThreshold {
  readonly min: number
  readonly result: ThemeScoreMessage
}

export interface ThemeChapterDetail {
  readonly learningPoints: readonly string[]
  readonly encouragement: string
  readonly realWorldExample: string
}

export interface ThemeTutorialSlide {
  readonly title: string
  readonly description: string
  readonly tip?: string
}

export interface ThemeTutorialTerminal {
  readonly youLabel: string
  readonly aiLabel: string
  readonly prompt: string
  readonly reply: string
  readonly replyCont: string
}

export interface ThemeTutorialPathStep {
  readonly label: string
  readonly desc: string
}

export interface ThemeConfig {
  /** アプリ名（フル） */
  readonly appName: string
  /** アプリ名（短縮、PWA用） */
  readonly appShortName: string
  /** ロゴテキスト（ウェルカム画面のアイコン内） */
  readonly logoText: string
  /** テーマ主題（AIプロンプトの接頭辞） */
  readonly subject: string
  /** キャッチフレーズ */
  readonly tagline: string
  /** サブキャッチ */
  readonly subtitle: string
  /** 証明書タイトル */
  readonly certificateTitle: string
  /** 証明書フッター */
  readonly certificateFooter: string
  /** 全体像モード証明書説明 */
  readonly certificateDescOverview: string
  /** 実力テスト証明書説明 */
  readonly certificateDescFull: string
  /** 公式ドキュメントURL（結果画面の「始める」リンク） */
  readonly officialDocsUrl: string
  /** 公式ドキュメントのリンクテキスト */
  readonly officialDocsLabel: string
  /** PWA URL（シェアメッセージ用） */
  readonly pwaUrl: string
  /** シェアメッセージのハッシュタグ */
  readonly shareHashtags: string
  /** カテゴリ定義 */
  readonly categories: readonly ThemeCategory[]
  /** マスタリーレベル定義 */
  readonly masteryLevels: readonly ThemeMasteryLevel[]
  /** ウェルカム画面の特徴リスト */
  readonly welcomeFeatures: readonly {
    readonly iconColor: string
    readonly title: string
    readonly desc: string
  }[]
  /** localStorage キーのプレフィックス */
  readonly storagePrefix: string
  /** 全体像モードのチャプター定義 */
  readonly overviewChapters: readonly {
    readonly id: number
    readonly name: string
    readonly subtitle: string
    readonly icon: string
    readonly actionItem: string
    /** 「読んでから解く」モードで表示する導入読み物 */
    readonly introContent?: readonly string[]
  }[]
  /** スコアに基づく結果メッセージ（閾値降順） */
  readonly scoreMessages: readonly ThemeScoreThreshold[]
  /** チャプター導入画面の詳細（learningPoints, encouragement, realWorldExample） */
  readonly chapterDetails: Readonly<Record<number, ThemeChapterDetail>>
  /** 実践シナリオモードの説明文 */
  readonly scenarioModeDescription: string
  /** チュートリアルスライド */
  readonly tutorialSlides: readonly ThemeTutorialSlide[]
  /** チュートリアルのターミナルデモテキスト */
  readonly tutorialTerminal: ThemeTutorialTerminal
  /** チュートリアルの吹き出し例 */
  readonly tutorialBubbles: readonly string[]
  /** チュートリアルの能力ラベル */
  readonly tutorialCapabilities: readonly { readonly label: string }[]
  /** チュートリアルの学習パスステップ */
  readonly tutorialPathSteps: readonly ThemeTutorialPathStep[]
  /** 「〜とは」ラベル（メニューヘッダー用） */
  readonly aboutLabel: string
  /** 「〜とは」説明文 */
  readonly aboutDesc: string
  /** 「読んでから解く」学習の進め方の本文 */
  readonly studyFirstHowToLearnBody: string
  /** 検索プレースホルダー（トピック固有のキーワード例） */
  readonly searchPlaceholder: string
  /** 最高レベル到達時のメッセージ */
  readonly masteryMaxMessage: string
}

// ============================================================
// Cloudflare テーマ（デフォルト）
// ============================================================

const cloudflareTheme: ThemeConfig = {
  appName: 'Cloudflare Quiz',
  appShortName: 'CF Quiz',
  logoText: 'CF',
  subject: 'Cloudflare',
  tagline: 'エッジで動くプロダクトを、今日からつくれるようになる',
  subtitle: '経験不問 | ${count}問 | スマホでいつでも',
  certificateTitle: 'Cloudflare Quiz Master Certification',
  certificateFooter: 'Powered by Cloudflare Quiz',
  certificateDescOverview: 'Cloudflare の全体像を習得したことを証明します',
  certificateDescFull: 'Cloudflare の機能と使い方に関する実力テストに合格しました',
  officialDocsUrl: 'https://developers.cloudflare.com/',
  officialDocsLabel: 'Cloudflare を始める',
  pwaUrl: 'https://ip-san.github.io/cloudflare-codex-quiz/',
  shareHashtags: '#Cloudflare #エッジコンピューティング #サーバーレス',
  // weight = 実務価値の3段階プロキシ（5=ニッチ / 10=標準 / 15=高頻度・高インパクト）。
  // 価値軸の唯一の情報源。出題配分(full)・出題順 tie-break(random/SRS)・レコメンドが追従する。
  // 変更時は根拠を PR に記載すること。詳細: .claude/rules/quiz-data.md「価値軸」
  categories: [
    {
      id: 'workers',
      name: 'Workers 基礎',
      icon: '⚡',
      color: 'orange',
      weight: 15,
      description: 'Workers のランタイム、Fetch ハンドラ、環境変数・バインディングの基本',
      skillDescription: 'エッジで動く API を書ける',
    },
    {
      id: 'wrangler',
      name: 'Wrangler・開発フロー',
      icon: '🛠️',
      color: 'blue',
      weight: 15,
      description: 'wrangler CLI、wrangler.toml、ローカル開発とデプロイのワークフロー',
      skillDescription: 'ローカルからデプロイまで自走できる',
    },
    {
      id: 'kv-cache',
      name: 'KV・Cache',
      icon: '🗂️',
      color: 'cyan',
      weight: 10,
      description: 'Workers KV の読み書き、Cache API、結果整合性の特性',
      skillDescription: 'キーバリューでの高速キャッシュを設計できる',
    },
    {
      id: 'd1',
      name: 'D1',
      icon: '🗄️',
      color: 'indigo',
      weight: 10,
      description: 'D1 のスキーマ設計、クエリ実行、マイグレーション',
      skillDescription: 'エッジで動くリレーショナル DB を扱える',
    },
    {
      id: 'r2',
      name: 'R2',
      icon: '📦',
      color: 'emerald',
      weight: 10,
      description: 'R2 のオブジェクトストレージ操作と S3 互換 API、料金特性',
      skillDescription: '転送量を気にせずファイル保存を設計できる',
    },
    {
      id: 'do-queues',
      name: 'Durable Objects・Queues',
      icon: '🧩',
      color: 'purple',
      weight: 10,
      description: 'Durable Objects による状態管理、Queues による非同期処理',
      skillDescription: '状態を持つ処理・非同期処理を設計できる',
    },
    {
      id: 'pages-deploy',
      name: 'Pages・フレームワーク・デプロイ',
      icon: '🚀',
      color: 'pink',
      weight: 15,
      description: 'Cloudflare Pages でのフロントエンドデプロイ、フレームワーク統合、CI/CD',
      skillDescription: 'フロントエンドを本番公開できる',
    },
    {
      id: 'ai-vectorize',
      name: 'Workers AI・Vectorize',
      icon: '🤖',
      color: 'yellow',
      weight: 10,
      description: 'Workers AI での推論実行、Vectorize によるベクトル検索',
      skillDescription: 'エッジで AI 推論・検索機能を組み込める',
    },
    {
      id: 'architecture',
      name: '設計・料金・制限',
      icon: '📐',
      color: 'green',
      weight: 15,
      description: 'サービス間の使い分け、料金モデル、制限値を踏まえた設計判断',
      skillDescription: '要件に合ったサービス構成を選べる',
    },
  ],
  masteryLevels: [
    { name: 'エッジ入門者', icon: '🌱', color: 'text-claude-orange', bg: 'bg-claude-orange/10', req: null },
    { name: 'エッジ学習者', icon: '📚', color: 'text-blue-600', bg: 'bg-blue-500/10', req: '正答率50%以上' },
    { name: 'エッジ実践者', icon: '🚀', color: 'text-green-600', bg: 'bg-green-500/10', req: '正答率70%以上' },
    { name: 'エッジ推進者', icon: '⚡', color: 'text-purple-600', bg: 'bg-purple-500/10', req: '正答率80% + 半数以上学習' },
    {
      name: 'エッジ牽引役',
      icon: '👑',
      color: 'text-yellow-600',
      bg: 'bg-yellow-500/10',
      req: '正答率85% + 全カテゴリ習得',
    },
  ],
  welcomeFeatures: [
    {
      iconColor: 'text-claude-orange',
      title: '知識ゼロから始められる',
      desc: 'Cloudflare を使ったことがなくても大丈夫。基礎から順番にガイドします',
    },
    {
      iconColor: 'text-blue-500',
      title: '1問ずつ、確実に身につく',
      desc: '解説付きのクイズで「わかった」を積み重ねていきましょう',
    },
    {
      iconColor: 'text-green-500',
      title: 'あなたのペースで成長',
      desc: 'スマホでいつでも学習。毎日少しずつで、着実にスキルアップ',
    },
  ],
  storagePrefix: 'cloudflare-codex-quiz',
  overviewChapters: [
    {
      id: 1,
      name: 'Cloudflare Workers とは',
      subtitle: 'エッジで動く JavaScript ランタイムの基本を知る',
      icon: '⚡',
      actionItem:
        '【作れるもの】最初の Workers スクリプト。fetch ハンドラで "Hello, Cloudflare" を返す最小構成を書いて、挙動を理解する',
      introContent: [
        '新しい API を作る依頼が来たとします。サーバーを立てて、リージョンを決めて、スケーリング設定をして——本番稼働までに数日かかることも珍しくありません。',
        'Cloudflare Workers を使うと、そのプロセスが一変します。書くのは `fetch` イベントを受け取る関数だけ。デプロイすれば、世界中のエッジロケーションで同時に動き始めます。サーバーの管理も、リージョンの選択も不要です。',
        'ポイントは、Workers が「常時起動するサーバー」ではなく「リクエストが来たときだけ動く関数」だということ。コールドスタートはミリ秒単位で、ユーザーに最も近い場所でコードが実行されるため、体感速度が大きく変わります。',
        '現場の知恵: 最初の一歩は `wrangler init` で最小構成を作り、`return new Response("Hello")` を書いて `wrangler dev` で動かしてみることです。これだけで「エッジで動く」感覚が掴めます。',
      ],
    },
    {
      id: 2,
      name: 'Wrangler で開発する',
      subtitle: 'CLI でローカル開発からデプロイまでを一気通貫する',
      icon: '🛠️',
      actionItem:
        '【作れるもの】wrangler.toml の設定と `wrangler deploy` によるデプロイ体験。環境変数・バインディングを1つ追加してみる',
      introContent: [
        'Workers を書けるようになったら、次に必要なのは「開発 → 確認 → デプロイ」を素早く回す道具です。それが `wrangler` という公式 CLI です。',
        '`wrangler dev` を実行すると、ローカルにいながら本番に近い環境で Workers を動かせます。コードを保存するたびに自動でリロードされるので、サーバーを起動し直す手間がありません。設定は `wrangler.toml` という1枚のファイルに集約されており、KV・D1・R2 などのバインディングもここで宣言します。',
        '確認が終わったら `wrangler deploy` の一言で本番反映です。ステージング用に環境を分けたい場合は `wrangler.toml` に `[env.staging]` セクションを追加するだけ。ブランチごとに環境を切り替える運用もすぐに組めます。',
        '現場の知恵: `wrangler.toml` に `compatibility_date` を明示しておくと、Cloudflare 側のランタイム更新による予期しない挙動変化を防げます。プロジェクト開始時に必ず設定しておきましょう。',
      ],
    },
    {
      id: 3,
      name: 'データを保存する',
      subtitle: 'KV・R2・D1 ——用途に応じたストレージを使い分ける',
      icon: '🗂️',
      actionItem:
        '【作れるもの】KV に設定値を1件書き込んで読み出す最小コード。可能なら D1 か R2 のどちらかも触ってみる',
      introContent: [
        '「データをどこに置くか」は、Workers アプリの設計で最初にぶつかる壁です。Cloudflare には性格の異なる3つのストレージがあり、用途を間違えると後で作り直すことになります。',
        'Workers KV はキーバリュー型で、読み取りが極めて高速な代わりに書き込み直後の反映は結果整合性です。設定値やフィーチャーフラグのような「頻繁に読み、たまにしか書かない」データに向いています。R2 は S3 互換のオブジェクトストレージで、転送量課金がないのが最大の特徴。画像や動画、バックアップの保管に向いています。D1 は SQLite ベースのリレーショナル DB で、トランザクションや複雑なクエリが必要なデータに向いています。',
        '実務では「まず KV で始めて、リレーションが必要になったら D1 に寄せる」という判断がよくあります。逆に、大きなファイルを KV に詰め込もうとすると値のサイズ制限に当たるので、それは R2 の仕事です。',
        '現場の知恵: 迷ったら「読み書きの頻度」と「データの形」で選びます。高頻度読み取りの単純な値 → KV、ファイル → R2、構造化データと検索条件 → D1、という3分類を覚えておくと設計が速くなります。',
      ],
    },
    {
      id: 4,
      name: '高度な処理',
      subtitle: 'Durable Objects・Queues・Workers AI で複雑な要件に応える',
      icon: '🧩',
      actionItem:
        '【作れるもの】Durable Objects か Queues のどちらかを使った小さなサンプル。状態管理か非同期処理の感覚を掴む',
      introContent: [
        'KV・R2・D1 だけでは足りない場面があります。たとえば「同時アクセスしても数字が正しくカウントされるカウンター」や、「重い処理を後回しにしてレスポンスは先に返したい」というケースです。',
        'Durable Objects は、1つのオブジェクトにつき1つの実行環境が保証される仕組みです。リクエストが同じオブジェクトに集約されるため、ロックを気にせず状態を安全に更新できます。チャットルームやゲームのセッション管理、レートリミッターなどによく使われます。Queues はメッセージキューで、重い処理をバックグラウンドに逃がし、失敗時のリトライも仕組みとして持っています。',
        'Workers AI は、この上でさらに一歩進んで「推論そのもの」をエッジで実行します。GPU を自前で用意しなくても、テキスト生成や画像認識のモデルを Workers から呼び出せます。Vectorize と組み合わせれば、埋め込みベクトルの検索まで一気通貫で構築できます。',
        '現場の知恵: これらは「必要になってから学ぶ」で十分です。まずは KV や D1 で作り切ってみて、「同時実行で状態が壊れる」「レスポンスを待たせたくない」という壁に当たったときに Durable Objects や Queues を思い出してください。',
      ],
    },
    {
      id: 5,
      name: 'デプロイと公開',
      subtitle: 'Cloudflare Pages でフロントエンドを本番公開する',
      icon: '🚀',
      actionItem:
        '【作れるもの】GitHub リポジトリと Cloudflare Pages を連携し、push するだけで自動デプロイされる状態を作る',
      introContent: [
        'API はエッジで動くようになった。次はフロントエンドです。Cloudflare Pages は、静的サイトやフレームワーク製アプリを Git 連携だけでデプロイできるサービスです。',
        '仕組みはシンプルです。GitHub リポジトリを接続すると、ブランチに push するたびにビルドが走り、結果が自動的に公開されます。main ブランチは本番、それ以外のブランチはプレビュー URL として確認できるため、レビューのたびに手元でビルドし直す必要がありません。',
        'React・Next.js・Astro など主要フレームワークのビルド設定はほぼ自動検出されます。加えて、Pages Functions を使えば、フロントエンドと同じリポジトリの中に Workers ベースの API エンドポイントを共存させることもできます。',
        '現場の知恵: 最初のデプロイでは「ビルドコマンド」と「出力ディレクトリ」の設定ミスで詰まりがちです。フレームワークの公式ドキュメントに Cloudflare Pages 向けの設定例があるので、そこから始めるのが最短ルートです。',
      ],
    },
    {
      id: 6,
      name: '設計・料金・制限',
      subtitle: 'サービスの使い分けと料金モデルを理解し、実務に活かす',
      icon: '📐',
      actionItem:
        '【作れるもの】自分のプロダクトのアイデアに対して「どのサービスをどう組み合わせるか」を1枚の構成図にまとめる',
      introContent: [
        'ここまで学んだ機能を「知っている」のと「使いこなしている」のには大きな差があります。その差を生むのが、料金モデルと制限値を踏まえた設計判断です。',
        'Cloudflare の多くのサービスは無料枠が広く、個人開発や検証には十分すぎるほどです。ただし本番運用では、Workers のリクエスト数課金、R2 の転送量無料という特性、D1 の行数・容量制限など、サービスごとの特性を理解しておかないと、思わぬところでコストや制限に当たります。',
        'もう一つ重要なのは「小さく作って、必要になったら足す」という考え方です。最初から Durable Objects や Queues まで盛り込む必要はありません。Workers + KV だけで始めて、要件が明確になった段階で D1 や R2、Durable Objects を足していく方が、無駄なく最短距離で本番稼働にたどり着けます。',
        '現場の知恵: 設計に迷ったら、まず「読み書きの頻度」「データの永続性が必要か」「同時実行で状態を守る必要があるか」の3つを自問してください。この3つの答えが、使うべきサービスをほぼ一意に決めてくれます。',
      ],
    },
  ],
  scoreMessages: [
    {
      min: 100,
      result: {
        title: 'パーフェクト！',
        message: '全問正解。あなたは Cloudflare を完全に理解しています。',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      },
    },
    {
      min: 80,
      result: {
        title: '素晴らしい！',
        message: 'ここまで来たあなたなら、実務でも活躍できます。',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      },
    },
    {
      min: 70,
      result: {
        title: '着実に成長しています',
        message: '基礎は身についています。復習で更に自信をつけましょう。',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      },
    },
    {
      min: 50,
      result: {
        title: 'いい線いってます',
        message: 'あと少しです。間違えた問題を見直すだけで、大きく伸びます。',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
      },
    },
    {
      min: 0,
      result: {
        title: '最初の一歩を踏み出しました',
        message: 'ここから始まります。繰り返すほど必ず伸びます。',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      },
    },
  ],
  chapterDetails: {
    1: {
      learningPoints: [
        'Cloudflare Workers がどんなランタイムなのか',
        'fetch ハンドラの基本的な仕組み',
        'エッジで動くことのメリット',
      ],
      encouragement: 'サーバー運用の経験は一切不要です。「こんな仕組みがあるんだ」くらいの気持ちで進めましょう。',
      realWorldExample: '例: `wrangler dev` を実行するだけで、ローカルにいながらエッジ相当の環境が立ち上がります',
    },
    2: {
      learningPoints: [
        'wrangler CLI の基本コマンド',
        'wrangler.toml による設定管理',
        'ローカル開発からデプロイまでの流れ',
      ],
      encouragement: '「設定ファイル」と聞くと難しそうですが、実は1枚の TOML ファイルにまとまっているだけです。',
      realWorldExample: '例: `wrangler deploy` の一言で、書いたコードが世界中のエッジに配信されます',
    },
    3: {
      learningPoints: ['KV・R2・D1 それぞれの特性', '用途に応じたストレージの選び方', 'データの整合性モデルの違い'],
      encouragement: 'ストレージの種類が多くて迷うかもしれませんが、「読み書きの頻度」で考えれば整理できます。',
      realWorldExample: '例: 設定値は KV、画像ファイルは R2、注文データは D1、というように使い分けます',
    },
    4: {
      learningPoints: [
        'Durable Objects による状態管理の仕組み',
        'Queues を使った非同期処理の設計',
        'Workers AI・Vectorize でできること',
      ],
      encouragement: 'ここからは応用編です。全部覚える必要はありません。「こんなことができるんだ」と把握できればOK。',
      realWorldExample: '例: Durable Objects を使えば、同時アクセスされてもカウンターの値が正しく保たれます',
    },
    5: {
      learningPoints: ['Cloudflare Pages でのデプロイ方法', 'Git 連携による自動ビルド', 'Pages Functions との組み合わせ'],
      encouragement: 'フロントエンドのデプロイは、Git 連携さえ済ませればほとんど自動で進みます。',
      realWorldExample: '例: main ブランチに push するだけで、ビルドから公開までが自動的に完了します',
    },
    6: {
      learningPoints: ['サービスごとの料金モデル', '無料枠と制限値の考え方', '要件に合わせたサービス選定'],
      encouragement: '最終チャプターです！ここまでの知識を実際の設計判断にどう活かすかを学びます。',
      realWorldExample: '例:「読み書きの頻度」「永続性」「同時実行の要否」の3点で使うサービスを判断できます',
    },
  },
  scenarioModeDescription: '実務シナリオに沿って Cloudflare を学ぶ',
  tutorialSlides: [
    {
      title: 'Cloudflare とは',
      description:
        '世界中のエッジロケーションでコードやデータを動かせるプラットフォーム。Workers・Pages・KV・R2・D1 などのサービスを組み合わせて、サーバー管理なしでプロダクトを構築できます。',
      tip: 'サーバー運用の経験がなくても使えます',
    },
    {
      title: 'クイズで学ぼう',
      description:
        '基本操作から応用テクニックまで、クイズ形式で楽しく学べます。間違えても解説付きなので、確実に知識が身につきます。',
    },
  ],
  tutorialTerminal: {
    youLabel: 'あなた:',
    aiLabel: 'wrangler:',
    prompt: 'wrangler dev',
    reply: '⎔ Starting local server...',
    replyCont: 'Ready on http://localhost:8787',
  },
  tutorialBubbles: ['KV に値を保存して', 'D1 にテーブルを作って', 'R2 にファイルをアップロードして', 'Pages にデプロイして'],
  tutorialCapabilities: [
    { label: 'エッジ実行' },
    { label: 'ストレージ連携' },
    { label: '自動デプロイ' },
    { label: 'スケーリング' },
  ],
  tutorialPathSteps: [
    { label: '基本操作を知る', desc: '全体像モード 6チャプター' },
    { label: '知識を確認する', desc: 'カテゴリ別・ランダム問題' },
    { label: '実力を試す', desc: '実力テスト' },
  ],
  aboutLabel: 'Cloudflare とは',
  aboutDesc: '基本を2画面で紹介',
  studyFirstHowToLearnBody:
    'チャプターを選んで、基礎的な解説を読みましょう。やさしい内容だけに絞っているので、 Cloudflare を知らなくても読み進められます。',
  searchPlaceholder: '例: Workers, KV, wrangler',
  masteryMaxMessage: '最高レベル到達。あなたはチームのエッジ活用を牽引できます。',
}

// ============================================================
// アクティブテーマ
// ============================================================

/** 現在のテーマ設定。別テーマに切り替える場合はここを差し替える */
export const theme: ThemeConfig = cloudflareTheme

/** カテゴリIDからスキル説明を取得 */
export function getSkillDescription(categoryId: string): string {
  return theme.categories.find((c) => c.id === categoryId)?.skillDescription ?? ''
}

/** subtitle の ${count} を実際の問題数で置換 */
export function getSubtitle(questionCount: number): string {
  return theme.subtitle.replace('${count}', String(questionCount))
}
