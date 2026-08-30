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
  { term: 'TTL', description: 'Time To Live。キャッシュやDNSレコードを、どれくらいの時間そのまま使ってよいかの期限。' },
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
  { term: 'DLP', description: 'Data Loss Prevention。機密情報が外部へ出ていくのを検知・防止する仕組み。' },
  {
    term: 'mTLS',
    description: '相互TLS。サーバーだけでなくクライアントも証明書を提示して、互いに身元を確認する方式。',
  },
  { term: 'IdP', description: 'Identity Provider。Google WorkspaceやOktaなど、利用者のログインを預かる認証サービス。' },
]

/** 長い語を先に照合するため、文字数の降順で持つ */
export const GLOSSARY: readonly GlossaryEntry[] = [...ENTRIES].sort((a, b) => b.term.length - a.term.length)

const BY_TERM = new Map(GLOSSARY.map((e) => [e.term, e]))

export function lookupGlossary(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(term)
}
