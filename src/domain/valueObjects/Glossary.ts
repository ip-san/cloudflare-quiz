/**
 * 学習者がつまずく語の、その場で読める説明。
 *
 * ### なぜ必要か（実測）
 *
 * プレイテストで初学者が「説明がない」と実際に報告した語を、
 * 初級200問の中で数えたところ、同じ語が何度も無説明で使われていた:
 *
 * ```
 * オリジン         41問中 説明あり 1問
 * wrangler         27問中 説明あり 6問
 * エッジ           25問中 説明あり 1問
 * バインディング   18問中 説明あり 2問
 * インスタンス     16問中 説明あり 1問
 * ```
 *
 * 設問は deep link で単独に開かれるので「前の問題で説明したから省略」が
 * 成り立たない。かといって40問すべてに括弧書きを入れると、
 * 2問目以降の学習者には冗長で、コーパスも膨らむ。
 * そこで**本文は変えずに、語そのものから説明を引けるように**した。
 *
 * ### 定義の出どころ
 *
 * **推測で書かないこと。** 各定義は docs か一般的な用語法で裏を取ってある。
 * 裏の取れない語はここに入れない（`em-009` 型の事実注入になる）。
 *
 * ### 文脈で意味が変わる語を入れてはいけない
 *
 * ここは**設問をまたいで同じ説明を出す**仕組みなので、
 * 文脈で意味が変わる語を入れると、必ずどこかで誤った説明になる。
 * 2度確認している:
 *
 * ```
 * プロパティ  ru-004 では「リクエストのプロパティに基づく数式」＝リクエストの属性。
 *             at-003 では「クラスに書いておく設定値」。担当レビュアーが
 *             「当てはめると誤った説明を挿入することになる」と指摘した
 * Allow      11カテゴリに出る。Access では「条件を満たしたら通す」だが、
 *             Client-side security では「許可したもの**以外をブロック**する」で
 *             ほぼ逆の意味になる（docs: `Allow rules block any resource not
 *             explicitly listed`）
 * Gateway    Zero Trust の Gateway として入れていたが、`AI Gateway` の 22 問でも
 *             `Gateway` が独立語として当たり、別製品に Zero Trust の説明が出ていた
 *             （2026-09-07 の用語集 52 語の docs 照合で発覚）。**製品名の一部になる語**は
 *             同じ型で衝突する。入れるなら `Cloudflare Gateway` のように製品名ごと
 * ```
 *
 * ### 設問が問うている語は入れない（2026-09-07）
 *
 * R2 は 44 問に出るが、r2-001 / r2-002 は「R2 とは何か」「R2 の料金の特徴」を問う設問で、
 * 設問の直下に出るチップが答えを渡す。頻度が高い語ほど、その語を主題にした設問がある。
 * 入れる前に `quizzes.json` を term で grep し、設問文にその語が主語として出る設問が無いか見ること。
 *
 * ### 定義文は用語集に入れる時に docs で裏を取り、52 語は 2026-09-07 に全数照合した
 *
 * 台帳のどの仕組みも定義文を照合していなかった（既知の穴）。3 体の独立レビュアーで全数を見て、
 * 上の Gateway と、TTL（rt-015 の TURN 認証情報の期限に合わなかった）、
 * `IP Access rules`（小文字の表記に当たらなかった）の 3 件を直した。
 * 語を足すときは、定義の根拠（docs のファイルと文）をコミットメッセージに書くこと。
 *
 * こうした語は**その設問の中で説明する**しかない。用語集には入れない。
 */
export interface GlossaryEntry {
  /** 本文中に現れる表記 */
  term: string
  /** 学習者向けの短い説明。1文で終える */
  description: string
}

/**
 * 長い語から先に照合する（`WAFカスタムルール` が `WAF` より先に当たるように）。
 * 追加するときは `GLOSSARY_TERMS` の並びを気にしなくてよい。読み込み時に整列する。
 */
const ENTRIES: GlossaryEntry[] = [
  { term: 'オリジン', description: 'Cloudflareの背後にある、コンテンツを実際に持っている元のサーバー。' },
  { term: 'エッジ', description: '世界各地にあるCloudflareのデータセンター。利用者に近い場所で処理を行う。' },
  {
    term: 'バインディング',
    description: 'Workerから外部のリソースを使えるようにする宣言。設定ファイルに書くと`env.<名前>`で参照できる。',
  },
  { term: 'wrangler', description: 'Workersの開発とデプロイに使うCloudflareの公式コマンドラインツール。' },
  { term: 'ゾーン', description: 'Cloudflareに登録したドメイン1つ分。設定はこの単位で管理される。' },
  {
    term: 'TTL',
    description:
      'Time To Live。キャッシュ・DNSレコード・認証情報などを、どれくらいの時間そのまま有効とみなすかの期限。',
  },
  {
    term: '権威DNS',
    description:
      'そのドメインのDNSレコードについて正式な回答を返す側。問い合わせを取り次ぐキャッシュDNSとは役割が違う。',
  },
  {
    term: 'WAFカスタムルール',
    description: '「この条件に当てはまったらブロックする」といった処理を自分で書くルール。',
  },
  { term: 'Ruleset Engine', description: 'WAFカスタムルールなどのルールを評価する、Cloudflare共通の基盤。' },
  {
    term: 'コールドスタート',
    description: 'しばらく呼ばれていない処理を動かすときに、起動を待たされる時間。',
  },
  { term: 'FaaS', description: 'Function as a Service。関数単位でコードを実行するクラウドサービス。' },
  {
    term: 'シャドーIT',
    description: '会社が把握していないまま、従業員が業務に使っているサービスや端末。',
  },
  {
    term: 'IP Access Rules',
    description: 'IPアドレス・IPブロック・国・ASNを指定して、まとめて許可・ブロック・チャレンジする仕組み。',
  },
  // docs もコーパスも小文字の rules が多数派（docs 8:1、コーパス 9:4）。照合は大文字小文字を区別するので両方置く
  // 2026-09-07 プレイテスト（mw-009）で初学者が詰まった 3 語。
  // ステアリングは負荷分散（Failover / Random / PoP …ステアリング）と Magic WAN で同じ意味
  // （docs traffic-steering: "Traffic steering controls how Cloudflare makes these routing decisions"）
  {
    term: 'ステアリング',
    description: '通信をどの宛先(PoolやトンネルなどCloudflareが選べる複数の送り先)に振り分けるかを決める仕組み。',
  },
  // docs tunnel-health-checks: "target endpoints beyond the tunnel-terminating border router"
  {
    term: '境界ルーター',
    description: 'Cloudflareとのトンネルが終端する、お客様ネットワーク側の境界に位置するルーター。',
  },
  // docs は "customer network namespaces" を展開していない。namespace の一般的な意味（分離された空間）の範囲で書く
  { term: '顧客ネットワーク名前空間', description: 'お客様ごとに分離された、その顧客専用のネットワーク空間。' },
  // 2026-09-07 プレイテスト（pl-001）で初学者が詰まった 2 語。コーパスは "Apache Iceberg" と裸の "Iceberg" の両方で使う。
  // Iceberg: docs pipelines getting-started "data is organized in the Apache Iceberg format with metadata tracking table versions"、
  //          r2 "queryable by engines like Spark, Snowflake, and R2 SQL"
  {
    term: 'Iceberg',
    description:
      '大量の分析用データを保存するテーブル形式(Apache Iceberg)。テーブルの版をメタデータで管理し、複数のクエリエンジンから同じデータを扱える。',
  },
  // Parquet: 列指向ファイル形式（標準的な用語法。docs は形式名として挙げるだけで展開していない）
  {
    term: 'Parquet',
    description: '列(カラム)ごとにデータをまとめて保持するファイル形式。分析処理での読み取りに向く。',
  },
  {
    term: 'IP Access rules',
    description: 'IPアドレス・IPブロック・国・ASNを指定して、まとめて許可・ブロック・チャレンジする仕組み。',
  },
  {
    term: 'リレーショナルデータベース',
    description: '表と表の関係でデータを持ち、SQLという言語で問い合わせるデータベース。',
  },
  { term: 'S3互換', description: 'Amazon S3 と同じAPIの作法で読み書きできること。S3向けのツールをそのまま使える。' },
  {
    term: 'クレデンシャルスタッフィング',
    description: '他所から漏れたIDとパスワードの組を大量に試し、使い回している利用者のアカウントへ侵入する攻撃。',
  },
  {
    term: '負のセキュリティモデル',
    description: '「危ないものを見つけて止める」考え方。裏返しの正のセキュリティモデルは「許したものだけ通す」。',
  },
  {
    term: 'OpenAPI',
    description: 'APIがどんなリクエストを受け付けるかを機械が読める形で書き表す、業界標準の記述形式。',
  },
  {
    term: 'Terraform',
    description: 'インフラの構成をコードで宣言して適用する、Cloudflare以外でも広く使われるツール。',
  },
  { term: 'DLP', description: 'Data Loss Prevention。機密情報が外部へ出ていくのを検知・防止する仕組み。' },
  {
    term: 'mTLS',
    description: '相互TLS。サーバーだけでなくクライアントも証明書を提示して、互いに身元を確認する方式。',
  },
  { term: 'IdP', description: 'Identity Provider。Google WorkspaceやOktaなど、利用者のログインを預かる認証サービス。' },

  // ── 2026-08-30 の初級36問テストで、実際に「意味が分からず止まった」と報告された語 ──
  // 収録の当たりが外れていた証拠として、テスターの言葉をそのまま残す:
  //   「用語グロッサリーに出ていた『Gateway』はむしろ**既に分かる言葉**だった」
  // 初期の23語は出現頻度で選んだ。頻度が高い語は**学習者が既に知っている語**に偏る。
  // 以下はすべて docs で裏を取ってから書いている（推測で書くと em-009 の事実注入と同じ）。
  {
    term: 'Durable Objects',
    description: '同じ名前なら必ず同じ1つのインスタンスに届く仕組み。専用の保存領域を持ち、状態を覚えていられる。',
  },
  { term: 'ステートレス', description: '前のリクエストのことを覚えていない性質。1回ごとに独立して処理される。' },
  { term: 'ステートフル', description: '前のやり取りを覚えている性質。接続の状態を見て判断できる。' },
  { term: '強整合', description: '書き込んだ直後に読むと、必ずその新しい値が返る性質。' },
  { term: 'コロケーション', description: '保存領域を処理する場所と同じ所に置くこと。取りに行く距離が縮む。' },
  {
    term: 'DEX',
    description: 'Digital Experience Monitoring。利用者の端末から見た通信の速さや繋がりやすさを監視する機能。',
  },
  {
    term: 'DLQ',
    description: 'Dead Letter Queue。再試行の上限まで失敗したメッセージが送られる、取りこぼし用のキュー。',
  },
  { term: 'Layer 4', description: 'IPアドレス・ポート・プロトコルで通信を見る段階。中身までは開かない。' },
  { term: 'レイヤー4', description: 'IPアドレス・ポート・プロトコルで通信を見る段階。中身までは開かない。' },
  { term: 'Layer 7', description: 'アプリケーション層。HTTPの中身まで見て判断できる段階。' },
  {
    term: 'FWaaS',
    description: 'Firewall-as-a-Service。自社に機器を置かず、サービスとして提供されるファイアウォール。',
  },
  {
    term: 'ディープパケットインスペクション',
    description: '通信の中身まで開いて検査すること。宛先だけを見る検査より細かく判断できる。',
  },
  { term: 'TLS復号', description: '暗号化された通信を一度ほどいて中身を検査すること。検査後にまた暗号化して送る。' },
  { term: 'DSレコード', description: 'DNSSECを有効にするとき、ドメインを買った登録業者側に登録するレコード。' },
  { term: 'DNSKEY', description: 'DNSSECで使う鍵のレコード。ドメインの頂点(apex)側に置かれる。' },
  { term: 'レジストラ', description: 'ドメイン名を購入した登録業者。ネームサーバーの登録先でもある。' },
  {
    term: 'MPLS',
    description: '拠点間を専用回線で結ぶ従来型の企業ネットワーク方式。Cloudflare WANが置き換えを狙う相手。',
  },
  { term: 'IPsec', description: '通信を包んで運ぶ方式の一つ。中身を暗号化し、送信元が本物かも確認する。' },
  { term: 'GRE', description: '通信を包んで運ぶ方式の一つ。設定は簡単だが暗号化はしない。' },
  { term: 'SASE', description: 'Secure Access Service Edge。ネットワークとセキュリティを一体で提供する考え方。' },
  {
    term: 'CNI',
    description: 'Cloudflare Network Interconnect。公衆インターネットを通さず自社網をCloudflareへ直結する接続。',
  },
  {
    term: 'スタンドアロンのHealth Checks',
    description: 'ロードバランサーとは別に単体で使える、オリジンの死活監視の製品。',
  },
  { term: 'ORM', description: 'データベースの行をプログラムのオブジェクトとして扱えるようにする補助ライブラリ。' },

  // ── `bun run quiz:acronyms` が挙げた、コーパス自身が別の設問で展開している略語 ──
  // 出た設問では展開されていないので、そこだけを読む学習者には解決の手立てが無い。
  // 何が難しいかを推測して選んだのではなく、**コーパスが既に約束している展開**を配っている。
  {
    term: 'SFU',
    description: 'Selective Forwarding Unit。ビデオ通話で、各参加者へ映像を選んで中継する中継役。',
  },
  {
    term: 'TURN',
    description: 'Traversal Using Relays around NAT。直接つながれない相手同士の通信を中継する仕組み。',
  },
  {
    term: 'CASB',
    description: 'Cloud Access Security Broker。SaaSやクラウド環境をAPIで走査し、設定の問題を見つける仕組み。',
  },

  // ── docs 自身が展開している略語のうち、初級で複数問に出て未展開のもの ──
  // 判断の根拠は「難しそうだから」ではなく「**Cloudflare の docs が
  // 技術者向けの文章でわざわざ展開している**」こと。読み手はそれより初学者なので、
  // docs が展開する語はこちらでも要る（a fortiori）。
  { term: 'CLI', description: 'command-line interface。画面ではなく、コマンドを打って操作する方式。' },
  {
    term: 'BGP',
    description: 'Border Gateway Protocol。経路を自動で広告・撤回する仕組み。静的な経路の手動管理に代わるもの。',
  },
  { term: 'AWS', description: 'Amazon Web Services。Amazonのクラウドサービス。' },
]

/** 長い語を先に照合するため、文字数の降順で持つ */
export const GLOSSARY: readonly GlossaryEntry[] = [...ENTRIES].sort((a, b) => b.term.length - a.term.length)

/**
 * 語の一致は**英数字の語境界を見る**。単純な部分一致だと略語が別語に埋もれて誤爆する。
 *
 * 2026-08-30、`DEX`（Digital Experience Monitoring）を入れようとして気づいた:
 * D1 の設問にある `CREATE INDEX` の **IN`DEX`** に当たる。
 * 本文側はコード片を除くので偶然逃れていたが、
 * チップ側は生の文字列を `includes` で見ていたので**確実に出ていた**。
 *
 * 日本語の語（オリジン等）には境界の概念が無いので、英数字で始まる/終わる語にだけ課す。
 */
const WORDISH = /[A-Za-z0-9_]/

function boundaryOk(text: string, start: number, term: string): boolean {
  if (WORDISH.test(term[0]) && start > 0 && WORDISH.test(text[start - 1])) return false
  const end = start + term.length
  if (WORDISH.test(term[term.length - 1]) && end < text.length && WORDISH.test(text[end])) return false
  return true
}

/** `text` の中で `term` が語として現れる最初の位置。無ければ -1 */
export function indexOfTerm(text: string, term: string): number {
  let from = 0
  while (from <= text.length) {
    const i = text.indexOf(term, from)
    if (i === -1) return -1
    if (boundaryOk(text, i, term)) return i
    from = i + 1
  }
  return -1
}

/** `text` が `term` を語として含むか */
export function hasTerm(text: string, term: string): boolean {
  return indexOfTerm(text, term) !== -1
}

const BY_TERM = new Map(GLOSSARY.map((e) => [e.term, e]))

export function lookupGlossary(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term)
}
