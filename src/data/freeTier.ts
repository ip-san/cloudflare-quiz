/**
 * 無料枠早見表データ
 *
 * 個人開発者が最初に知りたい「無料でどこまで行けるか」を1画面で確認するための
 * リファレンス。数値は Cloudflare 公式ドキュメントからの転記。
 *
 * ⚠️ この手の数値表は放置すると静かに陳腐化する（2026-08-24 に実際、16日古い
 * ドキュメントキャッシュのせいで正解が事実誤りになっていた問題が2件見つかった）。
 * そのため各項目に `docPage` と `docValue`（ドキュメント原文の表記）を持たせ、
 * `node scripts/verify-free-tier.mjs` がキャッシュ済みドキュメントと機械照合する。
 * 数値を足す・直すときは必ず docValue も原文どおりに書くこと。
 */

export interface FreeTierItem {
  /** 項目名（日本語） */
  readonly label: string
  /** 表示する無料枠（日本語で読みやすく） */
  readonly free: string
  /** 検証用: ドキュメント原文にそのまま現れる文字列 */
  readonly docValue: string
  /** 補足（任意） */
  readonly note?: string
}

export interface FreeTierService {
  readonly id: string
  readonly name: string
  readonly icon: string
  /** 一言で「何に使うか」 */
  readonly summary: string
  /** 検証用: .claude/tmp/docs/ のページ名（fetch-docs.mjs の name と同じ） */
  readonly docPage: string
  readonly docUrl: string
  readonly items: readonly FreeTierItem[]
}

export const FREE_TIER_SERVICES: readonly FreeTierService[] = [
  {
    id: 'workers',
    name: 'Workers',
    icon: '⚡',
    summary: 'エッジで動くアプリ本体。まずここから始まる',
    docPage: 'workers/platform/limits',
    docUrl: 'https://developers.cloudflare.com/workers/platform/limits/#account-plan-limits',
    items: [
      {
        label: 'リクエスト数',
        free: '1日 100,000 リクエスト',
        docValue: '100,000/day',
        note: '個人開発の規模なら当面これで足りる',
      },
      { label: 'CPU時間', free: '1リクエストあたり 10ms', docValue: '10 ms', note: '有料プランは5分' },
      { label: 'メモリ', free: '128 MB', docValue: '128 MB', note: '有料プランでも同じ' },
      { label: 'サブリクエスト', free: '1リクエストあたり 50', docValue: '50/request' },
      { label: 'Worker の数', free: '100 個', docValue: '100' },
      { label: 'Cron Trigger', free: 'アカウントあたり 5 個', docValue: '5' },
    ],
  },
  {
    id: 'kv',
    name: 'Workers KV',
    icon: '🗝️',
    summary: '設定値や機能フラグなど、読み取りが圧倒的に多いデータ',
    docPage: 'kv/platform/limits',
    docUrl: 'https://developers.cloudflare.com/kv/platform/limits/',
    items: [
      { label: '読み取り', free: '1日 100,000 回', docValue: '100,000 reads per day' },
      {
        label: '書き込み（別キー）',
        free: '1日 1,000 回',
        docValue: '1,000 writes per day',
        note: '書き込みが多い用途には向かない',
      },
      { label: 'ストレージ', free: '1 GB', docValue: '1 GB' },
      { label: '値のサイズ', free: '25 MiB', docValue: '25 MiB', note: '有料プランでも同じ' },
    ],
  },
  {
    id: 'd1',
    name: 'D1',
    icon: '🗄️',
    summary: 'SQLで集計・結合したいデータ（SQLiteベース）',
    docPage: 'd1/platform/limits',
    docUrl: 'https://developers.cloudflare.com/d1/platform/limits/',
    items: [
      { label: 'データベース数', free: '10 個', docValue: '10 (Free)' },
      { label: '1データベースの上限', free: '500 MB', docValue: '500 MB (Free)' },
      { label: 'アカウント合計', free: '5 GB', docValue: '5 GB (Free)' },
      {
        label: 'Time Travel（巻き戻し）',
        free: '7 日分',
        docValue: '7 days (Free)',
        note: '誤って消しても遡って復元できる期間',
      },
      { label: '1リクエスト内のクエリ数', free: '50', docValue: '50 (Free)' },
    ],
  },
  {
    id: 'r2',
    name: 'R2',
    icon: '📦',
    summary: '画像・動画・バックアップなどのファイル置き場',
    docPage: 'r2/pricing',
    docUrl: 'https://developers.cloudflare.com/r2/pricing/#free-tier',
    items: [
      { label: 'ストレージ', free: '月 10 GB', docValue: '10 GB-month / month' },
      { label: 'Class A 操作（書き込み系）', free: '月 100万リクエスト', docValue: '1 million requests / month' },
      { label: 'Class B 操作（読み取り系）', free: '月 1000万リクエスト', docValue: '10 million requests / month' },
      {
        label: 'エグレス（外部への転送）',
        free: '無料',
        docValue: 'Free',
        note: 'バズっても転送量課金が発生しないのがR2最大の特徴',
      },
    ],
  },
  {
    id: 'ai-gateway',
    name: 'AI Gateway',
    icon: '🤖',
    summary: 'AI APIの通り道。キャッシュ・上限・ログを一括で管理',
    docPage: 'ai-gateway/reference/limits',
    docUrl: 'https://developers.cloudflare.com/ai-gateway/reference/limits/',
    items: [
      { label: 'ゲートウェイ数', free: 'アカウントあたり 10 個', docValue: '10 per account' },
      {
        label: 'ログ保存件数',
        free: 'アカウント全体で 100,000 件',
        docValue: '100,000 per account',
        note: '有料プランは「1ゲートウェイあたり」1000万件と数え方が変わる',
      },
      { label: 'キャッシュ可能なリクエストサイズ', free: '25 MB', docValue: '25 MB per request' },
      { label: 'キャッシュTTL', free: '最大 1 か月', docValue: '1 month' },
    ],
  },
]
