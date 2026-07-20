# Cloudflare Quiz

Cloudflare をプロダクト開発に活かせるようになるための学習クイズ PWA です。Workers・Wrangler・KV・R2・D1・Durable Objects・Queues・Workers AI・Vectorize・Pages などのカテゴリで、実務に近い問題と図解を通じて学べます。

**公開URL**: https://ip-san.github.io/cloudflare-codex-quiz/

> **免責事項**: 本アプリは個人が作成した非公式の学習ツールであり、Cloudflare, Inc. とは一切関係ありません。Cloudflare の公式ロゴ・商標は使用しておらず、アプリ内のアイコンはすべてオリジナルの図案です。問題内容の正確性については可能な限り公式ドキュメントを参照して作成していますが、内容を保証するものではありません。

## 特徴

- 9カテゴリ・108問のクイズ（初学者〜中上級向け）
- 全体像モード（6章構成のガイド付き学習）、カテゴリ別学習、ランダム出題、実力テストなど複数の出題モード
- 間隔反復（SRS）による復習リマインド
- 進捗ダッシュボード、マスタリーレベル、学習履歴
- PWA対応（オフライン利用・ホーム画面への追加が可能）

## 開発

```bash
bun install
bun run dev        # 開発サーバー起動
bun run typecheck   # 型チェック
bun run lint        # Lint
bun run test        # ユニットテスト
bun run build        # 本番ビルド
bun run quiz:check   # クイズデータの整合性チェック
```

詳細な技術構成は `src/` 以下のコードとコメントを参照してください。

## ライセンス

MIT
